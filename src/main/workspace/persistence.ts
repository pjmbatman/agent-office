import Database from 'better-sqlite3'
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

const DB_DIR = join(homedir(), '.agent-office')
const DB_PATH = join(DB_DIR, 'agent-office.db')

export class Persistence {
  private db: Database.Database

  constructor() {
    if (!existsSync(DB_DIR)) {
      mkdirSync(DB_DIR, { recursive: true })
    }

    this.db = new Database(DB_PATH)
    this.db.pragma('journal_mode = WAL')
    this.initTables()
  }

  private initTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        description TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'idle',
        plan TEXT,
        evaluation_criteria TEXT,
        research TEXT,
        implementation TEXT,
        review_feedback TEXT,
        review_score INTEGER,
        revision_count INTEGER DEFAULT 0,
        artifacts TEXT DEFAULT '[]',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS agent_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id TEXT NOT NULL,
        role TEXT NOT NULL,
        prompt TEXT NOT NULL,
        response TEXT NOT NULL,
        provider TEXT NOT NULL,
        target_type TEXT NOT NULL,
        token_count INTEGER DEFAULT 0,
        duration_ms INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (task_id) REFERENCES tasks(id)
      );

      CREATE TABLE IF NOT EXISTS agent_configs (
        role TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        target_json TEXT NOT NULL,
        custom_config_json TEXT
      );

      CREATE TABLE IF NOT EXISTS role_definitions (
        name TEXT PRIMARY KEY,
        config_json TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_agent_logs_task ON agent_logs(task_id);

      CREATE TABLE IF NOT EXISTS team_configs (
        id TEXT PRIMARY KEY,
        enabled INTEGER NOT NULL DEFAULT 1,
        display_name TEXT NOT NULL,
        provider_options_json TEXT
      );
    `)

    // Migrations for existing databases
    this.migrate()
  }

  private migrate(): void {
    // Add provider_options_json to team_configs if missing
    try {
      const cols = this.db.prepare("PRAGMA table_info(team_configs)").all() as Array<{ name: string }>
      if (cols.length > 0 && !cols.some((c) => c.name === 'provider_options_json')) {
        this.db.exec('ALTER TABLE team_configs ADD COLUMN provider_options_json TEXT')
      }
    } catch { /* table may not exist yet, which is fine */ }
  }

  // ===== Task CRUD =====

  saveTask(task: {
    id: string
    description: string
    status: string
    plan?: string
    evaluationCriteria?: string[]
    research?: string
    implementation?: string
    reviewFeedback?: string
    reviewScore?: number
    revisionCount?: number
    artifacts?: string[]
  }): void {
    const now = Date.now()
    this.db.prepare(`
      INSERT OR REPLACE INTO tasks
        (id, description, status, plan, evaluation_criteria, research,
         implementation, review_feedback, review_score, revision_count,
         artifacts, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      task.id,
      task.description,
      task.status,
      task.plan || null,
      task.evaluationCriteria ? JSON.stringify(task.evaluationCriteria) : null,
      task.research || null,
      task.implementation || null,
      task.reviewFeedback || null,
      task.reviewScore || null,
      task.revisionCount || 0,
      JSON.stringify(task.artifacts || []),
      now,
      now
    )
  }

  getTask(id: string): Record<string, unknown> | null {
    return this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Record<string, unknown> | null
  }

  listTasks(limit = 50): Record<string, unknown>[] {
    return this.db.prepare(
      'SELECT * FROM tasks ORDER BY created_at DESC LIMIT ?'
    ).all(limit) as Record<string, unknown>[]
  }

  // ===== Agent Log =====

  saveAgentLog(log: {
    taskId: string
    role: string
    prompt: string
    response: string
    provider: string
    targetType: string
    tokenCount?: number
    durationMs?: number
  }): void {
    this.db.prepare(`
      INSERT INTO agent_logs (task_id, role, prompt, response, provider, target_type, token_count, duration_ms, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      log.taskId, log.role, log.prompt, log.response,
      log.provider, log.targetType,
      log.tokenCount || 0, log.durationMs || 0,
      Date.now()
    )
  }

  getAgentLogs(taskId: string): Record<string, unknown>[] {
    return this.db.prepare(
      'SELECT * FROM agent_logs WHERE task_id = ? ORDER BY created_at ASC'
    ).all(taskId) as Record<string, unknown>[]
  }

  // ===== Agent Config Persistence =====

  saveAgentConfig(role: string, provider: string, target: unknown, customConfig?: unknown): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO agent_configs (role, provider, target_json, custom_config_json)
      VALUES (?, ?, ?, ?)
    `).run(role, provider, JSON.stringify(target), customConfig ? JSON.stringify(customConfig) : null)
  }

  getAgentConfigs(): Record<string, unknown>[] {
    return this.db.prepare('SELECT * FROM agent_configs').all() as Record<string, unknown>[]
  }

  saveRoleDefinitions(definitions: Array<{ name: string } & Record<string, unknown>>): void {
    const insert = this.db.prepare(`
      INSERT OR REPLACE INTO role_definitions (name, config_json)
      VALUES (?, ?)
    `)

    const clear = this.db.prepare('DELETE FROM role_definitions')
    const transaction = this.db.transaction(() => {
      clear.run()
      for (const definition of definitions) {
        insert.run(definition.name, JSON.stringify(definition))
      }
    })

    transaction()
  }

  getRoleDefinitions(): Record<string, unknown>[] {
    const rows = this.db.prepare('SELECT config_json FROM role_definitions ORDER BY name ASC').all() as Array<{ config_json: string }>
    return rows.flatMap((row) => {
      try {
        return [JSON.parse(row.config_json) as Record<string, unknown>]
      } catch {
        return []
      }
    })
  }

  // ===== Team Config =====

  getTeamConfigs(): Array<{ id: string; enabled: number; display_name: string; provider_options_json: string | null }> {
    return this.db.prepare('SELECT * FROM team_configs ORDER BY id ASC').all() as Array<{ id: string; enabled: number; display_name: string; provider_options_json: string | null }>
  }

  saveTeamConfigs(configs: Array<{ id: string; enabled: boolean; displayName: string; providerOptionsJson?: string }>): void {
    const upsert = this.db.prepare(`
      INSERT OR REPLACE INTO team_configs (id, enabled, display_name, provider_options_json)
      VALUES (?, ?, ?, ?)
    `)
    const transaction = this.db.transaction(() => {
      for (const config of configs) {
        upsert.run(config.id, config.enabled ? 1 : 0, config.displayName, config.providerOptionsJson || null)
      }
    })
    transaction()
  }

  close(): void {
    this.db.close()
  }
}
