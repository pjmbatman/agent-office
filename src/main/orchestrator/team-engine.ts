import type {
  TeamId,
  TeamResult,
  TeamWorkflowState,
  WorkerRoleAssignment,
  AgentRole,
  AgentStatus,
  AgentStatusUpdate,
  RoleConfig,
} from '../../shared/types'
import { AgentManager } from '../agents/agent-manager'
import { Persistence } from '../workspace/persistence'
import type { AgentEvent } from '../../shared/types'
import { getSystemDiagnostics } from '../system/runtime-diagnostics'
import { appendFileSync, mkdirSync } from 'fs'
import { join } from 'path'

const MAX_ITERATIONS = 4

interface BroadcastFn {
  (channel: string, ...args: unknown[]): void
}

interface LeadAnalysis {
  criteria: string[]
  assignments: WorkerRoleAssignment[]
  singleWorkerMode: boolean
}

interface LeadEvaluation {
  verdict: 'APPROVED' | 'REVISION_NEEDED'
  feedback: string
  score: number
}

export class TeamEngine {
  private teamId: TeamId
  private agentManager: AgentManager
  private persistence: Persistence
  private broadcast: BroadcastFn
  private roleConfigs: RoleConfig[] = []
  private activeWorkspacePath = ''
  private activeTaskId = ''

  private leadRole: string
  private seniorRole: string
  private worker1Role: string
  private worker2Role: string

  constructor(
    teamId: TeamId,
    agentManager: AgentManager,
    persistence: Persistence,
    broadcast: BroadcastFn
  ) {
    this.teamId = teamId
    this.agentManager = agentManager
    this.persistence = persistence
    this.broadcast = broadcast

    this.leadRole = `${teamId}-lead`
    this.seniorRole = `${teamId}-senior`
    this.worker1Role = `${teamId}-worker1`
    this.worker2Role = `${teamId}-worker2`
  }

  setRoleConfigs(configs: RoleConfig[]): void {
    this.roleConfigs = configs.filter((c) => c.teamId === this.teamId)
  }

  async runTeamWorkflow(
    taskDescription: string,
    workspacePath: string,
    taskId: string
  ): Promise<TeamResult> {
    this.activeWorkspacePath = workspacePath
    this.activeTaskId = taskId

    try {
      const teamWorkspace = workspacePath
      this.trace(`runTeamWorkflow:start task="${taskDescription}"`)

      // 1. Lead analyzes task and distributes roles
      this.broadcastTeamState('lead-analyzing')
      this.broadcastAgentStatus(this.leadRole, 'thinking', '태스크 분석 및 역할 분배 중...')
      this.trace(`${this.leadRole}:analysis:start`)

      const leadAnalysisOutput = await this.runAgent(this.leadRole, taskDescription, {
        task: taskDescription,
        context: '',
      })
      this.trace(`${this.leadRole}:analysis:done`)
      this.broadcastAgentStatus(this.leadRole, 'done')

      const analysis = this.parseLeadAnalysis(leadAnalysisOutput)

      this.broadcast('team:lead-analyzed', {
        teamId: this.teamId,
        criteria: analysis.criteria,
        assignments: analysis.assignments,
      })

      let consolidatedReport = ''
      let feedback = ''
      let iterations = 0

      for (let i = 0; i < MAX_ITERATIONS; i++) {
        iterations = i + 1
        this.trace(`iteration:${iterations}:start`)

        // 2. Workers execute in parallel
        this.broadcastTeamState('workers-executing')
        this.trace(`iteration:${iterations}:workers:start`)

        const workerOutputs = await this.executeWorkers(
          taskDescription,
          analysis,
          teamWorkspace,
          feedback
        )
        this.trace(`iteration:${iterations}:workers:done`)

        // 3. Senior consolidates
        this.broadcastTeamState('senior-consolidating')
        this.broadcastAgentStatus(this.seniorRole, 'working', '결과 취합 중...')
        this.trace(`${this.seniorRole}:consolidation:start`)

        const workerOutputsSummary = Object.entries(workerOutputs)
          .map(([id, output]) => {
            const assignment = analysis.assignments.find((a) => `${this.teamId}-${a.workerId}` === id)
            return `### ${assignment?.assignedRole || id}\n${output}`
          })
          .join('\n\n---\n\n')

        consolidatedReport = await this.runAgent(this.seniorRole, taskDescription, {
          task: taskDescription,
          worker_outputs: workerOutputsSummary,
          criteria: analysis.criteria.join('\n- '),
          revision_feedback: feedback ? `\n## Revision Feedback\n${feedback}` : '',
        })
        this.trace(`${this.seniorRole}:consolidation:done`)
        this.broadcastAgentStatus(this.seniorRole, 'done')

        const userFacingReport = sanitizeConsolidatedReport(consolidatedReport)

        // 4. Lead evaluates
        this.broadcastTeamState('lead-evaluating')
        this.broadcastAgentStatus(this.leadRole, 'thinking', '결과 평가 중...')
        this.trace(`${this.leadRole}:evaluation:start`)

        const evaluationOutput = await this.runAgent(
          this.leadRole,
          `Evaluate the following consolidated report against your criteria.\n\nCriteria:\n${analysis.criteria.map((c) => `- ${c}`).join('\n')}\n\nReport:\n${userFacingReport}`,
          {
            task: taskDescription,
            context: `Phase: Evaluation\nReport:\n${userFacingReport}\nCriteria:\n${analysis.criteria.join(', ')}`,
          }
        )
        this.trace(`${this.leadRole}:evaluation:done`)
        this.broadcastAgentStatus(this.leadRole, 'done')

        const evaluation = this.parseLeadEvaluation(evaluationOutput)

        this.broadcast('team:evaluated', {
          teamId: this.teamId,
          verdict: evaluation.verdict,
          score: evaluation.score,
          feedback: evaluation.feedback,
          iteration: iterations,
        })

        if (evaluation.verdict === 'APPROVED') {
          break
        }

        feedback = evaluation.feedback
      }

      // Complete
      this.broadcastTeamState('complete')
      this.resetAgentStatuses()
      this.trace(`runTeamWorkflow:complete iterations=${iterations}`)

      return {
        teamId: this.teamId,
        result: sanitizeConsolidatedReport(consolidatedReport),
        criteria: analysis.criteria,
        satisfied: iterations < MAX_ITERATIONS || feedback === '',
        iterations,
        artifacts: [],
      }
    } finally {
      this.trace('runTeamWorkflow:finally')
      this.activeWorkspacePath = ''
      this.activeTaskId = ''
    }
  }

