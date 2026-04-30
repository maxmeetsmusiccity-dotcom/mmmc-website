import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth-context';
import ProductNav from '../components/ProductNav';
import NavBar from '../components/NavBar';
import Footer from '../components/Footer';

export default function Submit() {
  const { user } = useAuth();
  const [trackUrl, setTrackUrl] = useState('');
  const [pitch, setPitch] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [label, setLabel] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { setError('Please sign in to submit a track.'); return; }
    if (!trackUrl || !name || !email) { setError('Track URL, name, and email are required.'); return; }
    setSubmitting(true);
    setError('');
    try {
      if (supabase) {
        const { error: dbError } = await supabase.from('nmf_submissions').insert({
          track_url: trackUrl, pitch, submitter_name: name,
          submitter_email: email, label_name: label || null,
        });
        if (dbError) throw dbError;
      }
      setSubmitted(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh' }}>
      <NavBar title="Submit" />
      <header style={{
        padding: '16px 24px', borderBottom: '1px solid var(--midnight-border)',
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <ProductNav />
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-2xl)', fontWeight: 600 }}>Submit a Track</h1>
      </header>

      <div style={{ maxWidth: 520, margin: '0 auto', padding: 32 }}>
        {submitted ? (
          <div data-testid="submit-success" style={{ textAlign: 'center', padding: '48px 0' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-3xl)', marginBottom: 12, color: 'var(--gold)' }}>
              Submitted!
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
              Your track has been submitted for consideration. We review submissions weekly.
            </p>
            <button data-testid="submit-success-cta" className="btn btn-gold" onClick={() => { setSubmitted(false); setTrackUrl(''); setPitch(''); }}>
              Submit Another
            </button>
          </div>
        ) : (
          <>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.6 }}>
              Submit a track for consideration on New Music Friday. We review submissions every Thursday for the following week's picks.
            </p>

            <form data-testid="submit-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input data-testid="submit-input-track-url" className="search-input" type="url" placeholder="Spotify or Apple Music URL *" value={trackUrl} onChange={e => setTrackUrl(e.target.value)} required />
              <textarea data-testid="submit-input-pitch" className="search-input" placeholder="One-liner pitch (optional)" value={pitch} onChange={e => setPitch(e.target.value)} rows={2} style={{ resize: 'vertical' }} />
              <input data-testid="submit-input-name" className="search-input" type="text" placeholder="Your name *" value={name} onChange={e => setName(e.target.value)} required />
              <input data-testid="submit-input-email" className="search-input" type="email" placeholder="Your email *" value={email} onChange={e => setEmail(e.target.value)} required />
              <input data-testid="submit-input-label" className="search-input" type="text" placeholder="Label (optional)" value={label} onChange={e => setLabel(e.target.value)} />

              {error && <p data-testid="submit-error" style={{ color: 'var(--mmmc-red)', fontSize: 'var(--fs-md)' }}>{error}</p>}

              <button data-testid="submit-button-track" className="btn btn-gold" type="submit" disabled={submitting} style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}>
                {submitting ? 'Submitting...' : 'Submit Track'}
              </button>
            </form>
          </>
        )}
      </div>
      <Footer />
    </div>
  );
}
