import type { RoleConfig, AgentRole } from '../../shared/types'
import { getTeamRoleConfigs } from './team-roles'

export function getDefaultRoleConfigs(): RoleConfig[] {
  return getTeamRoleConfigs()
}

export function normalizeRoleConfigs(configs: RoleConfig[]): RoleConfig[] {
  const seen = new Set<string>()
  const normalized: RoleConfig[] = []

  for (const config of configs) {
    const name = config.name.trim()
    if (!name || seen.has(name)) continue
    seen.add(name)
    normalized.push({
      name,
      displayName: config.displayName?.trim() || name,
      kind: config.kind || 'general',
      teamId: config.teamId,
      teamMemberRole: config.teamMemberRole,
      systemPromptTemplate: config.systemPromptTemplate?.trim() || 'You are an AI assistant.',
      allowedTools: config.allowedTools?.filter(Boolean) || []
    })
  }

  return normalized
}

export function indexRoleConfigs(configs: RoleConfig[]): Record<AgentRole, RoleConfig> {
  return Object.fromEntries(configs.map((config) => [config.name, config]))
}

export function fillPromptTemplate(
  template: string,
  vars: Record<string, string>
): string {
  let result = template
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, value)
  }
  return result
}
