import React from 'react'
import { useTaskStore } from '../stores/task-store'
import { useT } from '../i18n'

function StageIcon({ label }: { label: string }) {
  const normalized = label.toLowerCase()

  if (normalized.includes('research') || normalized.includes('조사') || normalized.includes('리서치')) {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/>
        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
    )
  }

  if (normalized.includes('review') || normalized.includes('검토') || normalized.includes('qa')) {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
    )
  }

  if (normalized.includes('implement') || normalized.includes('build') || normalized.includes('구현') || normalized.includes('작성')) {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16 18 22 12 16 6"/>
        <polyline points="8 6 2 12 8 18"/>
      </svg>
    )
  }

  if (normalized.includes('answer') || normalized.includes('respond') || normalized.includes('답변')) {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    )
  }

  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  )
}

export default function TaskDashboard(): React.ReactElement {
  const t = useT()
  const { workflowState, taskDescription, revisionCount, error, pipelineStages, currentStageKey } = useTaskStore()

  const isActive = workflowState !== 'idle'
  const visibleStages = pipelineStages.length
    ? pipelineStages
    : workflowState === 'complete'
      ? [{ key: 'done', label: t('workflow.complete') }]
      : []

  const currentStageIndex = visibleStages.findIndex((stage) => stage.key === currentStageKey)

  return (
    <div style={{
      padding: 'var(--space-4) var(--space-5)',
      background: 'var(--bg-primary)',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 'var(--space-3)',
      }}>
        <span style={{
          fontSize: 'var(--font-xs)',
          fontWeight: 600,
          color: 'var(--text-muted)',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}>
          {t('workflow.title')}
        </span>
        {revisionCount > 0 && (
          <span style={{
            fontSize: 'var(--font-xs)',
            color: 'var(--accent-warning)',
            padding: '2px 8px',
            borderRadius: 'var(--radius-full)',
            background: 'rgba(245,158,11,0.1)',
            border: '1px solid rgba(245,158,11,0.2)',
          }}>
            {t('workflow.revision', { n: revisionCount })}
          </span>
        )}
      </div>

      {!isActive ? (
        <div style={{
          padding: 'var(--space-5) var(--space-4)',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: 'var(--font-sm)',
        }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto var(--space-3)',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          {t('app.waiting')}
        </div>
      ) : (
        <>
          {taskDescription && (
            <div style={{
              fontSize: 'var(--font-sm)',
              color: 'var(--text-secondary)',
              marginBottom: 'var(--space-4)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              padding: 'var(--space-2) var(--space-3)',
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
            }}>
              {taskDescription}
            </div>
          )}

          {visibleStages.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0 }}>
              {visibleStages.map((stage, i) => {
                const isCurrentStage = currentStageKey === stage.key
                const isPast = currentStageIndex > i || (workflowState === 'complete' && currentStageIndex === -1)
                const textColor = isCurrentStage
                  ? 'var(--text-primary)'
                  : isPast
                    ? 'var(--accent-success)'
                    : 'var(--text-muted)'

                return (
                  <React.Fragment key={stage.key}>
                    {i > 0 && (
                      <div style={{
                        flex: '1 1 0',
                        height: '2px',
                        marginTop: '15px',
                        background: isPast
                          ? 'var(--accent-success)'
                          : isCurrentStage
                            ? 'linear-gradient(to right, var(--accent-success), var(--accent-primary))'
                            : 'var(--border-default)',
                        transition: 'var(--transition-slow)',
                        borderRadius: '1px',
                      }} />
                    )}
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 'var(--space-2)',
                      position: 'relative',
                      maxWidth: 96,
                    }}>
                      {isCurrentStage && (
                        <div style={{
                          position: 'absolute',
                          top: '2px',
                          width: '28px',
                          height: '28px',
                          borderRadius: 'var(--radius-full)',
                          border: '2px solid var(--accent-primary)',
                          animation: 'pulse-ring 2s ease-out infinite',
                        }} />
                      )}
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: 'var(--radius-full)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: isCurrentStage
                          ? 'var(--accent-primary)'
                          : isPast
                            ? 'rgba(16, 185, 129, 0.15)'
                            : 'var(--bg-elevated)',
                        border: `1.5px solid ${isCurrentStage ? 'var(--accent-primary)' : isPast ? 'var(--accent-success)' : 'var(--border-default)'}`,
                        color: isCurrentStage ? '#fff' : isPast ? 'var(--accent-success)' : 'var(--text-muted)',
                        transition: 'all var(--transition-slow)',
                        boxShadow: isCurrentStage ? '0 0 16px rgba(59,130,246,0.3)' : 'none',
                      }}>
                        <StageIcon label={stage.label} />
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{
                          fontSize: 'var(--font-xs)',
                          fontWeight: isCurrentStage ? 600 : 400,
                          color: textColor,
                          transition: 'var(--transition-fast)',
                        }}>
                          {stage.label}
                        </div>
                        {stage.role && (
                          <div style={{
                            marginTop: 2,
                            fontSize: '10px',
                            color: 'var(--text-muted)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                          }}>
                            {stage.role}
                          </div>
                        )}
                      </div>
                    </div>
                  </React.Fragment>
                )
              })}
            </div>
          )}

          {error && (
            <div style={{
              fontSize: 'var(--font-sm)',
              color: 'var(--accent-danger)',
              marginTop: 'var(--space-3)',
              padding: 'var(--space-2) var(--space-3)',
              background: 'rgba(239,68,68,0.08)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid rgba(239,68,68,0.15)',
            }}>
              {error}
            </div>
          )}
        </>
      )}
    </div>
  )
}
