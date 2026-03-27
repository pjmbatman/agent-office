import type { AgentProvider, AgentProcess } from './base-provider'
import type { SpawnConfig, TransportProcess, RemoteTarget, AgentEvent } from '../../../shared/types'
import { LocalTransport } from '../transport/local-transport'
import { SSHTransport } from '../transport/ssh-transport'
import { parseCodexJson } from '../output-parser'
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { resolveLocalProviderCommand } from '../../system/provider-command'

export class CodexProvider implements AgentProvider {
  readonly name = 'codex'

  spawn(config: SpawnConfig): AgentProcess {
    if (config.target.type === 'local') {
      return this.spawnLocalDetached(config)
    }

    const args = this.buildArgs(config)
    const proc = this.spawnRemote(config as SpawnConfig & { target: RemoteTarget }, args)

    return {
      output: this.createJsonOutputStream(proc),
      stderr: this.filterStderr(proc.stderr),
      exitCode: proc.exitCode,
      kill: () => proc.kill()
    }
  }

  private spawnLocalDetached(config: SpawnConfig): AgentProcess {
    const fallbackOutputFile = join(
      tmpdir(),
      `agent-office-codex-last-message-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`
    )
    const debugDir = config.workspacePath
      ? join(config.workspacePath, '.agent-office-debug')
      : undefined
    const args = this.buildArgs(config, fallbackOutputFile)
    const runnerConfigFile = this.createRunnerConfig(config, args, fallbackOutputFile, debugDir)
    const runner = this.spawnLocalLauncher(runnerConfigFile)
    const resultPromise = this.waitForLocalRunnerResult(runner, fallbackOutputFile, runnerConfigFile)

    return {
      output: this.createDetachedOutputStream(resultPromise),
      stderr: this.createDetachedStderrStream(resultPromise),
      exitCode: resultPromise.then((result) => result.exitCode ?? 1),
      kill: () => {
        runner.kill()
        this.cleanupFallbackFile(runnerConfigFile)
        this.cleanupFallbackFile(fallbackOutputFile)
      }
    }
  }

  private spawnLocalLauncher(runnerConfigFile: string): TransportProcess {
    const transport = new LocalTransport()
    const nodePath = process.env.NODE || 'node'
    return transport.exec(
      '/bin/bash',
      ['-lc', `${shellEscape(nodePath)} ${shellEscape(getCodexRunnerPath())} ${shellEscape(runnerConfigFile)}`]
    )
  }

  private spawnRemote(config: SpawnConfig & { target: RemoteTarget }, args: string[]): TransportProcess {
    const transport = new SSHTransport(config.target)
    return transport.exec('codex', args, config.workspacePath)
  }

  private buildArgs(config: SpawnConfig, fallbackOutputFile?: string): string[] {
    const args: string[] = ['exec', '--full-auto', '--skip-git-repo-check']

    // Provider options
    if (config.providerOptions?.model) {
      args.push('--model', config.providerOptions.model)
    }
    if (config.providerOptions?.extraArgs) {
      args.push(...config.providerOptions.extraArgs)
    }

    // Combine system prompt + task prompt with clear separator
    const fullPrompt = config.role.systemPromptTemplate
      ? `[System Instructions]\n${config.role.systemPromptTemplate}\n\n[Task]\n${config.prompt}`
      : config.prompt

    if (config.workspacePath) {
      args.push('-C', config.workspacePath)
    }

    if (fallbackOutputFile) {
      args.push('-o', fallbackOutputFile)
    } else {
      args.push('--json')
    }

    args.push(fullPrompt)

    return args
  }

  private createRunnerConfig(
    config: SpawnConfig,
    args: string[],
    fallbackOutputFile: string,
    debugDir?: string
  ): string {
    const configFile = join(
      tmpdir(),
      `agent-office-codex-runner-${Date.now()}-${Math.random().toString(36).slice(2)}.json`
    )

    if (debugDir) {
      mkdirSync(debugDir, { recursive: true })
    }

    writeFileSync(configFile, JSON.stringify({
      command: resolveLocalProviderCommand('codex'),
      cwd: config.workspacePath || process.cwd(),
      args,
      outputFile: fallbackOutputFile,
      debugDir,
    }), 'utf8')

    return configFile
  }

