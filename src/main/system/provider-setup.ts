import { spawn } from 'child_process'
import type { ProviderType, ExecutionTarget, RemoteTarget } from '../../shared/types'
import { resolveLocalProviderCommand } from './provider-command'

const SETUP_COMMANDS: Record<Exclude<ProviderType, 'custom'>, string> = {
  'claude-code': 'claude',
  codex: 'codex'
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function tryDetachedSpawn(command: string, args: string[]): boolean {
  try {
    const child = spawn(command, args, {
      detached: true,
      stdio: 'ignore'
    })
    child.unref()
    return true
  } catch {
    return false
  }
}

function openMacTerminal(shellCommand: string): void {
  const script = [
    'tell application "Terminal"',
    'activate',
    `do script ${JSON.stringify(shellCommand)}`,
    'end tell'
  ].join('\n')

  if (!tryDetachedSpawn('osascript', ['-e', script])) {
    throw new Error('Failed to open Terminal.app for provider setup')
  }
}

function openLinuxTerminal(shellCommand: string): void {
  const candidates: Array<{ command: string; args: string[] }> = [
    { command: 'x-terminal-emulator', args: ['-e', 'bash', '-lc', shellCommand] },
    { command: 'gnome-terminal', args: ['--', 'bash', '-lc', shellCommand] },
    { command: 'konsole', args: ['-e', 'bash', '-lc', shellCommand] },
  ]

  for (const candidate of candidates) {
    if (tryDetachedSpawn(candidate.command, candidate.args)) return
  }

  throw new Error('Failed to open a setup terminal on this Linux system')
}

function openWindowsTerminal(shellCommand: string): void {
  if (!tryDetachedSpawn('cmd.exe', ['/c', 'start', 'powershell', '-NoExit', '-Command', shellCommand])) {
    throw new Error('Failed to open a PowerShell setup terminal')
  }
}

function buildLocalSetupCommand(command: string, cwd: string): string {
  return [
    `cd ${shellQuote(cwd)}`,
    'clear',
    `printf '%s\n' 'Agent Office opened this terminal for provider setup.'`,
    `printf '%s\n' 'Complete login or configuration here, then return to the app and refresh provider status.'`,
    command,
  ].join('; ')
}

function buildRemoteSetupCommand(command: string, target: RemoteTarget): string {
  const sshHost = target.sshHost?.trim() || target.host?.trim() || ''
  if (!sshHost) {
    throw new Error('Remote target requires an SSH host alias')
  }

  const remoteCommand = [
    `cd ${shellQuote(target.remoteWorkspacePath)}`,
    'clear',
    `printf '%s\n' 'Agent Office connected here for provider setup.'`,
    `printf '%s\n' 'Complete login or configuration here, then return to the app and refresh provider status.'`,
    command,
  ].join('; ')

  const sshCommand = [
    'ssh',
    '-t',
    shellQuote(sshHost),
    shellQuote(remoteCommand)
  ].join(' ')

  return [
    'clear',
    `printf '%s\n' 'Agent Office opened a remote setup terminal.'`,
    `printf '%s\n' 'If SSH prompts for a password or passphrase, complete it here.'`,
    sshCommand,
  ].join('; ')
}

export function openProviderSetupTerminal(provider: ProviderType, target?: ExecutionTarget): void {
  if (provider === 'custom') {
    throw new Error('Custom providers must be configured manually')
  }

  const command = !target || target.type === 'local'
    ? resolveLocalProviderCommand(provider)
    : SETUP_COMMANDS[provider]
  const cwd = process.env.HOME || process.cwd()
  const shellCommand = !target || target.type === 'local'
    ? buildLocalSetupCommand(command, cwd)
    : buildRemoteSetupCommand(command, target)

  if (process.platform === 'darwin') {
    openMacTerminal(shellCommand)
    return
  }

  if (process.platform === 'linux') {
    openLinuxTerminal(shellCommand)
    return
  }

  if (process.platform === 'win32') {
    openWindowsTerminal(shellCommand)
    return
  }

  throw new Error(`Provider setup terminal is not supported on ${process.platform}`)
}
