import React, { useState } from 'react'
import GameCanvas from './GameCanvas'
import ChatPanel from './ChatPanel'
import AgentStatusPanel from './AgentStatusPanel'
import AgentTranscriptPanel from './AgentTranscriptPanel'
import SettingsPanel from './SettingsPanel'
import { useIpcListeners } from '../hooks/useIpc'
import { useGameBridge } from '../hooks/useGameBridge'
import { useT } from '../i18n'

export default function Layout(): React.ReactElement {
  useIpcListeners()
  useGameBridge()

  const t = useT()
  const [showSettings, setShowSettings] = useState(false)
  const [settingsHover, setSettingsHover] = useState(false)

  return (
    <div style={{
      display: 'flex',
      width: '100%',
      height: '100vh',
      background: 'transparent',
      padding: '18px',
      gap: '18px',
    }}>
      {/* Left: Office floor */}
      <div style={{
        flex: '1 1 62%',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '26px',
        overflow: 'hidden',
        border: '1px solid var(--border-default)',
        background: 'linear-gradient(180deg, rgba(11,27,33,0.86), rgba(7,19,26,0.92))',
        boxShadow: '0 24px 80px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.03)',
      }}>
        {/* Top header bar */}
        <div style={{
          position: 'absolute',
          top: 16,
          left: 16,
          right: 16,
          height: '56px',
          background: 'linear-gradient(180deg, rgba(6,14,18,0.88), rgba(6,14,18,0.38))',
          border: '1px solid rgba(216,233,227,0.08)',
          borderRadius: '18px',
          backdropFilter: 'blur(14px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 18px',
          zIndex: 50,
          pointerEvents: 'none'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            pointerEvents: 'auto',
          }}>
            <div style={{
              width: '34px',
              height: '34px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, rgba(81,191,173,0.24), rgba(215,166,74,0.16))',
              border: '1px solid rgba(215,166,74,0.18)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-primary)',
              fontSize: '12px',
              fontWeight: 700,
            }} />
            <div>
              <div data-ui-heading="true" style={{
                fontSize: '13px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}>{t('app.title')}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Interactive orchestration floor
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', pointerEvents: 'auto' }}>
            <button
              onClick={() => setShowSettings(true)}
              onMouseEnter={() => setSettingsHover(true)}
              onMouseLeave={() => setSettingsHover(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                padding: '8px 14px',
                borderRadius: '14px',
                border: '1px solid var(--border-default)',
                background: settingsHover ? 'var(--bg-hover)' : 'rgba(14, 28, 34, 0.9)',
                color: 'var(--text-secondary)',
                fontSize: 'var(--font-sm)',
                cursor: 'pointer',
                transition: 'var(--transition-fast)',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
              {t('app.settings')}
            </button>
          </div>
        </div>

        {/* Agent status bar — below header */}
        <div style={{
          position: 'absolute',
          top: 82,
          left: 16,
          right: 16,
          zIndex: 50,
          pointerEvents: 'auto',
        }}>
          <AgentStatusPanel />
        </div>

        <GameCanvas />
      </div>

      {/* Right: Prompt panel only */}
      <div style={{
        flex: '0 0 480px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: 'linear-gradient(180deg, rgba(12,28,35,0.92), rgba(8,20,25,0.96))',
        borderRadius: '28px',
        border: '1px solid var(--border-default)',
        boxShadow: '0 24px 80px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.03)',
      }}>
        <ChatPanel />
      </div>

      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
      <AgentTranscriptPanel />
    </div>
  )
}
