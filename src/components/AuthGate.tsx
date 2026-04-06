import { useState } from 'react';
import { useAuth } from '../lib/auth-context';

interface Props {
  children: React.ReactNode;
}

export default function AuthGate({ children }: Props) {
  const { user, loading, isGuest, signInWithGoogle, signInWithEmail, signUpWithEmail, continueAsGuest } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [tosAccepted, setTosAccepted] = useState(false);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--midnight)' }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
      </div>
    );
  }

  // Even if signed in, show the landing page until user explicitly enters this session
  const hasEntered = sessionStorage.getItem('nmf_entered') === '1';
  if ((user || isGuest) && hasEntered) return <>{children}</>;

  const handleEmail = async () => {
    if (isSignUp && !tosAccepted) {
      setError('You must accept the Terms of Service to create an account.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      sessionStorage.setItem('nmf_entered', '1');
      if (isSignUp) await signUpWithEmail(email, password);
      else await signInWithEmail(email, password);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--midnight)', padding: 24, textAlign: 'center',
    }}>
      <div className="animate-float-up" style={{ maxWidth: 440, width: '100%' }}>
        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 5vw, 2.75rem)',
          fontWeight: 700, marginBottom: 8, lineHeight: 1.15,
        }}>
          New Music <span style={{ color: 'var(--gold)' }}>Friday</span>
        </h1>

        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-lg)', lineHeight: 1.6, marginBottom: 8 }}>
          Built for the curators, bloggers, and tastemakers who put new artists on the map every single week.
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-md)', lineHeight: 1.5, marginBottom: 32 }}>
          This tool exists because your work matters. You listen to everything, you find the gems, and you share them with the world. We're here to save you time so you can focus on what you do best.
        </p>

        {/* Already signed in — show a quick "Continue" instead of full auth */}
        {user && (
          <button
            className="btn btn-gold"
            onClick={() => { sessionStorage.setItem('nmf_entered', '1'); window.location.reload(); }}
            style={{ width: '100%', justifyContent: 'center', fontSize: 'var(--fs-lg)', padding: '14px 0', marginBottom: 12 }}
          >
            Continue as {user.email?.split('@')[0] || 'User'}
          </button>
        )}

        {/* Continue as Guest */}
        <button
          className="btn btn-gold"
          onClick={() => { sessionStorage.setItem('nmf_entered', '1'); continueAsGuest(); }}
          style={{ width: '100%', justifyContent: 'center', fontSize: 'var(--fs-lg)', padding: '14px 0', marginBottom: 12 }}
        >
          Jump In
        </button>

        {/* Google Sign-In */}
        <button
          className="btn"
          onClick={() => { sessionStorage.setItem('nmf_entered', '1'); signInWithGoogle(); }}
          style={{ width: '100%', justifyContent: 'center', fontSize: 'var(--fs-lg)', padding: '12px 0', marginBottom: 12 }}
        >
          Sign in with Google
        </button>

        {/* Email */}
        <details style={{ textAlign: 'left', marginTop: 8 }}>
          <summary style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-md)', cursor: 'pointer', textAlign: 'center' }}>
            {isSignUp ? 'Sign up' : 'Sign in'} with email
          </summary>
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
              className="search-input"
            />
            <input
              type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)}
              className="search-input"
              onKeyDown={e => e.key === 'Enter' && handleEmail()}
            />
            {isSignUp && (
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <input type="checkbox" checked={tosAccepted} onChange={e => setTosAccepted(e.target.checked)} style={{ marginTop: 2 }} />
                <span>
                  I agree to the <a href="/terms" target="_blank" style={{ color: 'var(--gold)' }}>Terms of Service</a> and <a href="/privacy" target="_blank" style={{ color: 'var(--gold)' }}>Privacy Policy</a>
                </span>
              </label>
            )}
            {error && <p style={{ color: 'var(--mmmc-red)', fontSize: 'var(--fs-sm)' }}>{error}</p>}
            <button className="btn btn-sm btn-gold" onClick={handleEmail} disabled={submitting || (isSignUp && !tosAccepted)} style={{ width: '100%', justifyContent: 'center' }}>
              {submitting ? '...' : isSignUp ? 'Create Account' : 'Sign In'}
            </button>
            <button onClick={() => { setIsSignUp(!isSignUp); setError(''); }} style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-sm)' }}>
              {isSignUp ? 'Already have an account? Sign in' : 'Need an account? Sign up'}
            </button>
          </div>
        </details>

        {/* What this does */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 12, marginTop: 40, textAlign: 'left',
        }}>
          {[
            { title: 'Scan 800+ Artists', desc: 'Every release from every artist you follow, since last Friday' },
            { title: 'Build Your Carousel', desc: 'Beautiful Instagram slides in your style, in seconds' },
            { title: 'Auto-Tag Everyone', desc: 'Instagram handles resolved automatically via Nashville Decoder' },
            { title: 'One-Click Playlist', desc: 'Push your curated picks straight to Spotify' },
          ].map(f => (
            <div key={f.title} className="card" style={{ padding: 12, opacity: 0.7 }}>
              <div style={{ fontWeight: 600, fontSize: 'var(--fs-md)', marginBottom: 2, color: 'var(--gold)' }}>{f.title}</div>
              <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)', lineHeight: 1.4 }}>{f.desc}</div>
            </div>
          ))}
        </div>

        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-2xs)', marginTop: 32, lineHeight: 1.5 }}>
          Free forever for curators. Built with love in Nashville by <a href="https://instagram.com/maxmeetsmusiccity" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--gold)' }}>@maxmeetsmusiccity</a>.
        </p>
      </div>
    </div>
  );
}
