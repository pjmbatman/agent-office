import { spawn, spawnSync, ChildProcess } from 'child_process'
import { isAbsolute } from 'path'
import type { TransportProcess } from '../../../shared/types'

export class LocalTransport {
  exec(command: string, args: string[], cwd?: string): TransportProcess {
    const resolvedCommand = resolveLocalCommand(command)
    const child: ChildProcess = spawn(resolvedCommand, args, {
      cwd,
      env: createChildEnv(),
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false
    })

    return {
      stdout: streamToAsyncIterable(child.stdout!),
      stderr: streamToAsyncIterable(child.stderr!),
      kill: () => child.kill('SIGTERM'),
      exitCode: new Promise<number>((resolve) => {
        child.on('exit', (code) => resolve(code ?? 1))
        child.on('error', () => resolve(1))
      })
    }
  }
}

function resolveLocalCommand(command: string): string {
  if (isAbsolute(command)) return command

  const result = spawnSync('/bin/bash', ['-lc', `command -v ${shellEscape(command)}`], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore']
  })

  const resolved = result.stdout.trim()
  return result.status === 0 && resolved ? resolved : command
}

function shellEscape(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`
}

function createChildEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env }

  for (const key of Object.keys(env)) {
    if (
      key.startsWith('ELECTRON_') ||
      key.startsWith('npm_') ||
      key.startsWith('VITE_')
    ) {
      delete env[key]
    }
  }

  delete env.NODE_ENV
  delete env.NODE_ENV_ELECTRON_VITE
  delete env.NODE_OPTIONS
  delete env.INIT_CWD

  return env
}

async function* streamToAsyncIterable(stream: NodeJS.ReadableStream): AsyncIterable<string> {
  const decoder = new TextDecoder()
  for await (const chunk of stream) {
    yield decoder.decode(chunk as Buffer, { stream: true })
  }
}
