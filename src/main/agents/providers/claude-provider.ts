import type { AgentProvider, AgentProcess } from './base-provider'
import type { SpawnConfig, AgentEvent } from '../../../shared/types'
import { LocalTransport } from '../transport/local-transport'
import { SSHTransport } from '../transport/ssh-transport'
import { parseClaudeStreamJson } from '../output-parser'
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

export class ClaudeProvider implements AgentProvider {
  readonly name = 'claude-code'

  spawn(config: SpawnConfig): AgentProcess {
    const { args, tempFiles } = this.buildArgs(config)

    const transport = config.target.type === 'local'
      ? new LocalTransport()
      : new SSHTransport(config.target)

    const proc = transport.exec('claude', args, config.workspacePath)

    const output = parseClaudeStreamJson(proc.stdout)

    return {
      output,
      stderr: proc.stderr,
      exitCode: proc.exitCode,
      kill: () => {
        proc.kill()
        // Cleanup temp files (best effort)
        for (const f of tempFiles) {
          try { require('fs').unlinkSync(f) } catch { /* ignore */ }
        }
      }
    }
  }

  private buildArgs(config: SpawnConfig): { args: string[]; tempFiles: string[] } {
    const args: string[] = [
      '--print',
      '--output-format', 'stream-json',
      '--verbose'
    ]
    const tempFiles: string[] = []

    // System prompt — write to temp file if long (avoids arg length limits)
    if (config.role.systemPromptTemplate) {
      const sysPrompt = config.role.systemPromptTemplate
      if (sysPrompt.length > 1024) {
        const tmpFile = join(tmpdir(), `agent-office-sysprompt-${Date.now()}.md`)
        mkdirSync(join(tmpdir()), { recursive: true })
        writeFileSync(tmpFile, sysPrompt, 'utf-8')
        args.push('--system-prompt', `$(cat '${tmpFile}')`)
        tempFiles.push(tmpFile)
      } else {
        args.push('--system-prompt', sysPrompt)
      }
    }

    // Allowed tools
    if (config.role.allowedTools && config.role.allowedTools.length > 0) {
      args.push('--allowedTools', config.role.allowedTools.join(','))
    }

    // Provider options
    if (config.providerOptions?.model) {
      args.push('--model', config.providerOptions.model)
    }
    if (config.providerOptions?.maxTurns) {
      args.push('--max-turns', String(config.providerOptions.maxTurns))
    }
    if (config.providerOptions?.extraArgs) {
      args.push(...config.providerOptions.extraArgs)
    }

    // Skip permissions for automated operation
    args.push('--dangerously-skip-permissions')

    // Add workspace directory
    if (config.workspacePath) {
      args.push('--add-dir', config.workspacePath)
    }

    // Separator before prompt (prevents prompt being parsed as flags)
    args.push('--')

    // The prompt itself
    args.push(config.prompt)

    return { args, tempFiles }
  }
}
