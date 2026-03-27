import React from 'react'
import { useAgentStore } from '../stores/agent-store'
import { useT } from '../i18n'
import type { AgentRole, AgentStatus } from '../../shared/types'

const STATUS_COLORS: Record<AgentStatus, string> = {
  idle: 'var(--text-muted)',
  thinking: 'var(--accent-warning)',
  working: 'var(--accent-primary)',
  talking: 'var(--accent-purple)',
  done: 'var(--accent-success)',
  error: 'var(--accent-danger)',
}

const STATUS_KEYS: Record<AgentStatus, string> = {
  idle: 'status.idle',
  thinking: 'status.thinking',
  working: 'status.working',
  talking: 'status.talking',
  done: 'status.done',
  error: 'status.error',
}

const ROLE_COLORS: Record<string, { color: string; border: string }> = {
  'alpha-lead':    { color: '#60a5fa', border: 'rgba(96,165,250,0.35)' },
  'alpha-senior':  { color: '#34d399', border: 'rgba(52,211,153,0.35)' },
  'alpha-worker1': { color: '#818cf8', border: 'rgba(129,140,248,0.35)' },
  'alpha-worker2': { color: '#a78bfa', border: 'rgba(167,139,250,0.35)' },
  'beta-lead':     { color: '#fb923c', border: 'rgba(251,146,60,0.35)' },
  'beta-senior':   { color: '#fbbf24', border: 'rgba(251,191,36,0.35)' },
  'beta-worker1':  { color: '#f472b6', border: 'rgba(244,114,182,0.35)' },
  'beta-worker2':  { color: '#fb7185', border: 'rgba(251,113,133,0.35)' },
}

const ALPHA_ROLES = ['alpha-lead', 'alpha-senior', 'alpha-worker1', 'alpha-worker2']
const BETA_ROLES = ['beta-lead', 'beta-senior', 'beta-worker1', 'beta-worker2']

function AgentCard({ role }: { role: AgentRole }) {
  const t = useT()
  const agent = useAgentStore((s) => s.agents[role])
  const selectedAgent = useAgentStore((s) => s.selectedAgent)
  const selectAgent = useAgentStore((s) => s.selectAgent)

  if (!agent) return null

  const colors = ROLE_COLORS[role] || { color: '#94a3b8', border: 'rgba(148,163,184,0.35)' }
  const statusColor = STATUS_COLORS[agent.status]
  const isActive = agent.status !== 'idle'
  const isSelected = selectedAgent === role

  return (
    <div
      onClick={() => selectAgent(role)}
      style={{
        flex: 1,
        padding: '8px 10px',
        borderRadius: '12px',
        background: 'linear-gradient(180deg, rgba(6,14,18,0.88), rgba(6,14,18,0.5))',
        border: `1px solid ${isSelected ? colors.border : 'rgba(216,233,227,0.06)'}`,
        backdropFilter: 'blur(14px)',
        cursor: 'pointer',
        transition: 'all var(--transition-base)',
        boxShadow: isSelected ? `0 0 0 1px ${colors.border}` : 'none',
        minWidth: 0,
      }}
    >
      <div style={{
        fontWeight: 700, fontSize: '11px', color: colors.color,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {t(`role.${role}` as any)}
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px',
      }}>
        <div style={{
          width: '5px', height: '5px', borderRadius: 'var(--radius-full)',
          background: statusColor, flexShrink: 0,
          ...(isActive ? { animation: 'pulse-dot 2s ease-in-out infinite' } : {}),
        }} />
        <span style={{ fontSize: '9px', color: statusColor, fontWeight: 500 }}>
          {t(STATUS_KEYS[agent.status] as any)}
        </span>
      </div>
    </div>
  )
}

export default function AgentStatusPanel(): React.ReactElement {
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', gap: '4px' }}>
      {ALPHA_ROLES.map((role) => (
        <AgentCard key={role} role={role} />
      ))}

      <div style={{
        width: '1px', flexShrink: 0,
        background: 'rgba(216,233,227,0.12)', margin: '4px 3px',
      }} />

      {BETA_ROLES.map((role) => (
        <AgentCard key={role} role={role} />
      ))}
    </div>
  )
}
