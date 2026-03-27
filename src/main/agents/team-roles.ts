import type { RoleConfig, TeamId } from '../../shared/types'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

function getPromptsDir(): string {
  const candidates = [
    join(__dirname, '../../prompts'),
    join(process.cwd(), 'prompts'),
    join(__dirname, '../../../prompts'),
  ]

  try {
    const { app } = require('electron')
    candidates.push(join(app.getAppPath(), 'prompts'))
    candidates.push(join(app.getPath('userData'), 'prompts'))
  } catch { /* not in Electron context */ }

  for (const dir of candidates) {
    if (existsSync(dir)) return dir
  }

  return candidates[0]
}

function loadPromptTemplate(filename: string): string {
  const dir = getPromptsDir()
  const path = join(dir, filename)
  if (existsSync(path)) {
    return readFileSync(path, 'utf-8')
  }
  console.warn(`[team-roles] Prompt template not found: ${path}`)
  return 'You are an AI assistant. Follow the user instructions carefully.'
}

function createTeamRoles(teamId: TeamId): RoleConfig[] {
  const prefix = teamId
  const label = teamId === 'alpha' ? 'Alpha' : 'Beta'

  return [
    {
      name: `${prefix}-lead`,
      displayName: `${label} 팀장`,
      kind: 'planner',
      teamId,
      teamMemberRole: 'lead',
      systemPromptTemplate: loadPromptTemplate('team-lead.md'),
      allowedTools: ['Read', 'Glob', 'Grep'],
    },
    {
      name: `${prefix}-senior`,
      displayName: `${label} 선임`,
      kind: 'reviewer',
      teamId,
      teamMemberRole: 'senior',
      systemPromptTemplate: loadPromptTemplate('team-senior.md'),
      allowedTools: ['Read', 'Glob', 'Grep'],
    },
    {
      name: `${prefix}-worker1`,
      displayName: `${label} 사원1`,
      kind: 'general',
      teamId,
      teamMemberRole: 'worker1',
      systemPromptTemplate: loadPromptTemplate('team-worker.md'),
      allowedTools: ['Bash', 'Read', 'Glob', 'Grep', 'Write', 'Edit', 'WebSearch', 'WebFetch'],
    },
    {
      name: `${prefix}-worker2`,
      displayName: `${label} 사원2`,
      kind: 'general',
      teamId,
      teamMemberRole: 'worker2',
      systemPromptTemplate: loadPromptTemplate('team-worker.md'),
      allowedTools: ['Bash', 'Read', 'Glob', 'Grep', 'Write', 'Edit', 'WebSearch', 'WebFetch'],
    },
  ]
}

export function getTeamRoleConfigs(): RoleConfig[] {
  return [
    ...createTeamRoles('alpha'),
    ...createTeamRoles('beta'),
  ]
}
