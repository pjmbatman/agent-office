import React from 'react'

interface ErrorBoundaryState {
  error: Error | null
}

export default class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('Renderer crashed', error, errorInfo)
  }

  render(): React.ReactNode {
    if (!this.state.error) {
      return this.props.children
    }

    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        background: '#06090f',
        color: '#f1f5f9',
        fontFamily: "'Noto Sans KR', system-ui, sans-serif",
      }}>
        <div style={{
          width: 'min(960px, 100%)',
          padding: '20px',
          borderRadius: '12px',
          border: '1px solid rgba(239,68,68,0.25)',
          background: 'rgba(15, 23, 42, 0.92)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.45)',
        }}>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#f87171', marginBottom: '10px' }}>
            Renderer Error
          </div>
          <div style={{ fontSize: '14px', color: '#cbd5e1', marginBottom: '16px' }}>
            The renderer crashed during startup. The message below should point to the exact cause.
          </div>
          <pre style={{
            margin: 0,
            padding: '16px',
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            borderRadius: '8px',
            background: '#020617',
            color: '#e2e8f0',
            fontSize: '12px',
            lineHeight: 1.5,
          }}>
            {this.state.error.stack || this.state.error.message}
          </pre>
        </div>
      </div>
    )
  }
}
