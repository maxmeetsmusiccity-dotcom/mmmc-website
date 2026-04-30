import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';
import ProductNav from '../components/ProductNav';
import NavBar from '../components/NavBar';
import Footer from '../components/Footer';
import { supabase } from '../lib/supabase';

interface CuratorSummary {
  id: string;
  display_name: string;
  username: string;
  genre_focus: string[];
  avatar_url: string;
  weeks_active?: number;
  avg_tracks_per_week?: number;
}

interface SubmissionSummary {
  id: string;
  track_url: string;
  pitch: string;
  status: string;
  created_at: string;
  genre?: string;
  artist_name?: string;
}

function logUsageEvent(action: string, metadata?: Record<string, unknown>) {
  if (!supabase) return;
  supabase.from('usage_events').insert({
    action,
    metadata: metadata || {},
    created_at: new Date().toISOString(),
  }).then(() => {});
}

export default function Dashboard() {
  const { isPublicist, isAdmin, hasTier, user, tier } = useAuth();
  const [curators, setCurators] = useState<CuratorSummary[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionSummary[]>([]);
  const [tab, setTab] = useState<'curators' | 'submissions' | 'intelligence' | 'admin'>('curators');
  const [loading, setLoading] = useState(true);
  const [genreFilter, setGenreFilter] = useState('');
  const [curatorSearch, setCuratorSearch] = useState('');
  const [usageStats, setUsageStats] = useState<{ total_events: number; unique_users: number }>({ total_events: 0, unique_users: 0 });

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    logUsageEvent('dashboard_view', { tab });

    const queries: Promise<unknown>[] = [
      Promise.resolve(supabase.from('user_profiles').select('id, display_name, username, genre_focus, avatar_url')
        .eq('user_role', 'curator')).then(({ data }) => setCurators(data || [])),
    ];

    if (user?.email) {
      queries.push(
        Promise.resolve(supabase.from('nmf_submissions').select('*')
          .eq('submitter_email', user.email)
          .order('created_at', { ascending: false })).then(({ data }) => setSubmissions(data || []))
      );
    }

    if (isAdmin) {
      queries.push(
        Promise.resolve(supabase.from('usage_events').select('id', { count: 'exact', head: true }))
          .then(({ count }) => setUsageStats(prev => ({ ...prev, total_events: count || 0 })))
      );
    }

    Promise.all(queries).finally(() => setLoading(false));
  }, [user, isAdmin, tab]);

  // All unique genres across curators
  const allGenres = useMemo(() => {
    const genres = new Set<string>();
    for (const c of curators) {
      for (const g of c.genre_focus || []) genres.add(g);
    }
    return Array.from(genres).sort();
  }, [curators]);

  // Filtered curators
  const filteredCurators = useMemo(() => {
    let result = [...curators];
    if (genreFilter) {
      result = result.filter(c => c.genre_focus?.includes(genreFilter));
    }
    if (curatorSearch) {
      const q = curatorSearch.toLowerCase();
      result = result.filter(c =>
        (c.display_name || '').toLowerCase().includes(q) ||
        (c.username || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [curators, genreFilter, curatorSearch]);

  // Submission status counts
  const statusCounts = useMemo(() => {
    const counts = { pending: 0, viewed: 0, accepted: 0, skipped: 0 };
    for (const s of submissions) {
      const status = s.status as keyof typeof counts;
      if (status in counts) counts[status]++;
    }
    return counts;
  }, [submissions]);

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
      <NavBar title="Dashboard" />
      <header style={{
        padding: '16px 24px', borderBottom: '1px solid var(--midnight-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <ProductNav showAdmin={isAdmin} />
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-2xl)', fontWeight: 600 }}>
            NMF <span style={{ color: 'var(--gold)' }}>Intelligence</span>
          </h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="badge" style={{
            background: tier === 'free' ? 'rgba(255,255,255,0.08)' : 'rgba(212,168,67,0.15)',
            color: tier === 'free' ? 'var(--text-muted)' : 'var(--gold)',
          }}>
            {tier}
          </span>
        </div>
      </header>

      {/* Tabs */}
      <div data-testid="dashboard-tabs" style={{ padding: '0 24px', borderBottom: '1px solid var(--midnight-border)', display: 'flex', gap: 4, overflowX: 'auto' }}>
        {(['curators', 'submissions', 'intelligence', ...(isAdmin ? ['admin'] : [])] as const).map(t => (
          <button
            key={t}
            data-testid={`dashboard-tab-${t}`}
            className={`filter-pill ${tab === t ? 'active' : ''}`}
            onClick={() => { setTab(t as typeof tab); logUsageEvent('tab_switch', { tab: t }); }}
            style={{ borderRadius: '8px 8px 0 0', borderBottom: 'none', whiteSpace: 'nowrap' }}
          >
            {t === 'curators' ? `Curators (${curators.length})` : t === 'submissions' ? `Submissions (${submissions.length})` : t === 'intelligence' ? 'Weekly Report' : 'Admin'}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: 24 }}>
        {loading && <p style={{ color: 'var(--text-muted)' }}>Loading...</p>}

        {/* Curator Directory */}
        {tab === 'curators' && (
          <div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                data-testid="dashboard-search-curators"
                type="text" placeholder="Search curators..."
                className="search-input" value={curatorSearch}
                onChange={e => setCuratorSearch(e.target.value)}
                style={{ maxWidth: 240 }}
              />
              <select
                data-testid="dashboard-filter-genre"
                value={genreFilter}
                onChange={e => setGenreFilter(e.target.value)}
                style={{
                  background: 'var(--midnight)', border: '1px solid var(--midnight-border)',
                  borderRadius: 8, color: 'var(--text-secondary)', padding: '8px 12px',
                  fontSize: 'var(--fs-md)',
                }}
              >
                <option value="">All Genres</option>
                {allGenres.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              <span style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-sm)' }}>
                {filteredCurators.length} curator{filteredCurators.length !== 1 ? 's' : ''}
              </span>
            </div>

            {filteredCurators.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>
                {curators.length === 0 ? 'No curators registered yet.' : 'No curators match your filters.'}
              </p>
            ) : (
              <div data-testid="dashboard-curator-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                {filteredCurators.map(c => (
                  <Link key={c.id} to={`/curator/${c.username || c.id}`} className="card card-hover"
                    style={{ textDecoration: 'none', color: 'inherit' }}
                    onClick={() => logUsageEvent('curator_profile_view', { curator_id: c.id })}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {c.avatar_url ? (
                        <img src={c.avatar_url} alt="" style={{ width: 40, height: 40, borderRadius: '50%' }} />
                      ) : (
                        <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--midnight)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontWeight: 700 }}>
                          {(c.display_name || '?')[0].toUpperCase()}
                        </div>
                      )}
                      <div style={{ flex: 1 }}>
                        <p style={{ fontWeight: 600, fontSize: 'var(--fs-lg)' }}>{c.display_name || c.username}</p>
                        {c.genre_focus?.length > 0 && (
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                            {c.genre_focus.slice(0, 3).map(g => (
                              <span key={g} className="badge" style={{ background: 'rgba(94,142,168,0.15)', color: 'var(--steel-light)', fontSize: 'var(--fs-3xs)', padding: '1px 6px' }}>
                                {g}
                              </span>
                            ))}
                          </div>
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
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-2xl)' }}>My Submissions</h2>
              <Link data-testid="dashboard-cta-submit-new" to="/newmusicfriday/submit" className="btn btn-sm btn-gold">Submit New Track</Link>
            </div>

            {/* Status summary */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              {Object.entries(statusCounts).map(([status, count]) => (
                <div key={status} className="card" style={{ flex: 1, textAlign: 'center', padding: 12 }}>
                  <p className="mono" style={{ fontSize: 'var(--fs-2xl)', color: status === 'accepted' ? '#3DA877' : status === 'skipped' ? 'var(--mmmc-red)' : 'var(--gold)' }}>{count}</p>
                  <p style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{status}</p>
                </div>
              ))}
            </div>

            {!hasTier('submissions') && (
              <div className="card" style={{ marginBottom: 16, borderColor: 'var(--gold-dark)' }}>
                <p style={{ color: 'var(--gold)', fontSize: 'var(--fs-md)' }}>
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
                      <p style={{ fontSize: 'var(--fs-md)', fontWeight: 500 }}>{s.artist_name || s.track_url}</p>
                      {s.pitch && <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', marginTop: 2 }}>{s.pitch.slice(0, 100)}{s.pitch.length > 100 ? '...' : ''}</p>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="badge" style={{
                        background: s.status === 'accepted' ? 'rgba(61,168,119,0.15)' : s.status === 'skipped' ? 'rgba(204,53,53,0.15)' : s.status === 'viewed' ? 'rgba(94,142,168,0.15)' : 'rgba(255,255,255,0.08)',
                        color: s.status === 'accepted' ? '#3DA877' : s.status === 'skipped' ? 'var(--mmmc-red)' : s.status === 'viewed' ? 'var(--steel-light)' : 'var(--text-muted)',
                      }}>
                        {s.status}
                      </span>
                      <span style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)' }}>
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
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-2xl)', marginBottom: 16 }}>Weekly Intelligence</h2>
            {!hasTier('intelligence') ? (
              <div className="card" style={{ textAlign: 'center', padding: 48 }}>
                <h3 style={{ color: 'var(--gold)', marginBottom: 12 }}>Intelligence Tier Required</h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 24, maxWidth: 400, margin: '0 auto 24px' }}>
                  The Weekly Intelligence Report shows which tracks are gaining traction across curators,
                  breakout picks, genre trends, and curator activity patterns.
                </p>
                <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-md)' }}>Starting at $99/month</p>
              </div>
            ) : (
              <div>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>
                  Full weekly intelligence report. Data aggregates every Friday from all active curators.
                </p>
                <Link to="/newmusicfriday/thisweek" className="btn btn-gold">
                  View This Week's Report
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Admin */}
        {tab === 'admin' && isAdmin && (
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-2xl)', marginBottom: 16 }}>Admin Panel</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
              <div className="card" style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>Total Curators</p>
                <p className="mono" style={{ fontSize: 'var(--fs-3xl)', color: 'var(--gold)' }}>{curators.length}</p>
              </div>
              <div className="card" style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>Total Submissions</p>
                <p className="mono" style={{ fontSize: 'var(--fs-3xl)', color: 'var(--gold)' }}>{submissions.length}</p>
              </div>
              <div className="card" style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>Usage Events</p>
                <p className="mono" style={{ fontSize: 'var(--fs-3xl)', color: 'var(--gold)' }}>{usageStats.total_events}</p>
              </div>
              <div className="card" style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>Genres Tracked</p>
                <p className="mono" style={{ fontSize: 'var(--fs-3xl)', color: 'var(--gold)' }}>{allGenres.length}</p>
              </div>
            </div>

            <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: 12 }}>Subscription Tiers</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
              {[
                { name: 'Free (Curator)', price: '$0', features: ['NMF scan', 'Carousel generation', 'Playlist push'] },
                { name: 'Intelligence', price: '$99/mo', features: ['Weekly reports', 'Curator analytics', 'Genre trends'] },
                { name: 'Submissions', price: '$199/mo', features: ['Track submissions', 'Match scores', 'Response tracking'] },
                { name: 'Priority', price: '$499/mo', features: ['Priority placement', 'Direct curator access', 'ND data preview'] },
              ].map(t => (
                <div key={t.name} className="card" style={{ padding: 16 }}>
                  <p style={{ fontWeight: 600, fontSize: 'var(--fs-lg)', marginBottom: 4 }}>{t.name}</p>
                  <p style={{ color: 'var(--gold)', fontSize: 'var(--fs-md)', marginBottom: 8 }}>{t.price}</p>
                  <ul style={{ listStyle: 'none', padding: 0 }}>
                    {t.features.map(f => (
                      <li key={f} style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', marginBottom: 2 }}>
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
