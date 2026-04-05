import React from 'react';

interface State { error: Error | null }

export default class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          padding: 40, color: '#E04A4A', fontFamily: 'var(--font-mono)',
          minHeight: '100vh', background: 'var(--midnight)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          <h2 style={{ fontSize: 'var(--fs-3xl)', marginBottom: 16 }}>Something went wrong</h2>
          <p style={{ fontSize: 'var(--fs-md)', color: 'var(--text-secondary)', marginBottom: 24, maxWidth: 500, textAlign: 'center' }}>
            {this.state.error.message}
          </p>
          <button
            className="btn btn-sm"
            onClick={() => this.setState({ error: null })}
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
