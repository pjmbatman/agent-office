import React, { useEffect, useRef } from 'react'
import { useAgentStore } from '../stores/agent-store'
import type { AgentRole, AgentStatus } from '../../shared/types'
import type { AgentTranscriptEntry } from '../stores/agent-store'

const EMPTY_TRANSCRIPT: AgentTranscriptEntry[] = []

function getRoleColor(role: AgentRole): string {
  const known: Record<string, string> = {
    teamlead: 'var(--role-teamlead)',
    senior: 'var(--role-senior)',
    junior: 'var(--role-junior)',
  }
  if (known[role]) return known[role]
  const palette = ['#38bdf8', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#fb7185']
  let hash = 0
  for (const char of role) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return palette[hash % palette.length]
}

export default function AgentTranscriptPanel(): React.ReactElement | null {
  const selectedAgent = useAgentStore((s) => s.selectedAgent)
  const selectAgent = useAgentStore((s) => s.selectAgent)
  const transcript = useAgentStore((s) => selectedAgent ? s.agents[selectedAgent].transcript : EMPTY_TRANSCRIPT)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [transcript, selectedAgent])

  if (!selectedAgent) {
    return null
  }

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      background: 'rgba(6,14,18,0.5)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      justifyContent: 'flex-end',
      zIndex: 120,
    }} onClick={(event) => {
      if (event.target === event.currentTarget) {
        selectAgent(null)
      }
    }}>
      <div style={{
        width: 'min(560px, 100%)',
        height: '100%',
        background: 'linear-gradient(180deg, rgba(13,27,34,0.98), rgba(7,19,26,0.98))',
        borderLeft: '1px solid var(--border-default)',
        boxShadow: '-24px 0 48px rgba(0,0,0,0.35)',
        display: 'flex',
        flexDirection: 'column',
      }}>
      <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '20px 22px',
          borderBottom: '1px solid var(--border-default)',
        }}>
          <div>
            <div style={{
              fontSize: '11px',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
              marginBottom: '6px',
            }}>
              Debug Transcript
            </div>
            <div data-ui-heading="true" style={{ fontSize: '20px', fontWeight: 700, color: getRoleColor(selectedAgent) }}>
              {selectedAgent}
            </div>
          </div>
          <button
            onClick={() => selectAgent(null)}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-default)',
              background: 'rgba(20,38,48,0.82)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </div>

        <div ref={scrollRef} style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 18px 22px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}>
          {transcript.length === 0 ? (
            <div style={{
              padding: '16px',
              borderRadius: '16px',
              background: 'rgba(20,38,48,0.65)',
              color: 'var(--text-muted)',
              fontSize: '13px',
            }}>
              No internal transcript yet.
            </div>
          ) : transcript.map((entry) => (
            <div key={entry.id} style={{
              padding: '13px 15px',
              borderRadius: '16px',
              background: entry.kind === 'error'
                ? 'rgba(127,29,29,0.34)'
                : entry.kind === 'status'
                  ? 'rgba(81,191,173,0.12)'
                  : 'rgba(20,38,48,0.72)',
              border: `1px solid ${entry.kind === 'error'
                ? 'rgba(248,113,113,0.22)'
                : entry.kind === 'status'
                  ? 'rgba(81,191,173,0.18)'
                  : 'rgba(148,163,184,0.12)'}`,
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
            }}>
              <div style={{
                fontSize: '10px',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: entry.kind === 'error'
                  ? '#fca5a5'
                  : entry.kind === 'status'
                    ? '#93c5fd'
                    : 'var(--text-muted)',
                marginBottom: '6px',
              }}>
                {entry.kind}
              </div>
              <div style={{
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontSize: '13px',
                lineHeight: 1.55,
                color: entry.kind === 'error' ? '#fee2e2' : 'var(--text-primary)',
                fontFamily: entry.kind === 'output' ? "'SF Mono', 'Fira Code', monospace" : 'inherit',
              }}>
                {entry.content}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
