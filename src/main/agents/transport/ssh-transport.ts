import { spawn, type ChildProcess } from 'child_process'
import { existsSync, mkdirSync } from 'fs'
import { dirname } from 'path'
import type { RemoteTarget, TransportProcess } from '../../../shared/types'

function shellEscape(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`
}

function streamToAsyncIterable(stream: NodeJS.ReadableStream): AsyncIterable<string> {
  return (async function* (): AsyncIterable<string> {
    const decoder = new TextDecoder()
    for await (const chunk of stream) {
      yield decoder.decode(chunk as Buffer, { stream: true })
    }
  })()
}

function collectOutput(proc: ChildProcess): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    let stdout = ''
    let stderr = ''

    proc.stdout?.on('data', (chunk: Buffer | string) => {
      stdout += chunk.toString()
    })
    proc.stderr?.on('data', (chunk: Buffer | string) => {
      stderr += chunk.toString()
    })

    proc.on('exit', (code) => {
      resolve({ code: code ?? 1, stdout, stderr })
    })
    proc.on('error', (err) => {
      stderr += String(err)
      resolve({ code: 1, stdout, stderr })
    })
  })
}

export class SSHTransport {
  private config: RemoteTarget

  constructor(config: RemoteTarget) {
    this.config = config
  }

  private getSSHHost(): string {
    const sshHost = this.config.sshHost?.trim() || this.config.host?.trim() || ''
    if (!sshHost) {
      throw new Error('Remote target requires an SSH host alias')
    }
    return sshHost
  }

  private spawnSSH(remoteCommand: string): ChildProcess {
    return spawn('ssh', [this.getSSHHost(), remoteCommand], {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false
    })
  }

  exec(command: string, args: string[], cwd?: string): TransportProcess {
    const fullCommand = cwd
      ? `cd ${shellEscape(cwd)} && ${command} ${args.map(shellEscape).join(' ')}`
      : `${command} ${args.map(shellEscape).join(' ')}`

    const child = this.spawnSSH(fullCommand)

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

  async uploadFile(localPath: string, remotePath: string): Promise<void> {
    const mkdirProc = this.spawnSSH(`mkdir -p ${shellEscape(dirname(remotePath))}`)
    const mkdirResult = await collectOutput(mkdirProc)
    if (mkdirResult.code !== 0) {
      throw new Error(mkdirResult.stderr.trim() || `Failed to prepare remote path ${remotePath}`)
    }

    const scpProc = spawn('scp', [localPath, `${this.getSSHHost()}:${shellEscape(remotePath)}`], {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false
    })
    const result = await collectOutput(scpProc)
    if (result.code !== 0) {
      throw new Error(result.stderr.trim() || `Failed to upload ${localPath}`)
    }
  }

  async downloadFile(remotePath: string, localPath: string): Promise<void> {
    const dir = dirname(localPath)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }

    const scpProc = spawn('scp', [`${this.getSSHHost()}:${shellEscape(remotePath)}`, localPath], {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false
    })
    const result = await collectOutput(scpProc)
    if (result.code !== 0) {
      throw new Error(result.stderr.trim() || `Failed to download ${remotePath}`)
    }
  }

  async listFiles(dirPath: string): Promise<string[]> {
    const proc = this.spawnSSH(`cd ${shellEscape(dirPath)} && find . -type f | sed 's#^\\./##'`)
    const result = await collectOutput(proc)
    if (result.code !== 0) {
      throw new Error(result.stderr.trim() || `Failed to list files in ${dirPath}`)
    }
    return result.stdout
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
  }

  disconnect(): void {
    // No persistent connection to tear down when using the system ssh client.
  }
}
