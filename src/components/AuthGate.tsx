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

  // Authenticated or guest — show the app. Admin status is determined by
  // email allowlist in auth-context.tsx (no URL-param bypass).
  if (user || isGuest) return <>{children}</>;

  const handleEmail = async () => {
    if (isSignUp && !tosAccepted) {
      setError('You must accept the Terms of Service to create an account.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
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
      <div className="animate-float-up" style={{ maxWidth: 400, width: '100%' }}>
        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 5vw, 2.75rem)',
          fontWeight: 700, marginBottom: 8, lineHeight: 1.15,
        }}>
          New Music <span style={{ color: 'var(--gold)' }}>Friday</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 36, fontSize: '1rem', lineHeight: 1.5 }}>
          Discover new releases, build Instagram carousels, push to Spotify playlists.
        </p>

        {/* Continue as Guest */}
        <button
          className="btn btn-gold"
          onClick={continueAsGuest}
          style={{ width: '100%', justifyContent: 'center', fontSize: '1rem', padding: '14px 0', marginBottom: 12 }}
        >
          Continue as Guest
        </button>

        {/* Google Sign-In */}
        <button
          className="btn"
          onClick={signInWithGoogle}
          style={{ width: '100%', justifyContent: 'center', fontSize: '0.9rem', padding: '12px 0', marginBottom: 12 }}
        >
          Sign in with Google
        </button>

        {/* Email */}
        <details style={{ textAlign: 'left', marginTop: 8 }}>
          <summary style={{ color: 'var(--text-muted)', fontSize: '0.8rem', cursor: 'pointer', textAlign: 'center' }}>
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
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: '0.7rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <input type="checkbox" checked={tosAccepted} onChange={e => setTosAccepted(e.target.checked)} style={{ marginTop: 2 }} />
                <span>
                  I agree to the <a href="/terms" target="_blank" style={{ color: 'var(--gold)' }}>Terms of Service</a> and <a href="/privacy" target="_blank" style={{ color: 'var(--gold)' }}>Privacy Policy</a>
                </span>
              </label>
            )}
            {error && <p style={{ color: 'var(--mmmc-red)', fontSize: '0.75rem' }}>{error}</p>}
            <button className="btn btn-sm btn-gold" onClick={handleEmail} disabled={submitting || (isSignUp && !tosAccepted)} style={{ width: '100%', justifyContent: 'center' }}>
              {submitting ? '...' : isSignUp ? 'Create Account' : 'Sign In'}
            </button>
            <button onClick={() => { setIsSignUp(!isSignUp); setError(''); }} style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              {isSignUp ? 'Already have an account? Sign in' : 'Need an account? Sign up'}
            </button>
          </div>
        </details>

        {/* Feature cards */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 12, marginTop: 40, opacity: 0.5, textAlign: 'left',
        }}>
          {[
            { title: 'Scan Releases', desc: 'Find new music from your followed artists' },
            { title: 'Build Carousel', desc: 'Instagram-ready 1080x1080 slides' },
            { title: 'Tag Blocks', desc: 'Auto-resolve Instagram handles' },
            { title: 'Push to Playlist', desc: 'One-click Spotify playlist update' },
          ].map(f => (
            <div key={f.title} className="card" style={{ padding: 12 }}>
              <div style={{ fontWeight: 600, fontSize: '0.8rem', marginBottom: 2 }}>{f.title}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
