import React, { useEffect, useMemo, useState } from 'react'
import type { AgentRole, ProviderType, ExecutionTarget, RoleConfig, RoleKind, TeamConfig, TeamId } from '../../shared/types'
import { useLocaleStore, useT, type Locale } from '../i18n'
import { getAgentOffice } from '../lib/agent-office'

interface AgentSetting {
  role: AgentRole
  provider: ProviderType
  targetType: 'local' | 'remote'
  sshHost: string
  remoteWorkspacePath: string
}

interface ProviderRuntimeState {
  available: boolean
  status: 'ready' | 'needs-setup' | 'not-installed'
  command?: string
  reason?: string
  detail?: string
  setupCommand?: string
}

const DEFAULT_PROVIDER_AVAILABILITY: Record<ProviderType, ProviderRuntimeState> = {
  'claude-code': {
    available: false,
    status: 'not-installed',
    command: 'claude',
    setupCommand: 'claude',
    reason: '`claude` CLI is not installed'
  },
  codex: {
    available: false,
    status: 'not-installed',
    command: 'codex',
    setupCommand: 'codex',
    reason: '`codex` CLI is not installed'
  },
  custom: {
    available: true,
    status: 'ready',
    reason: 'Custom providers are configured manually'
  }
}

const BUILT_IN_PROVIDERS: Array<Exclude<ProviderType, 'custom'>> = ['claude-code', 'codex']

const EMPTY_ROLE_TEMPLATE: RoleConfig = {
  name: 'new-role',
  displayName: '새 역할',
  kind: 'general',
  systemPromptTemplate: 'You are a helpful AI assistant.',
  allowedTools: ['Read', 'Glob', 'Grep']
}

function toSetting(target: ExecutionTarget | undefined, role: AgentRole, provider: ProviderType): AgentSetting {
  if (!target || target.type === 'local') {
    return {
      role,
      provider,
      targetType: 'local',
      sshHost: '',
      remoteWorkspacePath: ''
    }
  }

  return {
    role,
    provider,
    targetType: 'remote',
    sshHost: target.sshHost || target.host || '',
    remoteWorkspacePath: target.remoteWorkspacePath
  }
}

function toExecutionTarget(setting: AgentSetting | undefined): ExecutionTarget {
  if (!setting || setting.targetType === 'local') {
    return { type: 'local' }
  }

  return {
    type: 'remote',
    sshHost: setting.sshHost.trim(),
    remoteWorkspacePath: setting.remoteWorkspacePath.trim()
  }
}

function getProviderLabel(provider: ProviderType): string {
  if (provider === 'claude-code') return 'Claude Code'
  if (provider === 'codex') return 'Codex'
  return 'Custom'
}

function getProviderStatusLabel(status: ProviderRuntimeState['status']): string {
  if (status === 'ready') return 'Ready'
  if (status === 'needs-setup') return 'Needs setup'
  return 'Not installed'
}

function getProviderStatusColor(status: ProviderRuntimeState['status']): string {
  if (status === 'ready') return 'rgba(46, 204, 113, 0.18)'
  if (status === 'needs-setup') return 'rgba(241, 196, 15, 0.18)'
  return 'rgba(231, 76, 60, 0.18)'
}

interface SettingsPanelProps {
  onClose: () => void
}