  private async executeWorkers(
    taskDescription: string,
    analysis: LeadAnalysis,
    workspacePath: string,
    revisionFeedback: string
  ): Promise<Record<string, string>> {
    const outputs: Record<string, string> = {}

    if (analysis.singleWorkerMode) {
      // Single worker mode
      const assignment = analysis.assignments[0]
      if (!assignment) return outputs

      const agentId = `${this.teamId}-${assignment.workerId}`
      this.broadcastAgentStatus(agentId, 'working', `${assignment.assignedRole} 수행 중...`)

      const output = await this.runAgent(agentId, taskDescription, {
        task: taskDescription,
        assigned_role: assignment.assignedRole,
        instructions: assignment.instructions,
        workspace_path: workspacePath,
        revision_feedback: revisionFeedback ? `\n## Revision Feedback\n${revisionFeedback}` : '',
      })

      this.broadcastAgentStatus(agentId, 'done')
      outputs[agentId] = output
    } else {
      // Parallel workers
      const workerPromises = analysis.assignments.map(async (assignment) => {
        const agentId = `${this.teamId}-${assignment.workerId}`
        this.broadcastAgentStatus(agentId, 'working', `${assignment.assignedRole} 수행 중...`)

        const output = await this.runAgent(agentId, taskDescription, {
          task: taskDescription,
          assigned_role: assignment.assignedRole,
          instructions: assignment.instructions,
          workspace_path: workspacePath,
          revision_feedback: revisionFeedback ? `\n## Revision Feedback\n${revisionFeedback}` : '',
        })

        this.broadcastAgentStatus(agentId, 'done')
        return { agentId, output }
      })

      const results = await Promise.all(workerPromises)
      for (const r of results) {
        outputs[r.agentId] = r.output
      }
    }

    return outputs
  }

