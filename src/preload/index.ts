import { contextBridge, ipcRenderer } from 'electron'
import type { ProviderType, ExecutionTarget, AgentRole, RoleConfig, TeamConfig, TeamId } from '../shared/types'

export interface PersistedAgentConfig {
  role: AgentRole
  provider: ProviderType
  target: ExecutionTarget
}

export interface ProviderDiagnostic {
  provider: ProviderType
  status: 'ready' | 'needs-setup' | 'not-installed'
  available: boolean
  command?: string
  reason?: string
  detail?: string
  setupCommand?: string
}

export interface SystemDiagnostics {
  providers: ProviderDiagnostic[]
  preferredProvider: 'claude-code' | 'codex' | null
}

export interface AgentOfficeAPI {
  // Task operations
  submitTask: (description: string) => Promise<{ taskId: string; status: string }>
  cancelTask: (taskId: string) => Promise<{ success: boolean }>
  overrideWorkflow: (action: string) => Promise<{ success: boolean }>

  // Workspace operations
  listFiles: (taskId: string) => Promise<string[]>
  readFile: (taskId: string, relativePath: string) => Promise<string>

  // Agent configuration
  configureAgent: (config: unknown) => Promise<{ success: boolean; error?: string }>
  getAgentConfigs: () => Promise<PersistedAgentConfig[]>
  getRoleDefinitions: () => Promise<RoleConfig[]>
  saveRoleDefinitions: (definitions: RoleConfig[]) => Promise<{ success: boolean; error?: string }>
  getWorkflowState: () => Promise<unknown>
  getSystemDiagnostics: () => Promise<SystemDiagnostics>
  getAvailableModels: () => Promise<Array<{ id: string; label: string; provider: string }>>
  checkProviderReadiness: (provider: ProviderType, target?: ExecutionTarget) => Promise<ProviderDiagnostic>
  openProviderSetupTerminal: (provider: ProviderType, target?: ExecutionTarget) => Promise<{ success: boolean; error?: string }>

  // Team configuration
  getTeamConfigs: () => Promise<TeamConfig[]>
  saveTeamConfigs: (configs: TeamConfig[]) => Promise<{ success: boolean; error?: string }>
  selectEnsembleResult: (teamId: TeamId) => Promise<{ success: boolean; error?: string }>

  // Event listeners (main -> renderer)
  onTaskStateUpdate: (callback: (data: unknown) => void) => () => void
  onAgentStatus: (callback: (data: unknown) => void) => () => void
  onAgentOutputChunk: (callback: (data: unknown) => void) => () => void
  onTeamStateUpdate: (callback: (data: unknown) => void) => () => void
  onEnsembleResults: (callback: (data: unknown) => void) => () => void
}

const api: AgentOfficeAPI = {
  submitTask: (description) => ipcRenderer.invoke('task:submit', description),
  cancelTask: (taskId) => ipcRenderer.invoke('task:cancel', taskId),
  overrideWorkflow: (action) => ipcRenderer.invoke('workflow:override', action),

  listFiles: (taskId) => ipcRenderer.invoke('workspace:files', taskId),
  readFile: (taskId, relativePath) => ipcRenderer.invoke('workspace:read-file', taskId, relativePath),

  configureAgent: (config) => ipcRenderer.invoke('agent:configure', config),
  getAgentConfigs: () => ipcRenderer.invoke('agent:get-configs'),
  getRoleDefinitions: () => ipcRenderer.invoke('roles:get-definitions'),
  saveRoleDefinitions: (definitions) => ipcRenderer.invoke('roles:save-definitions', definitions),
  getWorkflowState: () => ipcRenderer.invoke('workflow:state'),
  getSystemDiagnostics: () => ipcRenderer.invoke('system:get-diagnostics'),
  getAvailableModels: () => ipcRenderer.invoke('system:get-models'),
  checkProviderReadiness: (provider, target) => ipcRenderer.invoke('system:check-provider-readiness', provider, target),
  openProviderSetupTerminal: (provider, target) => ipcRenderer.invoke('system:open-provider-setup-terminal', provider, target),

  getTeamConfigs: () => ipcRenderer.invoke('teams:get-config'),
  saveTeamConfigs: (configs) => ipcRenderer.invoke('teams:save-config', configs),
  selectEnsembleResult: (teamId) => ipcRenderer.invoke('ensemble:select', teamId),

  onTaskStateUpdate: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data)
    ipcRenderer.on('task:state-update', handler)
    return () => ipcRenderer.removeListener('task:state-update', handler)
  },
  onAgentStatus: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data)
    ipcRenderer.on('agent:status', handler)
    return () => ipcRenderer.removeListener('agent:status', handler)
  },
  onAgentOutputChunk: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data)
    ipcRenderer.on('agent:output-chunk', handler)
    return () => ipcRenderer.removeListener('agent:output-chunk', handler)
  },
  onTeamStateUpdate: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data)
    ipcRenderer.on('team:state-update', handler)
    return () => ipcRenderer.removeListener('team:state-update', handler)
  },
  onEnsembleResults: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data)
    ipcRenderer.on('ensemble:results', handler)
    return () => ipcRenderer.removeListener('ensemble:results', handler)
  },
}

contextBridge.exposeInMainWorld('agentOffice', api)
