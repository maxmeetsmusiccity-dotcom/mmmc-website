import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function Submit() {
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
      <header style={{
        padding: '16px 24px', borderBottom: '1px solid var(--midnight-border)',
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <Link to="/" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>MMMC</Link>
        <Link to="/newmusicfriday" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>NMF</Link>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 600 }}>Submit a Track</h1>
      </header>

      <div style={{ maxWidth: 520, margin: '0 auto', padding: 32 }}>
        {submitted ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', marginBottom: 12, color: 'var(--gold)' }}>
              Submitted!
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
              Your track has been submitted for consideration. We review submissions weekly.
            </p>
            <button className="btn btn-gold" onClick={() => { setSubmitted(false); setTrackUrl(''); setPitch(''); }}>
              Submit Another
            </button>
          </div>
        ) : (
          <>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.6 }}>
              Submit a track for consideration on New Music Friday. We review submissions every Thursday for the following week's picks.
            </p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input className="search-input" type="url" placeholder="Spotify or Apple Music URL *" value={trackUrl} onChange={e => setTrackUrl(e.target.value)} required />
              <textarea className="search-input" placeholder="One-liner pitch (optional)" value={pitch} onChange={e => setPitch(e.target.value)} rows={2} style={{ resize: 'vertical' }} />
              <input className="search-input" type="text" placeholder="Your name *" value={name} onChange={e => setName(e.target.value)} required />
              <input className="search-input" type="email" placeholder="Your email *" value={email} onChange={e => setEmail(e.target.value)} required />
              <input className="search-input" type="text" placeholder="Label (optional)" value={label} onChange={e => setLabel(e.target.value)} />

              {error && <p style={{ color: 'var(--mmmc-red)', fontSize: '0.8rem' }}>{error}</p>}

              <button className="btn btn-gold" type="submit" disabled={submitting} style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}>
                {submitting ? 'Submitting...' : 'Submit Track'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
