import React, { useState, useEffect } from 'react'
import { useTaskStore } from '../stores/task-store'
import { useT } from '../i18n'
import { getAgentOffice } from '../lib/agent-office'

export default function FileViewer(): React.ReactElement {
  const t = useT()
  const currentTaskId = useTaskStore((s) => s.currentTaskId)
  const [files, setFiles] = useState<string[]>([])
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [content, setContent] = useState<string>('')

  useEffect(() => {
    if (!currentTaskId) {
      setFiles([])
      return
    }
    getAgentOffice().listFiles(currentTaskId).then(setFiles).catch(() => setFiles([]))
  }, [currentTaskId])

  useEffect(() => {
    if (!selectedFile || !currentTaskId) {
      setContent('')
      return
    }
    getAgentOffice().readFile(currentTaskId, selectedFile).then(setContent).catch(() => setContent(''))
  }, [selectedFile, currentTaskId])

  if (!currentTaskId) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-3)',
        color: 'var(--text-muted)',
        padding: 'var(--space-8)',
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: 'var(--radius-md)',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
            <polyline points="13 2 13 9 20 9"/>
          </svg>
        </div>
        <span style={{ fontSize: 'var(--font-sm)' }}>{t('files.noTask')}</span>
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'var(--bg-primary)',
    }}>
      {/* File list */}
      <div style={{
        padding: 'var(--space-3) var(--space-4)',
        borderBottom: '1px solid var(--border-subtle)',
        maxHeight: '140px',
        overflowY: 'auto',
      }}>
        <div style={{
          fontSize: 'var(--font-xs)',
          fontWeight: 600,
          color: 'var(--text-muted)',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          marginBottom: 'var(--space-2)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
        }}>
          {t('files.title')}
          <span style={{
            fontWeight: 500,
            fontSize: '10px',
            color: 'var(--text-muted)',
            padding: '1px 6px',
            borderRadius: 'var(--radius-full)',
            background: 'var(--bg-elevated)',
            letterSpacing: '0',
            textTransform: 'none',
          }}>
            {files.length}
          </span>
        </div>
        {files.length === 0 ? (
          <div style={{
            color: 'var(--text-muted)',
            fontSize: 'var(--font-sm)',
            padding: 'var(--space-2) 0',
          }}>
            {t('files.empty')}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
            {files.map((file) => {
              const isSelected = selectedFile === file
              const fileName = file.split('/').pop() || file
              return (
                <div
                  key={file}
                  onClick={() => setSelectedFile(file)}
                  style={{
                    padding: 'var(--space-1) var(--space-2)',
                    fontSize: 'var(--font-sm)',
                    cursor: 'pointer',
                    borderRadius: 'var(--radius-sm)',
                    background: isSelected ? 'var(--bg-hover)' : 'transparent',
                    color: isSelected ? 'var(--text-primary)' : 'var(--text-tertiary)',
                    fontFamily: 'monospace',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                    transition: 'var(--transition-fast)',
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.5 }}>
                    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
                    <polyline points="13 2 13 9 20 9"/>
                  </svg>
                  {fileName}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* File content */}
      <div style={{
        flex: 1,
        padding: 'var(--space-4)',
        overflowY: 'auto',
        fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
        fontSize: 'var(--font-sm)',
        color: 'var(--text-secondary)',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
        lineHeight: 1.65,
        background: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border-subtle)',
      }}>
        {content || (selectedFile
          ? <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('files.loading')}</span>
          : <span style={{ color: 'var(--text-muted)' }}>{t('files.selectFile')}</span>
        )}
      </div>
    </div>
  )
}
