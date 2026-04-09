import React from 'react';

interface Props {
  children: React.ReactNode;
  /** Optional fallback message (default: "Something went wrong") */
  fallbackMessage?: string;
}

interface State { error: Error | null }

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log full error details server-side (visible in Vercel logs, not to end users)
    console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          padding: 40, color: '#E04A4A', fontFamily: 'var(--font-mono)',
          minHeight: '60vh', background: 'var(--midnight)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          <h2 style={{ fontSize: 'var(--fs-3xl)', marginBottom: 16 }}>
            {this.props.fallbackMessage || 'Something went wrong'}
          </h2>
          <p style={{ fontSize: 'var(--fs-md)', color: 'var(--text-secondary)', marginBottom: 24, maxWidth: 500, textAlign: 'center' }}>
            An unexpected error occurred. Try refreshing the page.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-sm" onClick={() => this.setState({ error: null })}>
              Try Again
            </button>
            <button className="btn btn-sm" onClick={() => window.location.reload()}>
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
