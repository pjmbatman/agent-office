import type { TeamConfig, TeamId } from '../../shared/types'

export interface AgentOfficeAPI {
  submitTask: (description: string) => Promise<{ taskId: string; status: string }>
  cancelTask: (taskId: string) => Promise<{ success: boolean }>
  overrideWorkflow: (action: string) => Promise<{ success: boolean }>
  listFiles: (taskId: string) => Promise<string[]>
  readFile: (taskId: string, relativePath: string) => Promise<string>
  configureAgent: (config: unknown) => Promise<{ success: boolean; error?: string }>
  getAgentConfigs: () => Promise<Array<{
    role: string
    provider: 'claude-code' | 'codex' | 'custom'
    target:
      | { type: 'local' }
      | {
          type: 'remote'
          sshHost: string
          remoteWorkspacePath: string
          host?: string
          port?: number
          user?: string
          authMethod?: 'ssh-key' | 'password'
          keyPath?: string
          password?: string
        }
  }>>
  getRoleDefinitions: () => Promise<Array<{
    name: string
    displayName: string
    kind: 'planner' | 'researcher' | 'implementer' | 'reviewer' | 'general'
    systemPromptTemplate: string
    allowedTools?: string[]
  }>>
  saveRoleDefinitions: (definitions: Array<{
    name: string
    displayName: string
    kind: 'planner' | 'researcher' | 'implementer' | 'reviewer' | 'general'
    systemPromptTemplate: string
    allowedTools?: string[]
  }>) => Promise<{ success: boolean; error?: string }>
  getWorkflowState: () => Promise<unknown>
  getAvailableModels: () => Promise<Array<{ id: string; label: string; provider: string }>>
  checkProviderReadiness: (
    provider: 'claude-code' | 'codex' | 'custom',
    target?: { type: 'local' } | {
      type: 'remote'
      sshHost: string
      remoteWorkspacePath: string
      host?: string
      port?: number
      user?: string
      authMethod?: 'ssh-key' | 'password'
      keyPath?: string
      password?: string
    }
  ) => Promise<{
    provider: 'claude-code' | 'codex' | 'custom'
    status: 'ready' | 'needs-setup' | 'not-installed'
    available: boolean
    command?: string
    reason?: string
    detail?: string
    setupCommand?: string
  }>
  openProviderSetupTerminal: (
    provider: 'claude-code' | 'codex' | 'custom',
    target?: { type: 'local' } | {
      type: 'remote'
      sshHost: string
      remoteWorkspacePath: string
      host?: string
      port?: number
      user?: string
      authMethod?: 'ssh-key' | 'password'
      keyPath?: string
      password?: string
    }
  ) => Promise<{ success: boolean; error?: string }>
  getSystemDiagnostics: () => Promise<{
    providers: Array<{
      provider: 'claude-code' | 'codex' | 'custom'
      status: 'ready' | 'needs-setup' | 'not-installed'
      available: boolean
      command?: string
      reason?: string
      detail?: string
      setupCommand?: string
    }>
    preferredProvider: 'claude-code' | 'codex' | null
  }>

  // Team configuration
  getTeamConfigs: () => Promise<TeamConfig[]>
  saveTeamConfigs: (configs: TeamConfig[]) => Promise<{ success: boolean; error?: string }>
  selectEnsembleResult: (teamId: TeamId) => Promise<{ success: boolean; error?: string }>

  // Event listeners
  onTaskStateUpdate: (callback: (data: unknown) => void) => () => void
  onAgentStatus: (callback: (data: unknown) => void) => () => void
  onAgentOutputChunk: (callback: (data: unknown) => void) => () => void
  onTeamStateUpdate: (callback: (data: unknown) => void) => () => void
  onEnsembleResults: (callback: (data: unknown) => void) => () => void
}

declare global {
  interface Window {
    agentOffice?: AgentOfficeAPI
  }
}

export function getAgentOffice(): AgentOfficeAPI {
  const api = window.agentOffice
  if (!api) {
    throw new Error('window.agentOffice is unavailable. Preload may have failed to load.')
  }
  return api
}
