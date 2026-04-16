import React from 'react';

interface Props {
  children: React.ReactNode;
  /** Optional fallback message (default: "Something went wrong") */
  fallbackMessage?: string;
  /**
   * If provided, shows a "Regenerate" button that calls onReset and clears the error.
   * The caller is responsible for preserving selections and clearing only the subtree's
   * transient state (e.g. preview images, generating flag). This replaces the nuclear
   * "Clear Cache & Reload" button which wipes all nmf_/nr_ localStorage.
   */
  onReset?: () => void;
  /** Label for the reset button when onReset is provided (default: "Regenerate"). */
  resetLabel?: string;
}

interface State { error: Error | null }

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack);
  }

  handleClearAndReload = () => {
    // Clear all NMF-related localStorage that could contain stale/corrupt data
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('nmf_') || key.startsWith('nr_'))) keysToRemove.push(key);
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
      sessionStorage.clear();
    } catch { /* ignore */ }
    window.location.reload();
  };

  handleReset = () => {
    try { this.props.onReset?.(); } catch (e) { console.error('[ErrorBoundary] onReset threw:', e); }
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      const hasReset = typeof this.props.onReset === 'function';
      const resetLabel = this.props.resetLabel || 'Regenerate';
      const helpText = hasReset
        ? 'Your track selections are preserved. Regenerate to rebuild the preview.'
        : 'An unexpected error occurred. This is usually caused by stale cached data.';
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
            {helpText}
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-sm" onClick={() => this.setState({ error: null })}>
              Try Again
            </button>
            {hasReset ? (
              <button className="btn btn-sm btn-gold" onClick={this.handleReset}>
                {resetLabel}
              </button>
            ) : (
              <button className="btn btn-sm btn-gold" onClick={this.handleClearAndReload}>
                Clear Cache &amp; Reload
              </button>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
