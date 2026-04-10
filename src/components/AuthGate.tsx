import { useState } from 'react';
import { useAuth } from '../lib/auth-context';

interface Props {
  children: React.ReactNode;
}

export default function AuthGate({ children }: Props) {
  const { user, loading, isGuest, signInWithGoogle, signInWithApple, signInWithEmail, signUpWithEmail, continueAsGuest } = useAuth();
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

  // If signed in via OAuth redirect (URL has access_token or code), auto-enter
  const isOAuthReturn = window.location.hash.includes('access_token') || window.location.search.includes('code=');
  if (user && isOAuthReturn && sessionStorage.getItem('nmf_entered') !== '1') {
    sessionStorage.setItem('nmf_entered', '1');
  }
  // If signed in (any method), auto-enter — no need to show landing page again
  if (user) {
    if (sessionStorage.getItem('nmf_entered') !== '1') sessionStorage.setItem('nmf_entered', '1');
    return <>{children}</>;
  }
  const hasEntered = sessionStorage.getItem('nmf_entered') === '1';
  if (isGuest && hasEntered) return <>{children}</>;

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
      const msg = (e as Error).message;
      if (msg.includes('security purposes') || msg.includes('rate limit')) {
        setError('Please wait a moment before trying again. For faster access, use "Get Started as a Guest" or sign in with Google.');
      } else if (msg.includes('Invalid login')) {
        setError('Invalid email or password. Try again or use "Get Started as a Guest" to enter without an account.');
      } else {
        setError(msg);
      }
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
      <div className="animate-float-up" style={{ maxWidth: 560, width: '100%' }}>
        {/* Logo + Heading — scales down on mobile via clamp */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(12px, 3vw, 20px)', justifyContent: 'center', marginBottom: 'clamp(6px, 1.5vw, 12px)' }}>
          <img
            src="/mmmc-logo-hires.png"
            alt="Max Meets Music City"
            style={{ width: 'clamp(64px, 14vw, 100px)', height: 'clamp(64px, 14vw, 100px)', borderRadius: 14, objectFit: 'cover', flexShrink: 0 }}
          />
          <h1 style={{
            fontFamily: 'var(--font-display)', fontSize: 'clamp(1.6rem, 5.5vw, 3.25rem)',
            fontWeight: 700, lineHeight: 1.15, textAlign: 'left',
          }}>
            New Music <span style={{ color: 'var(--gold)' }}>Friday</span> Curator
          </h1>
        </div>

        <p style={{ color: 'var(--text-secondary)', fontSize: 'clamp(var(--fs-md), 2.5vw, var(--fs-xl))', lineHeight: 1.6, marginBottom: 'clamp(10px, 2vw, 20px)' }}>
          For everyone who listens to everything and finds the gems worth sharing. Every New Music Friday.
        </p>

        {/* What this does — bright feature cards */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 'clamp(8px, 1.5vw, 14px)', marginBottom: 'clamp(12px, 2vw, 20px)', textAlign: 'left',
        }}>
          {[
            { title: 'Discover', desc: 'Scan new releases from 8,000+ Nashville artists and songwriters, updated every Friday.' },
            { title: 'Curate', desc: 'Select and order your featured artists. Add your logo and choose your templates.' },
            { title: 'Export', desc: 'Generate your carousel and download a ZIP with every slide ready to post.' },
            { title: 'Connect', desc: 'Instagram handles found automatically. Build captions and come back every Friday.' },
          ].map(f => (
            <div key={f.title} className="card" style={{ padding: 'clamp(10px, 1.5vw, 16px)', border: '1px solid var(--gold)', background: 'rgba(212,168,67,0.06)' }}>
              <div style={{ fontWeight: 700, fontSize: 'clamp(var(--fs-md), 2vw, var(--fs-lg))', marginBottom: 4, color: 'var(--gold)' }}>{f.title}</div>
              <div style={{ fontSize: 'clamp(var(--fs-2xs), 1.5vw, var(--fs-sm))', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{f.desc}</div>
            </div>
          ))}
        </div>

        <p style={{ color: 'var(--text-muted)', fontSize: 'clamp(var(--fs-md), 2vw, var(--fs-lg))', lineHeight: 1.5, marginBottom: 'clamp(6px, 1vw, 10px)' }}>
          This tool exists because your work matters. You listen to everything, you find the gems, and you share them with the world. I built this tool to accelerate that work.
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: 'clamp(var(--fs-md), 2vw, var(--fs-lg))', lineHeight: 1.5, marginBottom: 'clamp(16px, 3vw, 28px)' }}>
          The MMMC NMF Curator exists to save your valuable time, so you can focus on what you do best: telling the stories about the songs that define Music City.
        </p>

        {/* Continue as Guest */}
        <button
          className="btn btn-gold"
          onClick={() => { continueAsGuest(); sessionStorage.setItem('nmf_entered', '1'); }}
          style={{ width: '100%', justifyContent: 'center', fontSize: 'clamp(var(--fs-lg), 2.5vw, var(--fs-xl))', padding: 'clamp(12px, 2vw, 16px) 0', marginBottom: 'clamp(10px, 1.5vw, 14px)' }}
        >
          Get Started as a Guest
        </button>

        {/* Sign-In Options */}
        <button
          className="btn"
          onClick={() => { sessionStorage.setItem('nmf_entered', '1'); signInWithGoogle(); }}
          style={{ width: '100%', justifyContent: 'center', fontSize: 'clamp(var(--fs-md), 2vw, var(--fs-lg))', padding: 'clamp(10px, 1.5vw, 14px) 0', marginBottom: 'clamp(6px, 1vw, 10px)' }}
        >
          Sign in with Google
        </button>
        <button
          className="btn"
          onClick={() => { sessionStorage.setItem('nmf_entered', '1'); signInWithApple(); }}
          style={{ width: '100%', justifyContent: 'center', fontSize: 'clamp(var(--fs-md), 2vw, var(--fs-lg))', padding: 'clamp(10px, 1.5vw, 14px) 0', marginBottom: 'clamp(10px, 1.5vw, 14px)' }}
        >
          Sign in with Apple
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

        {/* Account benefits callout */}
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-sm)', fontStyle: 'italic', lineHeight: 1.5, marginTop: 24 }}>
          Sign in to make it yours. Your carousels, your templates, your preferences — all saved and waiting for you next Friday.
        </p>

        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-2xs)', marginTop: 16, lineHeight: 1.5 }}>
          Free forever for curators. Made in Nashville by <a href="https://instagram.com/maxmeetsmusiccity" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--gold)' }}>Max Meets Music City</a>.
        </p>
      </div>
    </div>
  );
}
