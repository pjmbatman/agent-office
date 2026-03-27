import type { SpawnConfig, AgentEvent } from '../../../shared/types'

export interface AgentProcess {
  /** Async iterable of normalized agent events */
  output: AsyncIterable<AgentEvent>
  /** Raw stderr stream for execution diagnostics */
  stderr?: AsyncIterable<string>
  /** Process exit code */
  exitCode: Promise<number>
  /** Kill the underlying process */
  kill: () => void
}

export interface AgentProvider {
  readonly name: string
  spawn(config: SpawnConfig): AgentProcess
}
