import { readdirSync, existsSync, mkdirSync, copyFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { SSHTransport } from './ssh-transport'
import type { ExecutionTarget } from '../../../shared/types'

/** Join paths using POSIX separators (for remote Linux servers) */
function posixJoin(...parts: string[]): string {
  return parts.join('/').replace(/\/+/g, '/')
}

export class FileSync {
  /**
   * Sync workspace files between two execution targets after an agent completes.
   * - local↔local: no-op (same filesystem)
   * - local→remote: SFTP upload changed files
   * - remote→local: SFTP download changed files
   * - remote→remote: download to local temp, then upload to target
   */
  async syncAfterAgent(
    sourceTarget: ExecutionTarget,
    sourceWorkspace: string,
    destTarget: ExecutionTarget,
    destWorkspace: string,
    sshTransports: Map<string, SSHTransport>
  ): Promise<string[]> {
    const syncedFiles: string[] = []

    // local → local: same filesystem, just copy if different paths
    if (sourceTarget.type === 'local' && destTarget.type === 'local') {
      if (sourceWorkspace !== destWorkspace) {
        const files = this.listLocalFilesRecursive(sourceWorkspace)
        for (const file of files) {
          const srcPath = join(sourceWorkspace, file)
          const dstPath = join(destWorkspace, file)
          this.ensureDirForFile(dstPath)
          copyFileSync(srcPath, dstPath)
          syncedFiles.push(file)
        }
      }
      return syncedFiles
    }

    // local → remote: upload
    if (sourceTarget.type === 'local' && destTarget.type === 'remote') {
      const transport = this.getSSHTransport(destTarget, sshTransports)
      const files = this.listLocalFilesRecursive(sourceWorkspace)
      for (const file of files) {
        const localPath = join(sourceWorkspace, file)
        const remotePath = posixJoin(destWorkspace, file)
        await transport.uploadFile(localPath, remotePath)
        syncedFiles.push(file)
      }
      return syncedFiles
    }

    // remote → local: download
    if (sourceTarget.type === 'remote' && destTarget.type === 'local') {
      const transport = this.getSSHTransport(sourceTarget, sshTransports)
      const files = await transport.listFiles(sourceWorkspace)
      for (const file of files) {
        const remotePath = posixJoin(sourceWorkspace, file)
        const localPath = join(destWorkspace, file)
        this.ensureDirForFile(localPath)
        await transport.downloadFile(remotePath, localPath)
        syncedFiles.push(file)
      }
      return syncedFiles
    }

    // remote → remote: relay through local temp
    if (sourceTarget.type === 'remote' && destTarget.type === 'remote') {
      const tmpDir = join(tmpdir(), `agent-office-sync-${Date.now()}`)
      mkdirSync(tmpDir, { recursive: true })

      try {
        const srcTransport = this.getSSHTransport(sourceTarget, sshTransports)
        const dstTransport = this.getSSHTransport(destTarget, sshTransports)

        const files = await srcTransport.listFiles(sourceWorkspace)
        for (const file of files) {
          const remoteSrcPath = posixJoin(sourceWorkspace, file)
          const tmpPath = join(tmpDir, file)
          const remoteDstPath = posixJoin(destWorkspace, file)

          this.ensureDirForFile(tmpPath)
          await srcTransport.downloadFile(remoteSrcPath, tmpPath)
          await dstTransport.uploadFile(tmpPath, remoteDstPath)
          syncedFiles.push(file)
        }
      } finally {
        // Cleanup temp directory (best effort)
        try {
          const { rmSync } = require('fs')
          rmSync(tmpDir, { recursive: true, force: true })
        } catch { /* ignore */ }
      }
      return syncedFiles
    }

    return syncedFiles
  }

  private listLocalFilesRecursive(dir: string, base = ''): string[] {
    if (!existsSync(dir)) return []
    const results: string[] = []
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
      const rel = base ? `${base}/${entry.name}` : entry.name
      if (entry.isDirectory()) {
        results.push(...this.listLocalFilesRecursive(join(dir, entry.name), rel))
      } else {
        results.push(rel)
      }
    }
    return results
  }

  private ensureDirForFile(filePath: string): void {
    // Use both / and path.sep for cross-platform
    const lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf(require('path').sep))
    const dir = filePath.substring(0, lastSlash)
    if (dir && !existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
  }

  private getSSHTransport(
    target: { type: 'remote'; sshHost: string; host?: string },
    transports: Map<string, SSHTransport>
  ): SSHTransport {
    const key = target.sshHost?.trim() || target.host?.trim() || ''
    const transport = transports.get(key)
    if (!transport) throw new Error(`No SSH transport for host: ${key}`)
    return transport
  }
}
