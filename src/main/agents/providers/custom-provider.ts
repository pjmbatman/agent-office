import type { AgentProvider, AgentProcess } from './base-provider'
import type { SpawnConfig } from '../../../shared/types'
import { LocalTransport } from '../transport/local-transport'
import { SSHTransport } from '../transport/ssh-transport'
import { parsePlainTextOutput } from '../output-parser'

export interface CustomProviderConfig {
  /** CLI executable path, e.g. "/usr/local/bin/my-agent" */
  command: string
  /** Argument template. Use {{prompt}} and {{systemPrompt}} as placeholders */
  argTemplate: string[]
}

export class CustomProvider implements AgentProvider {
  readonly name = 'custom'
  private config: CustomProviderConfig

  constructor(config: CustomProviderConfig) {
    this.config = config
  }

  spawn(spawnConfig: SpawnConfig): AgentProcess {
    const args = this.config.argTemplate.map((arg) =>
      arg
        .replace('{{prompt}}', spawnConfig.prompt)
        .replace('{{systemPrompt}}', spawnConfig.role.systemPromptTemplate || '')
        .replace('{{workspace}}', spawnConfig.workspacePath || '')
    )

    const transport = spawnConfig.target.type === 'local'
      ? new LocalTransport()
      : new SSHTransport(spawnConfig.target)

    const proc = transport.exec(this.config.command, args, spawnConfig.workspacePath)

    const output = parsePlainTextOutput(proc.stdout)

    return {
      output,
      stderr: proc.stderr,
      exitCode: proc.exitCode,
      kill: () => proc.kill()
    }
  }
}
