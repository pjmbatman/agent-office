import type { AgentProvider, AgentProcess } from './providers/base-provider'
import type {
  AgentRole,
  ProviderType,
  ExecutionTarget,
  SpawnConfig,
  AgentEvent,
  CharacterConfig,
  RoleConfig,
  ProviderOptions
} from '../../shared/types'
import { ClaudeProvider } from './providers/claude-provider'
import { CodexProvider } from './providers/codex-provider'
import { CustomProvider, type CustomProviderConfig } from './providers/custom-provider'
import { SSHTransport } from './transport/ssh-transport'
import { FileSync } from './transport/file-sync'
import { fillPromptTemplate, indexRoleConfigs } from './roles'
import { isProviderAvailable } from '../system/runtime-diagnostics'

export interface AgentConfig {
  role: AgentRole
  provider: ProviderType
  target: ExecutionTarget
  providerOptions?: ProviderOptions
  customProviderConfig?: CustomProviderConfig
}

interface RunningAgent {
  role: AgentRole
  process: AgentProcess
  provider: AgentProvider
}

export class AgentManager {
  private providers: Map<string, AgentProvider> = new Map()
  private sshTransports: Map<string, SSHTransport> = new Map()
  private running: Map<AgentRole, RunningAgent> = new Map()
  private agentConfigs: Map<AgentRole, AgentConfig> = new Map()
  private roleConfigs: Map<AgentRole, RoleConfig> = new Map()
  private fileSync = new FileSync()

  constructor() {
    // Register built-in providers
    this.providers.set('claude-code', new ClaudeProvider())
    this.providers.set('codex', new CodexProvider())
  }

  setRoleConfigs(configs: RoleConfig[]): void {
    this.roleConfigs = new Map(Object.entries(indexRoleConfigs(configs)))
  }

  private getRemoteTargetKey(target: Extract<ExecutionTarget, { type: 'remote' }>): string {
    const key = target.sshHost?.trim() || target.host?.trim() || ''
    if (!key) {
      throw new Error('Remote target requires an SSH host alias')
    }
    return key
  }

  /** Configure an agent role with a specific provider and target */
  configureAgent(config: AgentConfig): void {
    // Register config even if provider isn't available yet — checked at dispatch time
    this.agentConfigs.set(config.role, config)

    // Register custom provider if needed
    if (config.provider === 'custom' && config.customProviderConfig) {
      const key = `custom-${config.role}`
      this.providers.set(key, new CustomProvider(config.customProviderConfig))
    }

    // Create SSH transport if needed
    if (config.target.type === 'remote') {
      const key = this.getRemoteTargetKey(config.target)
      if (!this.sshTransports.has(key)) {
        this.sshTransports.set(key, new SSHTransport(config.target))
      }
    }
  }

  /** Dispatch a task to a specific agent role */
  dispatch(
    role: AgentRole,
    prompt: string,
    templateVars: Record<string, string> = {},
    workspacePath: string = ''
  ): AgentProcess {
    const config = this.agentConfigs.get(role)
    if (!config) {
      throw new Error(`Agent role "${role}" not configured`)
    }

    const roleConfig = this.roleConfigs.get(role)
    if (!roleConfig) {
      throw new Error(`Role "${role}" is not defined`)
    }
    const filledSystemPrompt = fillPromptTemplate(roleConfig.systemPromptTemplate, {
      ...templateVars,
      workspace_path: workspacePath
    })

    const providerKey = config.provider === 'custom' ? `custom-${role}` : config.provider
    const provider = this.providers.get(providerKey)
    if (!provider) {
      throw new Error(`Provider "${providerKey}" not found`)
    }

    const spawnConfig: SpawnConfig = {
      provider: config.provider,
      target: config.target,
      role: { ...roleConfig, systemPromptTemplate: filledSystemPrompt },
      prompt,
      workspacePath,
      providerOptions: config.providerOptions,
    }

    const process = provider.spawn(spawnConfig)
    this.running.set(role, { role, process, provider })

    const self = this

    async function* wrapOutput(): AsyncIterable<AgentEvent> {
      try {
        for await (const event of process.output) {
          yield event
        }
      } finally {
        self.running.delete(role)
      }
    }

    return {
      output: wrapOutput(),
      stderr: process.stderr,
      kill: () => {
        process.kill()
        self.running.delete(role)
      },
      exitCode: process.exitCode
    }
  }

  /** Sync files between two agents' workspaces */
  async syncWorkspaces(
    fromRole: AgentRole,
    toRole: AgentRole,
    workspacePath: string
  ): Promise<string[]> {
    const fromConfig = this.agentConfigs.get(fromRole)
    const toConfig = this.agentConfigs.get(toRole)
    if (!fromConfig || !toConfig) return []

    const fromWorkspace = fromConfig.target.type === 'remote'
      ? fromConfig.target.remoteWorkspacePath
      : workspacePath

    const toWorkspace = toConfig.target.type === 'remote'
      ? toConfig.target.remoteWorkspacePath
      : workspacePath

    return this.fileSync.syncAfterAgent(
      fromConfig.target,
      fromWorkspace,
      toConfig.target,
      toWorkspace,
      this.sshTransports
    )
  }

  /** Kill a running agent */
  killAgent(role: AgentRole): void {
    const running = this.running.get(role)
    if (running) {
      running.process.kill()
      this.running.delete(role)
    }
  }

  /** Kill all running agents */
  killAll(): void {
    for (const [role] of this.running) {
      this.killAgent(role)
    }
  }

  /** Disconnect all SSH connections */
  disconnectAll(): void {
    this.killAll()
    for (const transport of this.sshTransports.values()) {
      transport.disconnect()
    }
    this.sshTransports.clear()
  }

  /** Get current agent configs */
  getConfig(role: AgentRole): AgentConfig | undefined {
    return this.agentConfigs.get(role)
  }

  isRunning(role: AgentRole): boolean {
    return this.running.has(role)
  }
}
