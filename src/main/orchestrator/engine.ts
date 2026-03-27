import { createActor } from 'xstate'
import { workflowMachine, type WorkflowContext } from './state-machine'
import { TaskQueue } from './task-queue'
import { TeamEngine } from './team-engine'
import { AgentManager, type AgentConfig } from '../agents/agent-manager'
import { broadcastToRenderer } from '../ipc-handlers'
import { Persistence } from '../workspace/persistence'
import { WorkspaceManager } from '../workspace/workspace-manager'
import type { AgentRole, WorkflowState, AgentStatus, RoleConfig, TeamId, TeamConfig, TeamResult } from '../../shared/types'
import { normalizeRoleConfigs } from '../agents/roles'
import { mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { getSystemDiagnostics } from '../system/runtime-diagnostics'

const WORKSPACES_ROOT = join(homedir(), '.agent-office', 'workspaces')

interface FastPathResult {
  plan: string
  implementation: string
}

export class OrchestrationEngine {
  private actor: ReturnType<typeof createActor<typeof workflowMachine>>
  private taskQueue = new TaskQueue()
  private agentManager = new AgentManager()
  private persistence: Persistence
  private workspaceManager = new WorkspaceManager()
  private currentWorkspace = ''
  private currentTaskId = ''
  private roleConfigs: RoleConfig[] = []

  private teamEngines: Map<TeamId, TeamEngine> = new Map()
  private teamConfigs: TeamConfig[] = [
    { id: 'alpha', enabled: true, displayName: 'Team Alpha' },
    { id: 'beta', enabled: true, displayName: 'Team Beta' },
  ]

  constructor(persistence: Persistence) {
    this.persistence = persistence
    this.actor = createActor(workflowMachine)

    this.actor.subscribe((snapshot) => {
      const state = snapshot.value as WorkflowState
      broadcastToRenderer('task:state-update', {
        state,
        context: snapshot.context
      })
    })

    this.actor.start()

    // Create team engines
    this.teamEngines.set('alpha', new TeamEngine('alpha', this.agentManager, persistence, broadcastToRenderer))
    this.teamEngines.set('beta', new TeamEngine('beta', this.agentManager, persistence, broadcastToRenderer))

    // Load team configs from persistence
    const savedTeamConfigs = persistence.getTeamConfigs()
    if (savedTeamConfigs.length > 0) {
      this.teamConfigs = savedTeamConfigs.map((row) => ({
        id: row.id as TeamId,
        enabled: row.enabled === 1,
        displayName: row.display_name,
        providerOptions: row.provider_options_json ? JSON.parse(row.provider_options_json) : undefined,
      }))
    }
  }

  setRoleConfigs(configs: RoleConfig[]): void {
    this.roleConfigs = normalizeRoleConfigs(configs)
    this.agentManager.setRoleConfigs(this.roleConfigs)
    for (const engine of this.teamEngines.values()) {
      engine.setRoleConfigs(this.roleConfigs)
    }
  }

  getRoleConfigs(): RoleConfig[] {
    return [...this.roleConfigs]
  }

  configureAgent(config: AgentConfig): void {
    this.agentManager.configureAgent(config)
  }

  getTeamConfigs(): TeamConfig[] {
    return [...this.teamConfigs]
  }

  setTeamConfigs(configs: TeamConfig[]): void {
    // Ensure at least one team is enabled
    const hasEnabled = configs.some((c) => c.enabled)
    if (!hasEnabled && configs.length > 0) {
      configs[0].enabled = true
    }
    this.teamConfigs = configs
    this.persistence.saveTeamConfigs(configs.map((c) => ({
      id: c.id,
      enabled: c.enabled,
      displayName: c.displayName,
      providerOptionsJson: c.providerOptions ? JSON.stringify(c.providerOptions) : undefined,
    })))

    // Apply providerOptions to each team's agents
    for (const teamConfig of configs) {
      if (!teamConfig.providerOptions) continue
      const teamRoles = this.roleConfigs.filter((r) => r.teamId === teamConfig.id)
      for (const role of teamRoles) {
        const existing = this.agentManager.getConfig(role.name)
        if (existing) {
          this.agentManager.configureAgent({
            ...existing,
            providerOptions: teamConfig.providerOptions,
          })
        }
      }
    }
  }

  async submitTask(description: string): Promise<string> {
    const currentState = this.actor.getSnapshot().value

    if (currentState !== 'idle' && currentState !== 'complete') {
      return this.taskQueue.enqueue(description).id
    }

    return this.startTask(description)
  }

  cancelTask(): void {
    this.actor.send({ type: 'CEO_OVERRIDE', action: 'cancel' })
    for (const engine of this.teamEngines.values()) {
      engine.killAll()
    }
    this.agentManager.killAll()
    this.resetAgentStatuses()
    this.processNextInQueue()
  }

  approveTask(): void {
    this.actor.send({ type: 'CEO_OVERRIDE', action: 'approve' })
    this.resetAgentStatuses()
  }

  selectTeamResult(teamId: TeamId): void {
    this.actor.send({ type: 'CEO_SELECTED', selectedTeamId: teamId })
  }

  dismissTask(): void {
    this.actor.send({ type: 'TASK_DISMISS' })
    this.resetAgentStatuses()
    this.processNextInQueue()
  }

  getState(): { state: string; context: WorkflowContext } {
    const snapshot = this.actor.getSnapshot()
    return {
      state: snapshot.value as string,
      context: snapshot.context
    }
  }

  private async startTask(description: string): Promise<string> {
    const taskId = Date.now().toString()
    this.currentTaskId = taskId
    this.currentWorkspace = join(WORKSPACES_ROOT, taskId)
    if (!existsSync(this.currentWorkspace)) {
      mkdirSync(this.currentWorkspace, { recursive: true })
    }

    this.persistence.saveTask({
      id: taskId,
      description,
      status: 'teams-working',
    })

    this.actor.send({ type: 'TASK_SUBMIT', description })

    const fastPath = this.classifyFastPath(description)
    if (fastPath) {
      this.actor.send({
        type: 'FAST_TRACK_COMPLETE',
        plan: fastPath.plan,
        implementation: fastPath.implementation
      })

      this.persistence.saveTask({
        id: taskId,
        description,
        status: 'complete',
        plan: fastPath.plan,
        implementation: fastPath.implementation,
        reviewFeedback: 'Fast-path response',
        reviewScore: 100,
      })

      return taskId
    }

    this.runEnsemblePipeline(description).catch((err) => {
      this.actor.send({ type: 'ERROR', message: err.message })
      this.resetAgentStatuses()
      this.persistence.saveTask({
        id: taskId,
        description,
        status: 'idle',
      })
    })

    return taskId
  }

  private async runEnsemblePipeline(description: string): Promise<void> {
    const taskId = this.currentTaskId
    const enabledTeams = this.teamConfigs.filter((t) => t.enabled)

    if (enabledTeams.length === 0) {
      throw new Error('No teams are enabled')
    }

    // Run enabled teams in parallel
    const teamPromises = enabledTeams.map((team) => {
      const engine = this.teamEngines.get(team.id)!
      return engine.runTeamWorkflow(description, this.currentWorkspace, taskId)
    })

    const teamResults = await Promise.allSettled(teamPromises)

    const successfulResults: TeamResult[] = teamResults
      .filter((r): r is PromiseFulfilledResult<TeamResult> => r.status === 'fulfilled')
      .map((r) => r.value)

    const failedResults = teamResults
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')

    for (const failed of failedResults) {
      const reason = failed.reason instanceof Error ? failed.reason.message : 'Unknown error'
      broadcastToRenderer('team:error', { error: reason })
    }

    if (successfulResults.length === 0) {
      throw new Error('All teams failed to complete')
    }

    // If only one team or one result, auto-select
    if (successfulResults.length === 1) {
      const result = successfulResults[0]
      const implementation = result.result
      this.workspaceManager.writeFile(taskId, 'final_response.md', implementation)

      this.actor.send({
        type: 'ALL_TEAMS_COMPLETE',
        results: successfulResults,
      })

      this.persistence.saveTask({
        id: taskId,
        description,
        status: 'complete',
        implementation,
        reviewFeedback: `Team ${result.teamId} completed in ${result.iterations} iteration(s)`,
        reviewScore: result.satisfied ? 90 : 60,
      })
    } else {
      const selected = this.pickBestTeamResult(successfulResults)
      const implementation = selected.result
      this.workspaceManager.writeFile(taskId, 'final_response.md', implementation)

      this.actor.send({
        type: 'ALL_TEAMS_COMPLETE',
        results: [selected],
      })

      broadcastToRenderer('ensemble:results', successfulResults)

      this.persistence.saveTask({
        id: taskId,
        description,
        status: 'complete',
        implementation,
        reviewFeedback: `Auto-selected Team ${selected.teamId} from ${successfulResults.length} successful teams`,
        reviewScore: selected.satisfied ? 95 : 75,
      })
    }

    this.resetAgentStatuses()
  }

  private resetAgentStatuses(): void {
    for (const role of this.roleConfigs.map((config) => config.name)) {
      this.broadcastAgentStatus(role, 'idle')
    }
  }

  private broadcastAgentStatus(role: AgentRole, status: AgentStatus, action?: string): void {
    const config = this.agentManager.getConfig(role)
    const fallbackProvider = getSystemDiagnostics().preferredProvider || 'codex'
    broadcastToRenderer('agent:status', {
      role,
      status,
      currentAction: action,
      provider: config?.provider || fallbackProvider,
      target: config?.target || { type: 'local' }
    })
  }

  private processNextInQueue(): void {
    if (!this.taskQueue.isEmpty()) {
      const next = this.taskQueue.dequeue()
      if (next) {
        this.startTask(next.description)
      }
    }
  }

  private pickBestTeamResult(results: TeamResult[]): TeamResult {
    return [...results].sort((a, b) => {
      if (a.satisfied !== b.satisfied) {
        return a.satisfied ? -1 : 1
      }

      if (a.iterations !== b.iterations) {
        return a.iterations - b.iterations
      }

      return a.teamId.localeCompare(b.teamId)
    })[0]
  }

  destroy(): void {
    this.agentManager.disconnectAll()
    this.actor.stop()
  }

  private classifyFastPath(description: string): FastPathResult | null {
    const normalized = description.trim().toLowerCase()
    const greetingPattern = /^(hi|hello|hey|yo|sup|안녕|안녕하세요|ㅎㅇ|반가워|hola|bonjour)[!.? ]*$/

    if (!greetingPattern.test(normalized)) {
      return null
    }

    return {
      plan: 'Fast-path greeting response. No orchestration needed.',
      implementation: 'Hi. Send me the actual task you want planned or reviewed.'
    }
  }
}
