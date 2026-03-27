import React, { useState, useRef, useEffect } from 'react'
import { useChatStore } from '../stores/chat-store'
import { useTaskStore } from '../stores/task-store'
import { useT } from '../i18n'
import { getAgentOffice } from '../lib/agent-office'

const ROLE_COLORS: Record<string, string> = {
  ceo: 'var(--role-ceo)',
  teamlead: 'var(--role-teamlead)',
  senior: 'var(--role-senior)',
  junior: 'var(--role-junior)',
  system: 'var(--role-system)',
}

const ROLE_BG: Record<string, string> = {
  ceo: 'var(--role-ceo-bg)',
  teamlead: 'var(--role-teamlead-bg)',
  senior: 'var(--role-senior-bg)',
  junior: 'var(--role-junior-bg)',
  system: 'var(--role-system-bg)',
}

const ROLE_LABEL_KEYS: Record<string, string> = {
  ceo: 'role.ceo',
  teamlead: 'role.teamlead',
  senior: 'role.senior',
  junior: 'role.junior',
  system: 'role.system',
}

const ROLE_INITIALS: Record<string, string> = {
  ceo: 'C',
  teamlead: 'T',
  senior: 'S',
  junior: 'J',
  system: '●',
}

export default function ChatPanel(): React.ReactElement {
  const t = useT()
  const messages = useChatStore((s) => s.messages)
  const addMessage = useChatStore((s) => s.addMessage)
  const workflowState = useTaskStore((s) => s.workflowState)
  const [input, setInput] = useState('')
  const [inputFocused, setInputFocused] = useState(false)
  const [isComposing, setIsComposing] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const isProcessing = workflowState !== 'idle' && workflowState !== 'complete'

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const submitInput = async () => {
    if (isComposing || !input.trim() || isProcessing) return

    const text = input.trim()
    addMessage('ceo', text)
    setInput('')

    try {
      const result = await getAgentOffice().submitTask(text)
      addMessage('system', t('chat.taskReceived', { id: result.taskId }))
    } catch (err) {
      addMessage('system', t('chat.error', { msg: err instanceof Error ? err.message : 'Unknown error' }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await submitInput()
  }

  const handleOverride = async (action: string) => {
    await getAgentOffice().overrideWorkflow(action)
    addMessage('system', action === 'approve' ? t('chat.approved') : t('chat.cancelled'))
  }

  const formatTime = (timestamp: number) => {
    const d = new Date(timestamp)
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
  }

  useEffect(() => {
    if (!isProcessing) {
      inputRef.current?.focus()
    }
  }, [isProcessing])

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      minHeight: 0,
      background: 'var(--bg-primary)',
    }}>
      {/* Review action bar */}
      {workflowState === 'reviewing' && (
        <div style={{
          padding: 'var(--space-3) var(--space-4)',
          background: 'rgba(59, 130, 246, 0.06)',
          borderBottom: '1px solid rgba(59, 130, 246, 0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          animation: 'slide-up 0.3s ease-out',
        }}>
          <span style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' }}>
            {t('chat.reviewDone')}
          </span>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <ActionButton label={t('chat.approve')} color="var(--accent-success)" onClick={() => handleOverride('approve')} />
            <ActionButton label={t('chat.cancel')} color="var(--accent-danger)" onClick={() => handleOverride('cancel')} />
          </div>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} style={{
        flex: 1,
        overflowY: 'auto',
        padding: 'var(--space-4)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
      }}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            className="animate-slide-up"
            style={{
              display: 'flex',
              gap: 'var(--space-3)',
              padding: 'var(--space-3)',
              borderRadius: 'var(--radius-md)',
              background: msg.tone === 'error'
                ? 'rgba(239,68,68,0.08)'
                : msg.role === 'ceo'
                  ? 'var(--role-ceo-bg)'
                  : 'transparent',
              transition: 'var(--transition-fast)',
              border: msg.tone === 'error' ? '1px solid rgba(239,68,68,0.16)' : '1px solid transparent',
            }}
          >
            {/* Avatar */}
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: 'var(--radius-sm)',
              background: ROLE_BG[msg.role] || 'var(--bg-surface)',
              border: `1px solid ${msg.role === 'system' ? 'var(--border-default)' : (ROLE_COLORS[msg.role] + '33')}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: msg.role === 'system' ? 'var(--font-xs)' : 'var(--font-sm)',
              fontWeight: 700,
              color: ROLE_COLORS[msg.role] || 'var(--text-tertiary)',
              flexShrink: 0,
            }}>
              {ROLE_INITIALS[msg.role] || '?'}
            </div>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 'var(--space-2)',
                marginBottom: '2px',
              }}>
                <span style={{
                  fontSize: 'var(--font-sm)',
                  fontWeight: 600,
                  color: msg.tone === 'error'
                    ? 'var(--accent-danger)'
                    : ROLE_COLORS[msg.role] || 'var(--text-secondary)',
                }}>
                  {t((ROLE_LABEL_KEYS[msg.role] || msg.role) as any)}
                </span>
                <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>
                  {formatTime(msg.timestamp)}
                </span>
              </div>
              <div style={{
                fontSize: 'var(--font-base)',
                lineHeight: 1.55,
                color: msg.tone === 'error'
                  ? '#fecaca'
                  : msg.role === 'system'
                    ? 'var(--text-tertiary)'
                    : 'var(--text-primary)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}>
                {msg.content}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Input area */}
      <form onSubmit={handleSubmit} style={{
        padding: 'var(--space-3) var(--space-4)',
        borderTop: '1px solid var(--border-subtle)',
        background: 'var(--bg-primary)',
      }}>
        <div style={{
          display: 'flex',
          gap: 'var(--space-2)',
          padding: '4px',
          borderRadius: 'var(--radius-lg)',
          border: `1px solid ${inputFocused ? 'var(--border-focus)' : 'var(--border-default)'}`,
          background: 'var(--bg-secondary)',
          transition: 'var(--transition-fast)',
          boxShadow: inputFocused ? '0 0 0 3px rgba(59,130,246,0.1)' : 'none',
        }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={(e) => {
              setIsComposing(false)
              setInput(e.currentTarget.value)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && !isComposing) {
                e.preventDefault()
                void submitInput()
              }
            }}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            placeholder={isProcessing ? t('chat.processing') : t('chat.placeholder')}
            disabled={isProcessing}
            style={{
              flex: 1,
              padding: '8px 12px',
              border: 'none',
              background: 'transparent',
              color: 'var(--text-primary)',
              fontSize: 'var(--font-base)',
              outline: 'none',
              opacity: isProcessing ? 0.5 : 1,
              fontFamily: 'inherit',
              resize: 'none',
              minHeight: 40,
              maxHeight: 120,
              lineHeight: 1.45,
            }}
          />
          <button
            type="submit"
            disabled={isProcessing || !input.trim()}
            style={{
              padding: '8px 20px',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              background: isProcessing || !input.trim() ? 'var(--bg-hover)' : 'var(--accent-primary)',
              color: isProcessing || !input.trim() ? 'var(--text-muted)' : '#fff',
              cursor: isProcessing || !input.trim() ? 'not-allowed' : 'pointer',
              fontSize: 'var(--font-sm)',
              fontWeight: 600,
              transition: 'var(--transition-fast)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              fontFamily: 'inherit',
            }}
          >
            {t('chat.submit')}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        </div>
        {isProcessing && (
          <div style={{
            marginTop: 'var(--space-2)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            padding: '0 var(--space-2)',
          }}>
            <div style={{
              width: '6px',
              height: '6px',
              borderRadius: 'var(--radius-full)',
              background: 'var(--accent-primary)',
              animation: 'pulse-dot 1.5s ease-in-out infinite',
            }} />
            <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>
              {t('chat.agentsWorking')}
            </span>
          </div>
        )}
      </form>
    </div>
  )
}

function ActionButton({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: '5px 14px',
        borderRadius: 'var(--radius-sm)',
        border: `1px solid ${color}44`,
        background: hover ? `${color}22` : `${color}11`,
        color,
        fontSize: 'var(--font-sm)',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'var(--transition-fast)',
        fontFamily: 'inherit',
      }}
    >
      {label}
    </button>
  )
}
