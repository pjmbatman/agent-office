import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs'
import { join, relative } from 'path'
import { homedir } from 'os'

const WORKSPACES_ROOT = join(homedir(), '.agent-office', 'workspaces')

export class WorkspaceManager {
  constructor() {
    if (!existsSync(WORKSPACES_ROOT)) {
      mkdirSync(WORKSPACES_ROOT, { recursive: true })
    }
  }

  /** Create a new workspace for a task */
  createWorkspace(taskId: string): string {
    const dir = join(WORKSPACES_ROOT, taskId)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    return dir
  }

  /** Get the workspace path for a task */
  getWorkspacePath(taskId: string): string {
    return join(WORKSPACES_ROOT, taskId)
  }

  /** List all files in a workspace (recursive) */
  listFiles(taskId: string): string[] {
    const dir = join(WORKSPACES_ROOT, taskId)
    if (!existsSync(dir)) return []
    return this.listRecursive(dir)
  }

  /** Read a file from a workspace */
  readFile(taskId: string, relativePath: string): string {
    const filePath = join(WORKSPACES_ROOT, taskId, relativePath)
    if (!existsSync(filePath)) return ''
    return readFileSync(filePath, 'utf-8')
  }

  /** Write a file into a workspace */
  writeFile(taskId: string, relativePath: string, content: string): void {
    const workspaceDir = join(WORKSPACES_ROOT, taskId)
    if (!existsSync(workspaceDir)) {
      mkdirSync(workspaceDir, { recursive: true })
    }
    writeFileSync(join(workspaceDir, relativePath), content, 'utf-8')
  }

  /** List all workspaces */
  listWorkspaces(): string[] {
    if (!existsSync(WORKSPACES_ROOT)) return []
    return readdirSync(WORKSPACES_ROOT, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort()
      .reverse()
  }

  private listRecursive(dir: string, base = ''): string[] {
    const results: string[] = []
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const rel = base ? join(base, entry.name) : entry.name
      if (entry.isDirectory()) {
        results.push(...this.listRecursive(join(dir, entry.name), rel))
      } else {
        results.push(rel)
      }
    }
    return results
  }
}
