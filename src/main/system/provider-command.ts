import { spawnSync } from 'child_process'
import { existsSync, readFileSync, realpathSync } from 'fs'
import { delimiter, join } from 'path'
import type { ProviderType } from '../../shared/types'

let cachedCodexCommand: string | null = null

export function resolveLocalProviderCommand(provider: Exclude<ProviderType, 'custom'>): string {
  if (provider === 'codex') {
    return resolveLocalCodexCommand()
  }

  return provider === 'claude-code' ? 'claude' : provider
}

function resolveLocalCodexCommand(): string {
  if (cachedCodexCommand) return cachedCodexCommand

  const candidates = collectCommandCandidates('codex')

  for (const candidate of candidates) {
    if (isOpenAICodexCommand(candidate)) {
      cachedCodexCommand = candidate
      return candidate
    }
  }

  cachedCodexCommand = candidates[0] || 'codex'
  return cachedCodexCommand
}

function collectCommandCandidates(command: string): string[] {
  const candidates = new Set<string>()

  for (const fixed of ['/opt/homebrew/bin/codex', '/usr/local/bin/codex']) {
    if (existsSync(fixed)) {
      candidates.add(fixed)
    }
  }

  const pathValue = process.env.PATH || ''
  for (const dir of pathValue.split(delimiter).filter(Boolean)) {
    const candidate = join(dir, command)
    if (existsSync(candidate)) {
      candidates.add(candidate)
    }
  }

  const shellResult = spawnSync('/bin/bash', ['-lc', `which -a ${shellEscape(command)} 2>/dev/null`], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  })

  for (const line of shellResult.stdout.split('\n').map((item) => item.trim()).filter(Boolean)) {
    if (existsSync(line)) {
      candidates.add(line)
    }
  }

  return [...candidates]
}

function isOpenAICodexCommand(commandPath: string): boolean {
  try {
    const realPath = realpathSync(commandPath)
    const text = readFileSync(realPath, 'utf8')
    return (
      text.includes('Unified entry point for the Codex CLI') ||
      text.includes('@openai/codex') ||
      text.includes('PLATFORM_PACKAGE_BY_TARGET')
    )
  } catch {
    return false
  }
}

function shellEscape(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`
}
