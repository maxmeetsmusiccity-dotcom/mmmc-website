import { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { listWeeks, searchFeatures, type NMFWeek, type NMFFeature } from '../lib/supabase';

export default function Archive() {
  const [weeks, setWeeks] = useState<NMFWeek[]>([]);
  const [features, setFeatures] = useState<NMFFeature[]>([]);
  const [search, setSearch] = useState('');
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    listWeeks().then(w => { setWeeks(w); setLoading(false); });
  }, []);

  const handleSearch = (query: string) => {
    setSearch(query);
    clearTimeout(debounceRef.current);
    if (query.length < 2) { setFeatures([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      const results = await searchFeatures(query);
      setFeatures(results);
      setSearching(false);
    }, 300);
  };

  // Group search results by week
  const featuresByWeek = useMemo(() => {
    const map = new Map<string, NMFFeature[]>();
    for (const f of features) {
      const arr = map.get(f.week_date) || [];
      arr.push(f);
      map.set(f.week_date, arr);
    }
    return map;
  }, [features]);

  const formatDate = (d: string) => {
    return new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
    });
  };

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Header */}
      <header style={{
        padding: '16px 24px', borderBottom: '1px solid var(--midnight-border)',
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <Link to="/" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>MMMC</Link>
        <Link to="/newmusicfriday" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>NMF</Link>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 600 }}>
          Archive
        </h1>
      </header>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h2 style={{
            fontFamily: 'var(--font-display)', fontSize: 'clamp(1.5rem, 4vw, 2.5rem)',
            fontWeight: 700, marginBottom: 8,
          }}>
            New Music Friday <span style={{ color: 'var(--gold)' }}>Archive</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
            Every week's picks from Max Meets Music City.
          </p>
          <input
            type="text"
            className="search-input"
            placeholder="Search by artist or song title..."
            value={search}
            onChange={e => handleSearch(e.target.value)}
            style={{ maxWidth: 480 }}
          />
        </div>

        {/* Search results */}
        {search.length >= 2 && (
          <div style={{ marginBottom: 32 }}>
            {searching ? (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Searching...</p>
            ) : features.length > 0 ? (
              <>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: 16 }}>
                  <span className="mono">{features.length}</span> results for "{search}"
                </p>
                {Array.from(featuresByWeek.entries()).map(([weekDate, weekFeatures]) => (
                  <div key={weekDate} style={{ marginBottom: 16 }}>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', color: 'var(--gold)', marginBottom: 8 }}>
                      {formatDate(weekDate)}
                    </h3>
                    {weekFeatures.map(f => (
                      <div key={f.id} style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '8px 12px', borderRadius: 8,
                        background: 'var(--midnight-raised)', marginBottom: 4,
                      }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{f.track_name}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{f.artist_name}</span>
                        {f.was_cover_feature && (
                          <span className="badge" style={{ background: 'rgba(204,53,53,0.15)', color: 'var(--mmmc-red)' }}>
                            Cover
                          </span>
                        )}
                        <span className="mono" style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                          Slide {f.slide_number}, Pos {f.slide_position}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </>
            ) : (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>No results found.</p>
            )}
          </div>
        )}

        {/* Week list */}
        {!search && (
          loading ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Loading archive...</p>
          ) : weeks.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>
              No weeks archived yet. Complete your first NMF session to start the archive.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {weeks.map(week => {
                const selections = (week.selections as Array<{ track: { track_name: string; artist_names: string; cover_art_64: string; track_spotify_url: string }; slideGroup: number; positionInSlide: number; isCoverFeature: boolean }>) || [];
                const isExpanded = expandedWeek === week.week_date;

                return (
                  <div key={week.week_date} className="card">
                    <div
                      style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      onClick={() => setExpandedWeek(isExpanded ? null : week.week_date)}
                    >
                      <div>
                        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem' }}>
                          {formatDate(week.week_date)}
                        </h3>
                        <div style={{ display: 'flex', gap: 12, fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                          <span className="mono">{selections.length} tracks</span>
                          {week.playlist_master_pushed && <span style={{ color: 'var(--spotify-green)' }}>Playlist</span>}
                          {week.carousel_generated && <span style={{ color: 'var(--gold)' }}>Carousel</span>}
                        </div>
                      </div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '1.2rem' }}>
                        {isExpanded ? '▾' : '▸'}
                      </span>
                    </div>

                    {isExpanded && selections.length > 0 && (
                      <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
                        {selections.map((sel, i) => (
                          <div key={i} style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '6px 8px', borderRadius: 6,
                            background: 'var(--midnight)',
                          }}>
                            {sel.track.cover_art_64 && (
                              <img
                                src={sel.track.cover_art_64}
                                alt=""
                                style={{ width: 32, height: 32, borderRadius: 4 }}
                              />
                            )}
                            <div style={{ overflow: 'hidden', flex: 1 }}>
                              <p style={{ fontSize: '0.75rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {sel.track.track_name}
                              </p>
                              <p style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {sel.track.artist_names}
                              </p>
                            </div>
                            <a
                              href={sel.track.track_spotify_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ fontSize: '0.55rem', color: 'var(--spotify-green)' }}
                              onClick={e => e.stopPropagation()}
                            >
                              Spotify
                            </a>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>
    </div>
  );
}