  private createJsonOutputStream(proc: TransportProcess): AsyncIterable<AgentEvent> {
    return parseCodexJson(proc.stdout)
  }

  private async *createDetachedOutputStream(resultPromise: Promise<CodexRunnerResult>): AsyncIterable<AgentEvent> {
    const result = await resultPromise
    const outputText = result.outputText?.trim() || ''

    if (outputText) {
      yield { type: 'text-delta', content: outputText }
      yield { type: 'complete', content: outputText }
      return
    }

    const message = result.error || result.stderr || `Codex runner returned no output (exit code ${result.exitCode ?? 1})`
    yield { type: 'error', content: message }
  }

  private async *createDetachedStderrStream(resultPromise: Promise<CodexRunnerResult>): AsyncIterable<string> {
    const result = await resultPromise
    const stderr = result.stderr?.trim()
    if (stderr) {
      yield stderr
    }
  }

  private async waitForLocalRunnerResult(
    runner: TransportProcess,
    fallbackOutputFile: string,
    runnerConfigFile: string
  ): Promise<CodexRunnerResult> {
    const [stdout, stderr, exitCode] = await Promise.all([
      collectStream(runner.stdout),
      collectStream(runner.stderr),
      runner.exitCode.catch(() => 1),
    ])

    const parsed = parseRunnerResult(stdout)
    const outputText = parsed.outputText?.trim() || this.readFallbackOutput(fallbackOutputFile)
    const filteredStderr = filterStderrText(parsed.stderr || stderr)

    this.cleanupFallbackFile(runnerConfigFile)
    this.cleanupFallbackFile(fallbackOutputFile)

    return {
      ...parsed,
      exitCode: parsed.exitCode ?? exitCode ?? 1,
      outputText,
      stderr: filteredStderr,
      error: outputText ? parsed.error : parsed.error || `Codex runner returned no output (exit code ${parsed.exitCode ?? exitCode ?? 1})`,
    }
  }

  private readFallbackOutput(fallbackOutputFile: string): string {
    try {
      return readFileSync(fallbackOutputFile, 'utf8').trim()
    } catch {
      return ''
    }
  }

  private cleanupFallbackFile(path?: string): void {
    if (!path) return
    try {
      unlinkSync(path)
    } catch {
      // ignore cleanup failures
    }
  }

  private async *filterStderr(lines?: AsyncIterable<string>): AsyncIterable<string> {
    if (!lines) return

    let buffer = ''
    for await (const chunk of lines) {
      buffer += chunk
      const parts = buffer.split('\n')
      buffer = parts.pop() || ''

      for (const line of parts) {
        if (isIgnorableCodexWarning(line)) continue
        if (!line.trim()) continue
        yield `${line}\n`
      }
    }

    if (buffer.trim() && !isIgnorableCodexWarning(buffer.trim())) {
      yield buffer
    }
  }
}

interface CodexRunnerResult {
  exitCode?: number
  outputText?: string
  stderr?: string
  error?: string
}

function parseRunnerResult(stdout: string): CodexRunnerResult {
  const trimmed = stdout.trim()
  if (!trimmed) return {}

  try {
    return JSON.parse(trimmed) as CodexRunnerResult
  } catch {
    return { error: trimmed }
  }
}

async function collectStream(stream: AsyncIterable<string>): Promise<string> {
  let text = ''
  for await (const chunk of stream) {
    text += chunk
  }
  return text
}

function getCodexRunnerPath(): string {
  const candidates = [
    join(__dirname, '../../scripts/codex-runner.mjs'),
    join(process.cwd(), 'scripts/codex-runner.mjs'),
  ]

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }

  return candidates[candidates.length - 1]
}

function shellEscape(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`
}

function isIgnorableCodexWarning(line: string): boolean {
  return (
    line.includes("Accessing non-existent property 'lineno' of module exports inside circular dependency") ||
    line.includes("Accessing non-existent property 'filename' of module exports inside circular dependency") ||
    line.includes('(Use `node --trace-warnings ...` to show where the warning was created)')
  )
}

function filterStderrText(stderr: string): string {
  if (!stderr) return ''

  return stderr
    .split('\n')
    .filter((line) => line.trim() && !isIgnorableCodexWarning(line.trim()))
    .join('\n')
}