  private async runAgent(
    role: AgentRole,
    prompt: string,
    templateVars: Record<string, string>
  ): Promise<string> {
    let fullOutput = ''
    let stderrOutput = ''
    this.trace(`${role}:runAgent:dispatch`)

    try {
      const dispatch = this.agentManager.dispatch(role, prompt, templateVars, this.activeWorkspacePath)
      this.trace(`${role}:runAgent:dispatched`)

      const stderrTask = (async () => {
        if (!dispatch.stderr) return
        for await (const chunk of dispatch.stderr) {
          if (!chunk.trim()) continue
          stderrOutput += chunk
        }
      })()

      for await (const event of dispatch.output) {
        this.broadcast('agent:output-chunk', { role, event })
        if (event.type === 'text-delta') {
          fullOutput += event.content
        } else if (event.type === 'complete' && !fullOutput && event.content) {
          fullOutput = event.content
        }
      }
      this.trace(`${role}:runAgent:output-complete`)

      await stderrTask
      this.trace(`${role}:runAgent:stderr-complete`)
      const exitCode = await dispatch.exitCode
      this.trace(`${role}:runAgent:exit=${exitCode}`)

      if (!fullOutput.trim()) {
        const msg = stderrOutput.trim() || `Agent returned no output (exit code ${exitCode})`
        this.broadcast('agent:output-chunk', {
          role,
          event: { type: 'error', content: msg },
        })
        throw new Error(msg)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Agent execution failed'
      this.broadcast('agent:output-chunk', {
        role,
        event: { type: 'error', content: msg },
      })
      throw err
    }

    const config = this.agentManager.getConfig(role)
    if (config) {
      this.persistence.saveAgentLog({
        taskId: this.activeTaskId,
        role,
        prompt,
        response: fullOutput.slice(0, 10000),
        provider: config.provider,
        targetType: config.target.type,
      })
    }

    return fullOutput
  }

  private trace(message: string): void {
    if (!this.activeWorkspacePath) return

    try {
      const debugDir = join(this.activeWorkspacePath, '.agent-office-debug')
      mkdirSync(debugDir, { recursive: true })
      appendFileSync(
        join(debugDir, `team-trace-${this.teamId}.log`),
        `${new Date().toISOString()} ${message}\n`
      )
    } catch {
      // ignore trace failures
    }
  }

  private parseLeadAnalysis(output: string): LeadAnalysis {
    const fallback: LeadAnalysis = {
      criteria: ['Task completed successfully'],
      assignments: [
        { agentId: this.worker1Role, workerId: 'worker1', assignedRole: 'executor', instructions: 'Complete the task as described.' },
      ],
      singleWorkerMode: true,
    }

    const jsonText = extractJsonText(output)
    if (!jsonText) return fallback

    try {
      const parsed = JSON.parse(jsonText) as {
        criteria?: string[]
        assignments?: Array<{ workerId: string; role: string; instructions: string }>
        singleWorkerMode?: boolean
      }

      const assignments: WorkerRoleAssignment[] = (parsed.assignments || []).map((a) => ({
        agentId: `${this.teamId}-${a.workerId}`,
        workerId: a.workerId,
        assignedRole: a.role,
        instructions: a.instructions,
      }))

      return {
        criteria: parsed.criteria?.length ? parsed.criteria : fallback.criteria,
        assignments: assignments.length ? assignments : fallback.assignments,
        singleWorkerMode: parsed.singleWorkerMode ?? assignments.length <= 1,
      }
    } catch {
      return fallback
    }
  }

  private parseLeadEvaluation(output: string): LeadEvaluation {
    const jsonText = extractJsonText(output)
    if (jsonText) {
      try {
        const parsed = JSON.parse(jsonText) as {
          verdict?: string
          feedback?: string
          score?: number
        }
        const verdict = String(parsed.verdict || '').toUpperCase()
        return {
          verdict: verdict === 'APPROVED' ? 'APPROVED' : 'REVISION_NEEDED',
          feedback: String(parsed.feedback || ''),
          score: Number(parsed.score || 0),
        }
      } catch { /* fall through */ }
    }

    const upper = output.toUpperCase()
    if (upper.includes('APPROVED') || upper.includes('LGTM')) {
      return { verdict: 'APPROVED', feedback: output, score: 80 }
    }

    return { verdict: 'REVISION_NEEDED', feedback: output, score: 50 }
  }

  private broadcastTeamState(state: TeamWorkflowState): void {
    this.broadcast('team:state-update', { teamId: this.teamId, state })
  }

  private broadcastAgentStatus(role: AgentRole, status: AgentStatus, action?: string): void {
    const config = this.agentManager.getConfig(role)
    const fallbackProvider = getSystemDiagnostics().preferredProvider || 'codex'
    this.broadcast('agent:status', {
      role,
      status,
      currentAction: action,
      provider: config?.provider || fallbackProvider,
      target: config?.target || { type: 'local' },
    } satisfies AgentStatusUpdate)
  }

  private resetAgentStatuses(): void {
    const roles = [this.leadRole, this.seniorRole, this.worker1Role, this.worker2Role]
    for (const role of roles) {
      this.broadcastAgentStatus(role, 'idle')
    }
  }

  killAll(): void {
    const roles = [this.leadRole, this.seniorRole, this.worker1Role, this.worker2Role]
    for (const role of roles) {
      this.agentManager.killAgent(role)
    }
  }
}

function sanitizeConsolidatedReport(report: string): string {
  if (!report) return report

  const normalized = report.trim()
  const markers = [
    '\n### Consolidation Notes',
    '\n## Consolidation Notes',
  ]

  for (const marker of markers) {
    const index = normalized.indexOf(marker)
    if (index >= 0) {
      return sanitizeMainDeliverable(normalized.slice(0, index).trim())
    }
  }

  return sanitizeMainDeliverable(normalized)
}

function sanitizeMainDeliverable(text: string): string {
  let cleaned = text.trim()

  cleaned = cleaned.replace(/^(?:#{1,6}\s*|\*\*)?(?:통합 결과|최종 응답|추천 응답안|응답 초안|답변 초안)\*{0,2}\s*\n+/u, '')

  const directAnswerMatch = cleaned.match(/(?:^|\n)(?:응답 초안|추천 응답안):\s*(.+)(?:\n|$)/u)
  if (directAnswerMatch?.[1]) {
    return directAnswerMatch[1].trim()
  }

  return cleaned.trim()
}

function extractJsonText(output: string): string | null {
  const fenced = output.match(/```json\s*([\s\S]*?)```/i)
  if (fenced?.[1]) {
    return fenced[1].trim()
  }

  const firstBrace = output.indexOf('{')
  const lastBrace = output.lastIndexOf('}')
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return output.slice(firstBrace, lastBrace + 1).trim()
  }

  return null
}
