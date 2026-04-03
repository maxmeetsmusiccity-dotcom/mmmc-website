import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';
import { supabase } from '../lib/supabase';

interface CuratorSummary {
  id: string;
  display_name: string;
  username: string;
  genre_focus: string[];
  avatar_url: string;
}

interface SubmissionSummary {
  id: string;
  track_url: string;
  pitch: string;
  status: string;
  created_at: string;
}

export default function Dashboard() {
  const { isPublicist, isAdmin, hasTier, user } = useAuth();
  const [curators, setCurators] = useState<CuratorSummary[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionSummary[]>([]);
  const [tab, setTab] = useState<'curators' | 'submissions' | 'intelligence' | 'admin'>('curators');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    // Load curators
    supabase.from('user_profiles').select('id, display_name, username, genre_focus, avatar_url')
      .eq('user_role', 'curator').then(({ data }) => {
        setCurators(data || []);
      });
    // Load own submissions
    if (user?.email) {
      supabase.from('nmf_submissions').select('*')
        .eq('submitter_email', user.email)
        .order('created_at', { ascending: false })
        .then(({ data }) => { setSubmissions(data || []); });
    }
    setLoading(false);
  }, [user]);

  if (!isPublicist && !isAdmin) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: 12 }}>Publicist Access Required</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>This dashboard is for publicists and labels.</p>
          <Link to="/newmusicfriday" className="btn btn-gold">Go to NMF Tool</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      <header style={{
        padding: '16px 24px', borderBottom: '1px solid var(--midnight-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link to="/" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>MMMC</Link>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 600 }}>
            NMF <span style={{ color: 'var(--gold)' }}>Intelligence</span>
          </h1>
        </div>
        {isAdmin && (
          <Link to="/newmusicfriday" className="btn btn-sm">Curator View</Link>
        )}
      </header>

      {/* Tabs */}
      <div style={{ padding: '0 24px', borderBottom: '1px solid var(--midnight-border)', display: 'flex', gap: 4 }}>
        {(['curators', 'submissions', 'intelligence', ...(isAdmin ? ['admin'] : [])] as const).map(t => (
          <button
            key={t}
            className={`filter-pill ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t as typeof tab)}
            style={{ borderRadius: '8px 8px 0 0', borderBottom: 'none' }}
          >
            {t === 'curators' ? 'Curator Directory' : t === 'submissions' ? 'My Submissions' : t === 'intelligence' ? 'Weekly Report' : 'Admin'}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: 24 }}>
        {loading && <p style={{ color: 'var(--text-muted)' }}>Loading...</p>}

        {/* Curator Directory */}
        {tab === 'curators' && (
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', marginBottom: 16 }}>Active Curators</h2>
            {curators.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No curators registered yet.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
                {curators.map(c => (
                  <Link key={c.id} to={`/curator/${c.username || c.id}`} className="card card-hover" style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {c.avatar_url ? (
                        <img src={c.avatar_url} alt="" style={{ width: 40, height: 40, borderRadius: '50%' }} />
                      ) : (
                        <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--midnight)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontWeight: 700 }}>
                          {(c.display_name || '?')[0].toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>{c.display_name || c.username}</p>
                        {c.genre_focus?.length > 0 && (
                          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{c.genre_focus.slice(0, 3).join(', ')}</p>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Submissions */}
        {tab === 'submissions' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem' }}>My Submissions</h2>
              <Link to="/newmusicfriday/submit" className="btn btn-sm btn-gold">Submit New Track</Link>
            </div>
            {!hasTier('submissions') && (
              <div className="card" style={{ marginBottom: 16, borderColor: 'var(--gold-dark)' }}>
                <p style={{ color: 'var(--gold)', fontSize: '0.85rem' }}>
                  Upgrade to Submissions tier ($199/mo) to see curator response rates and get match recommendations.
                </p>
              </div>
            )}
            {submissions.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No submissions yet. <Link to="/newmusicfriday/submit" style={{ color: 'var(--gold)' }}>Submit your first track.</Link></p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {submissions.map(s => (
                  <div key={s.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={{ fontSize: '0.85rem', fontWeight: 500 }}>{s.track_url}</p>
                      {s.pitch && <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: 2 }}>{s.pitch}</p>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="badge" style={{
                        background: s.status === 'accepted' ? 'rgba(61,168,119,0.15)' : s.status === 'skipped' ? 'rgba(204,53,53,0.15)' : 'rgba(255,255,255,0.08)',
                        color: s.status === 'accepted' ? '#3DA877' : s.status === 'skipped' ? 'var(--mmmc-red)' : 'var(--text-muted)',
                      }}>
                        {s.status}
                      </span>
                      <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>
                        {new Date(s.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Intelligence */}
        {tab === 'intelligence' && (
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', marginBottom: 16 }}>Weekly Intelligence</h2>
            {!hasTier('intelligence') ? (
              <div className="card" style={{ textAlign: 'center', padding: 48 }}>
                <h3 style={{ color: 'var(--gold)', marginBottom: 12 }}>Intelligence Tier Required</h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
                  The Weekly Intelligence Report shows which tracks are gaining traction across curators,
                  breakout picks, genre trends, and curator activity patterns.
                </p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Starting at $99/month</p>
              </div>
            ) : (
              <div>
                <p style={{ color: 'var(--text-secondary)' }}>
                  Full weekly intelligence report. Data aggregates every Friday from all active curators.
                </p>
                <Link to="/newmusicfriday/thisweek" className="btn btn-gold" style={{ marginTop: 16 }}>
                  View This Week's Report
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Admin */}
        {tab === 'admin' && isAdmin && (
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', marginBottom: 16 }}>Admin Panel</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
              <div className="card">
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Total Curators</p>
                <p className="mono" style={{ fontSize: '1.5rem', color: 'var(--gold)' }}>{curators.length}</p>
              </div>
              <div className="card">
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Total Submissions</p>
                <p className="mono" style={{ fontSize: '1.5rem', color: 'var(--gold)' }}>{submissions.length}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
