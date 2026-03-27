import { spawnSync } from 'child_process'
import type { ExecutionTarget, ProviderType, RemoteTarget } from '../../shared/types'
import { resolveLocalProviderCommand } from './provider-command'

export type ProviderRuntimeStatus = 'ready' | 'needs-setup' | 'not-installed'

export interface ProviderDiagnostic {
  provider: ProviderType
  status: ProviderRuntimeStatus
  available: boolean
  command?: string
  reason?: string
  detail?: string
  setupCommand?: string
}

export interface SystemDiagnostics {
  providers: ProviderDiagnostic[]
  preferredProvider: Exclude<ProviderType, 'custom'> | null
}

const BUILT_IN_PROVIDER_CONFIG: Record<Exclude<ProviderType, 'custom'>, {
  command: string
  statusArgs: string[]
}> = {
  'claude-code': {
    command: 'claude',
    statusArgs: ['auth', 'status']
  },
  codex: {
    command: 'codex',
    statusArgs: ['login', 'status']
  }
}

function commandExists(command: string): boolean {
  return spawnSync('/bin/bash', ['-lc', `command -v ${command}`], {
    encoding: 'utf8',
    stdio: 'ignore'
  }).status === 0
}

function runStatusCommand(command: string, args: string[]): { ok: boolean; detail?: string } {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    timeout: 5000,
  })

  const detail = [result.stdout, result.stderr].filter(Boolean).join('\n').trim() || undefined
  return {
    ok: result.status === 0,
    detail,
  }
}

function runRemoteShell(sshHost: string, script: string): { ok: boolean; detail?: string } {
  const result = spawnSync('ssh', [sshHost, script], {
    encoding: 'utf8',
    timeout: 5000,
  })

  const detail = [result.stdout, result.stderr].filter(Boolean).join('\n').trim() || undefined
  return {
    ok: result.status === 0,
    detail,
  }
}

function getRemoteSSHHost(target: RemoteTarget): string | null {
  const sshHost = target.sshHost?.trim() || target.host?.trim() || ''
  return sshHost || null
}

function isSSHFailure(detail?: string): boolean {
  return /could not resolve hostname|permission denied|operation timed out|connection timed out|connection refused|no route to host|network is unreachable|bad configuration option|too many authentication failures|connection closed/i.test(detail || '')
}

function isReady(provider: Exclude<ProviderType, 'custom'>, status: { ok: boolean; detail?: string }): boolean {
  const detail = (status.detail || '').trim()

  if (provider === 'claude-code') {
    if (detail.startsWith('{')) {
      try {
        const parsed = JSON.parse(detail) as { loggedIn?: boolean }
        if (typeof parsed.loggedIn === 'boolean') {
          return parsed.loggedIn
        }
      } catch {
        // fall through to exit-code based detection
      }
    }

    return status.ok && !/not logged|logged out/i.test(detail)
  }

  return status.ok && !/not logged|logged out/i.test(detail)
}

function getBuiltInDiagnostic(
  provider: Exclude<ProviderType, 'custom'>,
  command: string,
  statusArgs: string[]
): ProviderDiagnostic {
  if (!commandExists(command)) {
    return {
      provider,
      status: 'not-installed',
      available: false,
      command,
      setupCommand: command,
      reason: `\`${command}\` CLI is not installed`
    }
  }

  const status = runStatusCommand(command, statusArgs)
  if (isReady(provider, status)) {
    return {
      provider,
      status: 'ready',
      available: true,
      command,
      setupCommand: command,
      reason: `${command} CLI is ready`,
      detail: status.detail,
    }
  }

  return {
    provider,
    status: 'needs-setup',
    available: false,
    command,
    setupCommand: command,
    reason: `Run \`${command}\` in the setup terminal and complete login first`,
    detail: status.detail,
  }
}

function getRemoteBuiltInDiagnostic(
  provider: Exclude<ProviderType, 'custom'>,
  command: string,
  statusArgs: string[],
  target: RemoteTarget
): ProviderDiagnostic {
  const sshHost = getRemoteSSHHost(target)
  if (!sshHost) {
    return {
      provider,
      status: 'needs-setup',
      available: false,
      command,
      setupCommand: `ssh <alias> -t ${command}`,
      reason: 'Remote target requires an SSH host alias'
    }
  }

  const installCheck = runRemoteShell(sshHost, `command -v ${command}`)
  if (!installCheck.ok) {
    if (isSSHFailure(installCheck.detail)) {
      return {
        provider,
        status: 'needs-setup',
        available: false,
        command,
        setupCommand: `ssh ${sshHost} -t ${command}`,
        reason: `Cannot connect to SSH host alias \`${sshHost}\``,
        detail: installCheck.detail,
      }
    }

    return {
      provider,
      status: 'not-installed',
      available: false,
      command,
      setupCommand: `ssh ${sshHost} -t ${command}`,
      reason: `\`${command}\` CLI is not installed on \`${sshHost}\``,
      detail: installCheck.detail,
    }
  }

  const status = runRemoteShell(sshHost, `${command} ${statusArgs.join(' ')}`)
  if (isSSHFailure(status.detail)) {
    return {
      provider,
      status: 'needs-setup',
      available: false,
      command,
      setupCommand: `ssh ${sshHost} -t ${command}`,
      reason: `Cannot connect to SSH host alias \`${sshHost}\``,
      detail: status.detail,
    }
  }

  if (isReady(provider, status)) {
    return {
      provider,
      status: 'ready',
      available: true,
      command,
      setupCommand: `ssh ${sshHost} -t ${command}`,
      reason: `${command} CLI is ready on \`${sshHost}\``,
      detail: status.detail,
    }
  }

  return {
    provider,
    status: 'needs-setup',
    available: false,
    command,
    setupCommand: `ssh ${sshHost} -t ${command}`,
    reason: `Run \`ssh ${sshHost}\`, then \`${command}\` and complete login`,
    detail: status.detail,
  }
}

export function checkProviderReadiness(provider: ProviderType, target?: ExecutionTarget): ProviderDiagnostic {
  if (provider === 'custom') {
    return {
      provider: 'custom',
      status: 'ready',
      available: true,
      reason: 'Custom providers are configured manually'
    }
  }

  const config = BUILT_IN_PROVIDER_CONFIG[provider]
  if (!target || target.type === 'local') {
    return getBuiltInDiagnostic(provider, resolveLocalProviderCommand(provider), config.statusArgs)
  }

  return getRemoteBuiltInDiagnostic(provider, config.command, config.statusArgs, target)
}

export function getSystemDiagnostics(): SystemDiagnostics {
  const claudeDiagnostic = checkProviderReadiness('claude-code')
  const codexDiagnostic = checkProviderReadiness('codex')

  const providers: ProviderDiagnostic[] = [
    claudeDiagnostic,
    codexDiagnostic,
    {
      provider: 'custom',
      status: 'ready',
      available: true,
      reason: 'Custom providers are configured manually'
    }
  ]

  return {
    providers,
    preferredProvider: claudeDiagnostic.available ? 'claude-code' : codexDiagnostic.available ? 'codex' : null
  }
}

export function isProviderAvailable(provider: ProviderType): boolean {
  if (provider === 'custom') return true
  return getSystemDiagnostics().providers.some((item) => item.provider === provider && item.available)
}

export interface ModelOption {
  id: string
  label: string
  provider: ProviderType
}

export function getAvailableModels(): ModelOption[] {
  return []
}