export default function SettingsPanel({ onClose }: SettingsPanelProps): React.ReactElement {
  const t = useT()
  const locale = useLocaleStore((s) => s.locale)
  const setLocale = useLocaleStore((s) => s.setLocale)
  const [roles, setRoles] = useState<RoleConfig[]>([])
  const [settings, setSettings] = useState<Record<string, AgentSetting>>({})
  const [teamConfigs, setTeamConfigs] = useState<TeamConfig[]>([
    { id: 'alpha', enabled: true, displayName: 'Team Alpha' },
    { id: 'beta', enabled: true, displayName: 'Team Beta' },
  ])
  const [status, setStatus] = useState<string>('')
  const [isSaving, setIsSaving] = useState(false)
  const [providerAvailability, setProviderAvailability] = useState<Record<ProviderType, ProviderRuntimeState>>(DEFAULT_PROVIDER_AVAILABILITY)
  const [teamProviderStatus, setTeamProviderStatus] = useState<Partial<Record<TeamId, ProviderRuntimeState>>>({})

  useEffect(() => {
    let active = true
    Promise.all([
      getAgentOffice().getSystemDiagnostics(),
      getAgentOffice().getRoleDefinitions(),
      getAgentOffice().getAgentConfigs(),
      getAgentOffice().getTeamConfigs(),
    ]).then(([diagnostics, roleDefinitions, configs, teams]) => {
      if (!active) return

      const availability = diagnostics.providers.reduce((acc, item) => {
        acc[item.provider] = {
          available: item.available,
          status: item.status,
          command: item.command,
          reason: item.reason,
          detail: item.detail,
          setupCommand: item.setupCommand
        }
        return acc
      }, { ...DEFAULT_PROVIDER_AVAILABILITY } as Record<ProviderType, ProviderRuntimeState>)
      setProviderAvailability(availability)

      const loadedRoles = roleDefinitions.length > 0 ? roleDefinitions : [EMPTY_ROLE_TEMPLATE]
      setRoles(loadedRoles)

      const configMap = new Map(configs.map((config) => [config.role, config]))
      const preferredProvider: ProviderType = diagnostics.preferredProvider
        || (availability['claude-code'].available ? 'claude-code' : availability.codex.available ? 'codex' : 'custom')
      const nextSettings: Record<string, AgentSetting> = {}
      for (const role of loadedRoles) {
        const config = configMap.get(role.name)
        const provider = config && availability[config.provider]?.available ? config.provider : preferredProvider
        nextSettings[role.name] = toSetting(config?.target, role.name, provider)
      }
      setSettings(nextSettings)

      const activeTeams = teams && teams.length > 0 ? teams : teamConfigs
      if (teams && teams.length > 0) {
        setTeamConfigs(teams)
      }
      void refreshAllTeamProviderStatuses(loadedRoles, nextSettings, activeTeams, preferredProvider)
    }).catch((err) => {
      if (active) setStatus(err instanceof Error ? err.message : 'Failed to load settings')
    })

    return () => {
      active = false
    }
  }, [])

  const roleKinds: RoleKind[] = ['planner', 'researcher', 'implementer', 'reviewer', 'general']

  const orderedRoles = useMemo(() => [...roles].sort((a, b) => a.name.localeCompare(b.name)), [roles])
  const defaultProvider: ProviderType = providerAvailability['claude-code'].available
    ? 'claude-code'
    : providerAvailability.codex.available
      ? 'codex'
      : 'custom'

  const refreshDiagnostics = async () => {
    const diagnostics = await getAgentOffice().getSystemDiagnostics()
    const availability = diagnostics.providers.reduce((acc, item) => {
      acc[item.provider] = {
        available: item.available,
        status: item.status,
        command: item.command,
        reason: item.reason,
        detail: item.detail,
        setupCommand: item.setupCommand
      }
      return acc
    }, { ...DEFAULT_PROVIDER_AVAILABILITY } as Record<ProviderType, ProviderRuntimeState>)
    setProviderAvailability(availability)
  }

  const refreshTeamProviderStatus = async (
    teamId: TeamId,
    provider: ProviderType,
    target: ExecutionTarget
  ) => {
    const readiness = await getAgentOffice().checkProviderReadiness(provider, target)
    setTeamProviderStatus((prev) => ({
      ...prev,
      [teamId]: {
        available: readiness.available,
        status: readiness.status,
        command: readiness.command,
        reason: readiness.reason,
        detail: readiness.detail,
        setupCommand: readiness.setupCommand
      }
    }))
  }

  const refreshAllTeamProviderStatuses = async (
    roleList: RoleConfig[],
    settingMap: Record<string, AgentSetting>,
    teams: TeamConfig[],
    fallbackProvider: ProviderType
  ) => {
    const results = await Promise.all(teams.map(async (team) => {
      const teamRoleNames = roleList.filter((r) => r.name.startsWith(team.id + '-')).map((r) => r.name)
      const teamPrimarySetting = teamRoleNames.length > 0 ? settingMap[teamRoleNames[0]] : undefined
      const provider = teamPrimarySetting?.provider || fallbackProvider
      const target = toExecutionTarget(teamPrimarySetting)
      const readiness = await getAgentOffice().checkProviderReadiness(provider, target)
      return [team.id, {
        available: readiness.available,
        status: readiness.status,
        command: readiness.command,
        reason: readiness.reason,
        detail: readiness.detail,
        setupCommand: readiness.setupCommand
      }] as const
    }))

    setTeamProviderStatus(Object.fromEntries(results) as Partial<Record<TeamId, ProviderRuntimeState>>)
  }

  const openProviderSetup = async (provider: Exclude<ProviderType, 'custom'>, target?: ExecutionTarget) => {
    const result = await getAgentOffice().openProviderSetupTerminal(provider, target)
    if (!result.success) {
      throw new Error(result.error || `Failed to open ${getProviderLabel(provider)} setup terminal`)
    }
  }

  const updateRole = (index: number, patch: Partial<RoleConfig>) => {
    setRoles((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], ...patch }
      return next
    })
  }

  const addRole = () => {
    const id = `role-${roles.length + 1}`
    setRoles((prev) => [...prev, { ...EMPTY_ROLE_TEMPLATE, name: id, displayName: `Role ${prev.length + 1}` }])
    setSettings((prev) => ({
      ...prev,
      [id]: toSetting(undefined, id, defaultProvider)
    }))
  }

  const removeRole = (roleName: string) => {
    setRoles((prev) => prev.filter((role) => role.name !== roleName))
    setSettings((prev) => {
      const next = { ...prev }
      delete next[roleName]
      return next
    })
  }

  const updateSetting = (role: string, field: keyof AgentSetting, value: string) => {
    setSettings((prev) => ({
      ...prev,
      [role]: {
        ...(prev[role] || toSetting(undefined, role, defaultProvider)),
        [field]: value
      }
    }))
  }

  const handleSave = async () => {
    setStatus('')
    setIsSaving(true)

    try {
      const normalizedRoles = roles.map((role) => ({
        ...role,
        name: role.name.trim(),
        displayName: role.displayName.trim(),
        systemPromptTemplate: role.systemPromptTemplate.trim(),
        allowedTools: role.allowedTools?.filter(Boolean) || []
      }))

      if (normalizedRoles.length === 0) {
        throw new Error('At least one role is required')
      }
      if (new Set(normalizedRoles.map((role) => role.name)).size !== normalizedRoles.length) {
        throw new Error('Role names must be unique')
      }
      if (!normalizedRoles.some((role) => role.kind === 'planner')) {
        throw new Error('At least one planner role is required')
      }

      // Save team configs (includes providerOptions)
      await getAgentOffice().saveTeamConfigs(teamConfigs)

      const saveRoles = await getAgentOffice().saveRoleDefinitions(normalizedRoles)
      if (!saveRoles.success) {
        throw new Error(saveRoles.error || 'Failed to save role definitions')
      }

      // Configure each role's provider/target based on team settings
      for (const role of normalizedRoles) {
        const setting = settings[role.name] || toSetting(undefined, role.name, defaultProvider)
        // Find which team this role belongs to
        const teamConfig = teamConfigs.find((tc) => role.name.startsWith(tc.id + '-'))

        const target = setting.targetType === 'local'
          ? { type: 'local' as const }
          : {
              type: 'remote' as const,
              sshHost: setting.sshHost.trim(),
              remoteWorkspacePath: setting.remoteWorkspacePath.trim()
            }

        if (setting.provider !== 'custom') {
          const readiness = await getAgentOffice().checkProviderReadiness(setting.provider, target)
          if (!readiness.available) {
            const targetLabel = target.type === 'remote'
              ? `SSH target ${target.sshHost || 'remote'}`
              : 'local target'
            throw new Error(`${getProviderLabel(setting.provider)} is not ready on ${targetLabel}. ${readiness.reason || 'Open Setup Terminal and complete login first.'}`)
          }
        }

        const result = await getAgentOffice().configureAgent({
          role: role.name,
          provider: setting.provider,
          target,
          providerOptions: teamConfig?.providerOptions,
        })

        if (!result.success) {
          throw new Error(result.error || `Failed to configure ${role.name}`)
        }
      }

      onClose()
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Failed to save settings')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div
      className="animate-fade-in"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="animate-slide-up"
        style={{
          background: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-xl)',
          padding: 'var(--space-6)',
          width: 'min(960px, 92vw)',
          maxHeight: '88vh',
          overflowY: 'auto',
          border: '1px solid var(--border-default)',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
          <div>
            <h2 style={{ fontSize: 'var(--font-xl)', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
              {t('settings.title')}
            </h2>
            <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
              Role definitions and agent runtime configuration
            </p>
          </div>
          <button onClick={onClose} style={closeButtonStyle}>×</button>
        </div>

        <Section title={t('settings.system')}>
          <div style={{ display: 'grid', gap: '10px', marginBottom: '16px' }}>
            {BUILT_IN_PROVIDERS.map((provider) => {
              const info = providerAvailability[provider]
              return (
                <div
                  key={provider}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-subtle)',
                    background: 'rgba(16, 32, 38, 0.72)'
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Local {getProviderLabel(provider)}
                    </div>
                    <div style={{ marginTop: '4px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {info.reason || 'Provider status unknown'}
                    </div>
                    {info.detail && info.status !== 'ready' && (
                      <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
                        {info.detail}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <span
                      style={{
                        padding: '6px 10px',
                        borderRadius: '999px',
                        background: getProviderStatusColor(info.status),
                        color: 'var(--text-primary)',
                        fontSize: '11px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em'
                      }}
                    >
                      {getProviderStatusLabel(info.status)}
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await openProviderSetup(provider)
                          setStatus(`${getProviderLabel(provider)} local setup terminal opened`)
                        } catch (err) {
                          setStatus(err instanceof Error ? err.message : `Failed to open ${getProviderLabel(provider)} setup terminal`)
                        }
                      }}
                      style={{
                        borderRadius: '8px',
                        border: '1px solid var(--border-subtle)',
                        background: 'rgba(255, 255, 255, 0.04)',
                        color: 'var(--text-primary)',
                        padding: '8px 10px',
                        cursor: 'pointer'
                      }}
                    >
                      Open Local Setup Terminal
                    </button>
                  </div>
                </div>
              )
            })}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await refreshDiagnostics()
                  } catch (err) {
                    setStatus(err instanceof Error ? err.message : 'Failed to refresh provider status')
                  }
                }}
                style={{
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle)',
                  background: 'rgba(255, 255, 255, 0.04)',
                  color: 'var(--text-primary)',
                  padding: '8px 10px',
                  cursor: 'pointer'
                }}
              >
                Refresh Provider Status
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 'var(--font-sm)', color: 'var(--text-primary)', fontWeight: 500 }}>
                {t('settings.language')}
              </div>
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', marginTop: '2px' }}>
                {t('settings.languageDesc')}
              </div>
            </div>
            <div style={{ display: 'flex', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', overflow: 'hidden' }}>
              {([
                { key: 'ko' as Locale, label: '한국어' },
                { key: 'en' as Locale, label: 'English' },
              ]).map((lang) => (
                <button
                  key={lang.key}
                  onClick={() => setLocale(lang.key)}
                  style={{
                    padding: '6px 16px',
                    border: 'none',
                    background: locale === lang.key ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                    color: locale === lang.key ? '#fff' : 'var(--text-tertiary)',
                    fontSize: 'var(--font-sm)',
                    cursor: 'pointer',
                  }}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>
        </Section>

        <Section title="Team Configuration">
          <div style={{ display: 'flex', gap: '16px' }}>
            {teamConfigs.map((team) => {
              const teamRoleNames = roles.filter((r) => r.name.startsWith(team.id + '-')).map((r) => r.name)
              const teamPrimarySetting = teamRoleNames.length > 0 ? settings[teamRoleNames[0]] : undefined
              const teamProvider = teamPrimarySetting?.provider || defaultProvider
              const teamTargetType = teamPrimarySetting?.targetType || 'local'
              const teamExecutionTarget = toExecutionTarget(teamPrimarySetting)
              const teamRuntimeInfo = teamProviderStatus[team.id] || DEFAULT_PROVIDER_AVAILABILITY[teamProvider]
              const teamSetupDisabled = teamProvider === 'custom'
                || (teamTargetType === 'remote' && (!teamPrimarySetting?.sshHost.trim() || !teamPrimarySetting?.remoteWorkspacePath.trim()))
              const teamSetupDescription = teamTargetType === 'remote'
                ? `${teamPrimarySetting?.sshHost || 'ssh-alias'}:${teamPrimarySetting?.remoteWorkspacePath || '~'}`
                : 'Uses the local shell environment on this machine'

              return (
                <div key={team.id} style={{
                  flex: 1,
                  padding: 'var(--space-3)',
                  borderRadius: 'var(--radius-lg)',
                  background: team.enabled ? 'rgba(81,191,173,0.06)' : 'var(--bg-secondary)',
                  border: `1px solid ${team.enabled ? 'rgba(81,191,173,0.2)' : 'var(--border-subtle)'}`,
                  opacity: team.enabled ? 1 : 0.5,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <div style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {team.displayName}
                    </div>
                    <button
                      onClick={() => {
                        const updated = teamConfigs.map((tc) =>
                          tc.id === team.id ? { ...tc, enabled: !tc.enabled } : tc
                        )
                        if (!updated.some((tc) => tc.enabled)) return
                        setTeamConfigs(updated)
                      }}
                      style={{
                        padding: '4px 12px',
                        borderRadius: 'var(--radius-md)',
                        border: 'none',
                        background: team.enabled ? 'var(--accent-primary)' : 'var(--bg-elevated)',
                        color: team.enabled ? '#fff' : 'var(--text-muted)',
                        fontSize: 'var(--font-xs)',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      {team.enabled ? t('team.enabled' as any) : t('team.disabled' as any)}
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <SettingsField label={t('settings.provider')}>
                      <StyledSelect
                        value={teamProvider}
                        onChange={(e) => {
                          const provider = e.target.value as ProviderType
                          setSettings((prev) => {
                            const next = { ...prev }
                            for (const name of teamRoleNames) {
                              next[name] = { ...(next[name] || toSetting(undefined, name, provider)), provider }
                            }
                            return next
                          })
                        }}
                        options={[
                          { value: 'claude-code', label: `Claude Code (${getProviderStatusLabel(providerAvailability['claude-code'].status)})`, disabled: !providerAvailability['claude-code'].available },
                          { value: 'codex', label: `Codex (${getProviderStatusLabel(providerAvailability['codex'].status)})`, disabled: !providerAvailability['codex'].available },
                          { value: 'custom', label: 'Custom' },
                        ]}
                      />
                    </SettingsField>
                    <SettingsField label={t('settings.target')}>
                      <StyledSelect
                        value={teamRoleNames.length > 0 ? (settings[teamRoleNames[0]]?.targetType || 'local') : 'local'}
                        onChange={(e) => {
                          const targetType = e.target.value
                          setSettings((prev) => {
                            const next = { ...prev }
                            for (const name of teamRoleNames) {
                              next[name] = { ...(next[name] || toSetting(undefined, name, defaultProvider)), targetType: targetType as 'local' | 'remote' }
                            }
                            return next
                          })
                        }}
                        options={[
                          { value: 'local', label: t('settings.local') },
                          { value: 'remote', label: t('settings.remote') },
                        ]}
                      />
                    </SettingsField>
                  </div>

                  <div style={{
                    marginTop: '8px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                    background: 'rgba(255,255,255,0.03)'
                  }}>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {teamTargetType === 'remote' ? 'Remote setup terminal' : 'Local setup terminal'}
                      </div>
                      <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
                        {teamSetupDescription}
                      </div>
                      <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span
                          style={{
                            padding: '4px 8px',
                            borderRadius: '999px',
                            background: getProviderStatusColor(teamRuntimeInfo.status),
                            color: 'var(--text-primary)',
                            fontSize: '10px',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em'
                          }}
                        >
                          {getProviderStatusLabel(teamRuntimeInfo.status)}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {teamRuntimeInfo.reason || 'Target status unknown'}
                        </span>
                      </div>
                      {teamRuntimeInfo.detail && teamRuntimeInfo.status !== 'ready' && (
                        <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
                          {teamRuntimeInfo.detail}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await refreshTeamProviderStatus(team.id, teamProvider, teamExecutionTarget)
                            setStatus(`${team.displayName} target status refreshed`)
                          } catch (err) {
                            setStatus(err instanceof Error ? err.message : `Failed to refresh ${team.displayName} target status`)
                          }
                        }}
                        style={{
                          borderRadius: '8px',
                          border: '1px solid var(--border-subtle)',
                          background: 'rgba(255, 255, 255, 0.04)',
                          color: 'var(--text-primary)',
                          padding: '8px 10px',
                          cursor: 'pointer'
                        }}
                      >
                        Refresh Target Status
                      </button>
                      <button
                        type="button"
                        disabled={teamSetupDisabled}
                        onClick={async () => {
                          if (teamProvider === 'custom') return
                          try {
                            await openProviderSetup(teamProvider, teamExecutionTarget)
                            setStatus(`${team.displayName} setup terminal opened on ${teamTargetType === 'remote' ? 'the remote target' : 'this machine'}`)
                          } catch (err) {
                            setStatus(err instanceof Error ? err.message : `Failed to open ${team.displayName} setup terminal`)
                          }
                        }}
                        style={{
                          borderRadius: '8px',
                          border: '1px solid var(--border-subtle)',
                          background: 'rgba(255, 255, 255, 0.04)',
                          color: 'var(--text-primary)',
                          padding: '8px 10px',
                          cursor: teamSetupDisabled ? 'not-allowed' : 'pointer',
                          opacity: teamSetupDisabled ? 0.5 : 1
                        }}
                      >
                        Open Setup Terminal
                      </button>
                    </div>
                  </div>

                  {teamRoleNames.length > 0 && settings[teamRoleNames[0]]?.targetType === 'remote' && (
                    <div style={{ marginTop: '8px', display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
                      <SettingsField label="SSH Host Alias">
                        <StyledInput
                          value={settings[teamRoleNames[0]]?.sshHost || ''}
                          onChange={(e) => {
                            setSettings((prev) => {
                              const next = { ...prev }
                              for (const name of teamRoleNames) {
                                next[name] = { ...(next[name] || toSetting(undefined, name, defaultProvider)), sshHost: e.target.value }
                              }
                              return next
                            })
                          }}
                          placeholder="my-server"
                        />
                      </SettingsField>
                      <SettingsField label={t('settings.remoteWorkspace')} span>
                        <StyledInput
                          value={settings[teamRoleNames[0]]?.remoteWorkspacePath || ''}
                          onChange={(e) => {
                            setSettings((prev) => {
                              const next = { ...prev }
                              for (const name of teamRoleNames) {
                                next[name] = { ...(next[name] || toSetting(undefined, name, defaultProvider)), remoteWorkspacePath: e.target.value }
                              }
                              return next
                            })
                          }}
                        />
                      </SettingsField>
                    </div>
                  )}

                  <div style={{ marginTop: '8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <SettingsField label="Model Override">
                      <StyledInput
                        value={team.providerOptions?.model || ''}
                        onChange={(e) => {
                          setTeamConfigs((prev) => prev.map((tc) =>
                            tc.id === team.id ? { ...tc, providerOptions: { ...tc.providerOptions, model: e.target.value || undefined } } : tc
                          ))
                        }}
                        placeholder={`${getProviderLabel(teamProvider)} default`}
                      />
                    </SettingsField>
                    <SettingsField label="Max Turns Override">
                      <StyledInput
                        value={team.providerOptions?.maxTurns?.toString() || ''}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10)
                          setTeamConfigs((prev) => prev.map((tc) =>
                            tc.id === team.id ? { ...tc, providerOptions: { ...tc.providerOptions, maxTurns: isNaN(val) ? undefined : val } } : tc
                          ))
                        }}
                      />
                    </SettingsField>
                    <SettingsField label="Extra CLI Args Override" span>
                      <StyledInput
                        value={(team.providerOptions?.extraArgs || []).join(' ')}
                        onChange={(e) => {
                          const args = e.target.value.split(/\s+/).filter(Boolean)
                          setTeamConfigs((prev) => prev.map((tc) =>
                            tc.id === team.id ? { ...tc, providerOptions: { ...tc.providerOptions, extraArgs: args.length ? args : undefined } } : tc
                          ))
                        }}
                      />
                    </SettingsField>
                  </div>
                </div>
              )
            })}
          </div>
        </Section>

        <Section title="Role Definitions">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {orderedRoles.map((role, index) => (
              <div key={role.name} style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '12px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 180px', gap: '12px', flex: 1 }}>
                    <SettingsField label="Role Name">
                      <StyledInput value={role.name} onChange={(e) => updateRole(index, { name: e.target.value })} />
                    </SettingsField>
                    <SettingsField label="Display Name">
                      <StyledInput value={role.displayName} onChange={(e) => updateRole(index, { displayName: e.target.value })} />
                    </SettingsField>
                    <SettingsField label="Role Kind">
                      <StyledSelect
                        value={role.kind}
                        onChange={(e) => updateRole(index, { kind: e.target.value as RoleKind })}
                        options={roleKinds.map((kind) => ({ value: kind, label: kind }))}
                      />
                    </SettingsField>
                  </div>
                  <button onClick={() => removeRole(role.name)} style={dangerButtonStyle}>Remove</button>
                </div>

                <SettingsField label="Allowed Tools (comma-separated)">
                  <StyledInput
                    value={(role.allowedTools || []).join(', ')}
                    onChange={(e) => updateRole(index, {
                      allowedTools: e.target.value.split(',').map((item) => item.trim()).filter(Boolean)
                    })}
                  />
                </SettingsField>

                <SettingsField label="System Prompt">
                  <StyledTextarea
                    value={role.systemPromptTemplate}
                    onChange={(e) => updateRole(index, { systemPromptTemplate: e.target.value })}
                  />
                </SettingsField>
              </div>
            ))}
            <button onClick={addRole} style={secondaryButtonStyle}>Add Role</button>
          </div>
        </Section>


        {status && (
          <div style={{
            marginTop: 'var(--space-4)',
            padding: 'var(--space-3)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid rgba(239,68,68,0.2)',
            background: 'rgba(239,68,68,0.08)',
            color: '#fca5a5',
            fontSize: 'var(--font-sm)',
          }}>
            {status}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-6)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--border-subtle)' }}>
          <button onClick={onClose} style={secondaryButtonStyle}>{t('settings.cancel')}</button>
          <button onClick={handleSave} style={primaryButtonStyle}>{isSaving ? `${t('settings.save')}...` : t('settings.save')}</button>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 'var(--space-6)', padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)' }}>
      <div style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 'var(--space-3)' }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function SettingsField({ label, span, children }: { label: string; span?: boolean; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', ...(span ? { gridColumn: '1 / -1' } : {}) }}>
      <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', fontWeight: 500 }}>
        {label}
      </span>
      {children}
    </label>
  )
}

function StyledInput({ value, onChange, placeholder }: {
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  placeholder?: string
}) {
  return <input value={value} onChange={onChange} placeholder={placeholder} style={inputStyle} />
}

function StyledTextarea({ value, onChange }: {
  value: string
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
}) {
  return <textarea value={value} onChange={onChange} style={{ ...inputStyle, minHeight: 160, resize: 'vertical', fontFamily: "'SF Mono', monospace" }} />
}

function StyledSelect({ value, onChange, options }: {
  value: string
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
  options: { value: string; label: string; disabled?: boolean }[]
}) {
  return (
    <select value={value} onChange={onChange} style={inputStyle}>
      {options.map((option) => (
        <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>
      ))}
    </select>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border-default)',
  background: 'var(--bg-primary)',
  color: 'var(--text-primary)',
  fontSize: 'var(--font-sm)',
  outline: 'none',
  fontFamily: 'inherit',
}

const cardStyle: React.CSSProperties = {
  padding: 'var(--space-4)',
  borderRadius: 'var(--radius-lg)',
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border-subtle)',
}

const closeButtonStyle: React.CSSProperties = {
  width: '32px',
  height: '32px',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border-default)',
  background: 'var(--bg-elevated)',
  color: 'var(--text-tertiary)',
  fontSize: 'var(--font-lg)',
  cursor: 'pointer',
}

const secondaryButtonStyle: React.CSSProperties = {
  padding: '8px 20px',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border-default)',
  background: 'var(--bg-elevated)',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const primaryButtonStyle: React.CSSProperties = {
  padding: '8px 20px',
  borderRadius: 'var(--radius-md)',
  border: 'none',
  background: 'var(--accent-primary)',
  color: '#fff',
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const dangerButtonStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 'var(--radius-md)',
  border: '1px solid rgba(248,113,113,0.25)',
  background: 'rgba(127,29,29,0.32)',
  color: '#fca5a5',
  cursor: 'pointer',
  fontFamily: 'inherit',
}
