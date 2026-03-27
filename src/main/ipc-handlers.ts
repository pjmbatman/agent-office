import { ipcMain, BrowserWindow } from 'electron'
import { OrchestrationEngine } from './orchestrator/engine'
import { WorkspaceManager } from './workspace/workspace-manager'
import { Persistence } from './workspace/persistence'
import type { AgentConfig } from './agents/agent-manager'
import { getSystemDiagnostics, getAvailableModels, checkProviderReadiness } from './system/runtime-diagnostics'
import { openProviderSetupTerminal } from './system/provider-setup'
import { getDefaultRoleConfigs, normalizeRoleConfigs } from './agents/roles'
import type { RoleConfig, TeamConfig, TeamId } from '../shared/types'

let engine: OrchestrationEngine
let workspace: WorkspaceManager
let persistence: Persistence

export function registerIpcHandlers(): void {
  persistence = new Persistence()
  engine = new OrchestrationEngine(persistence)
  workspace = new WorkspaceManager()
  const savedRoles = normalizeRoleConfigs(
    (persistence.getRoleDefinitions() as unknown as RoleConfig[]) || []
  )
  // Use saved roles only if they contain team roles; otherwise use defaults
  const hasTeamRoles = savedRoles.some((r) => r.name.startsWith('alpha-') || r.name.startsWith('beta-'))
  engine.setRoleConfigs(hasTeamRoles ? savedRoles : getDefaultRoleConfigs())

  // Load persisted agent configs, fallback to defaults
  const diagnostics = getSystemDiagnostics()
  const fallbackProvider = diagnostics.preferredProvider || 'claude-code'
  const currentRoleNames = new Set(engine.getRoleConfigs().map((r) => r.name))
  const savedConfigs = persistence.getAgentConfigs()

  // Load saved configs that match current roles
  const configuredRoles = new Set<string>()
  for (const row of savedConfigs) {
    const roleName = String(row.role)
    if (!currentRoleNames.has(roleName)) continue
    try {
      engine.configureAgent({
        role: roleName as AgentConfig['role'],
        provider: row.provider as AgentConfig['provider'],
        target: JSON.parse(row.target_json as string),
      })
      configuredRoles.add(roleName)
    } catch { /* ignore bad/unavailable config rows */ }
  }

  // Configure any unconfigured roles with fallback
  for (const role of engine.getRoleConfigs()) {
    if (configuredRoles.has(role.name)) continue
    try {
      engine.configureAgent({ role: role.name, provider: fallbackProvider, target: { type: 'local' } })
    } catch { /* provider may be unavailable, will error at dispatch time */ }
  }

  // Task submission from CEO
  ipcMain.handle('task:submit', async (_event, description: string) => {
    try {
      const taskId = await engine.submitTask(description)
      return { taskId, status: 'received' }
    } catch (err) {
      return { taskId: '', status: 'error', error: (err as Error).message }
    }
  })

  // Task cancellation
  ipcMain.handle('task:cancel', async () => {
    try {
      engine.cancelTask()
      return { success: true }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })

  // CEO override (approve/reject during review)
  ipcMain.handle('workflow:override', async (_event, action: string) => {
    try {
      if (action === 'approve') engine.approveTask()
      else if (action === 'cancel') engine.cancelTask()
      else if (action === 'dismiss') engine.dismissTask()
      return { success: true }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })

  // Get current workflow state
  ipcMain.handle('workflow:state', async () => {
    try {
      return engine.getState()
    } catch (err) {
      return { state: 'idle', context: {}, error: (err as Error).message }
    }
  })

  ipcMain.handle('system:open-provider-setup-terminal', async (_event, provider, target) => {
    try {
      openProviderSetupTerminal(provider, target)
      return { success: true }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })

  ipcMain.handle('system:check-provider-readiness', async (_event, provider, target) => {
    try {
      return checkProviderReadiness(provider, target)
    } catch (err) {
      return {
        provider,
        status: 'needs-setup',
        available: false,
        reason: (err as Error).message
      }
    }
  })

  // Configure an agent (and persist)
  ipcMain.handle('agent:configure', async (_event, config) => {
    try {
      engine.configureAgent({
        role: config.role,
        provider: config.provider,
        target: config.target,
        providerOptions: config.providerOptions,
      })
      persistence.saveAgentConfig(config.role, config.provider, config.target)
      return { success: true }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })

  // Get all agent configs
  ipcMain.handle('agent:get-configs', async () => {
    try {
      return persistence.getAgentConfigs().flatMap((row) => {
        try {
          return [{
            role: row.role as AgentConfig['role'],
            provider: row.provider as AgentConfig['provider'],
            target: JSON.parse(row.target_json as string) as AgentConfig['target'],
          }]
        } catch {
          return []
        }
      })
    } catch {
      return []
    }
  })

  ipcMain.handle('system:get-diagnostics', async () => {
    return getSystemDiagnostics()
  })

  ipcMain.handle('system:get-models', async () => {
    return getAvailableModels()
  })

  ipcMain.handle('roles:get-definitions', async () => {
    return engine.getRoleConfigs()
  })

  ipcMain.handle('roles:save-definitions', async (_event, definitions: RoleConfig[]) => {
    try {
      const normalized = normalizeRoleConfigs(definitions)
      if (normalized.length === 0) {
        throw new Error('At least one role definition is required')
      }
      persistence.saveRoleDefinitions(normalized as unknown as Array<{ name: string } & Record<string, unknown>>)
      engine.setRoleConfigs(normalized)

      for (const role of normalized) {
        try {
          engine.configureAgent({ role: role.name, provider: fallbackProvider, target: { type: 'local' } })
        } catch { /* ignore missing provider availability */ }
      }

      return { success: true }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })

  // Team config
  ipcMain.handle('teams:get-config', async () => {
    return engine.getTeamConfigs()
  })

  ipcMain.handle('teams:save-config', async (_event, configs: TeamConfig[]) => {
    try {
      engine.setTeamConfigs(configs)
      return { success: true }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })

  // Ensemble result selection
  ipcMain.handle('ensemble:select', async (_event, teamId: TeamId) => {
    try {
      engine.selectTeamResult(teamId)
      return { success: true }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })

  // List workspace files
  ipcMain.handle('workspace:files', async (_event, taskId: string) => {
    try {
      return workspace.listFiles(taskId)
    } catch {
      return []
    }
  })

  // Read a workspace file (taskId + relative path)
  ipcMain.handle('workspace:read-file', async (_event, taskId: string, relativePath: string) => {
    try {
      return workspace.readFile(taskId, relativePath)
    } catch {
      return ''
    }
  })

  // List all workspaces (task history)
  ipcMain.handle('workspace:list', async () => {
    try {
      return workspace.listWorkspaces()
    } catch {
      return []
    }
  })
}

// Helper to broadcast events to all renderer windows
export function broadcastToRenderer(channel: string, ...args: unknown[]): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, ...args)
  }
}

export function getEngine(): OrchestrationEngine {
  return engine
}

export function getPersistence(): Persistence {
  return persistence
}
