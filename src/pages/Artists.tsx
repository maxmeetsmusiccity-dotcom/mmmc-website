import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';

interface BrowseCategory {
  id: string;
  name: string;
  description: string;
  emoji: string;
  count?: number;
}

interface BrowseArtist {
  pg_id: string;
  name: string;
  tier: string;
  tier_display: string;
  arc_display: string;
  archetype_display: string;
  spotify_genres: string[];
  monthly_listeners: number;
  spotify_popularity: number;
  camp_name: string | null;
  no1_songs: number;
  credits: number;
  categories?: string[];
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const TIER_COLORS: Record<string, string> = {
  marquee: '#F5C453',
  rising: '#6aacda',
  developing: '#5a587a',
  emerging: '#3EE6C3',
  active: '#7A8CA0',
};

function formatListeners(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K';
  return String(n);
}

interface SpotifySearchResult {
  track_name: string;
  artist_names: string;
  album_name: string;
  release_date: string;
  cover_art_300: string;
  album_spotify_id: string;
  track_spotify_url: string;
}

export default function Artists() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<BrowseCategory[]>([]);
  const [allArtists, setAllArtists] = useState<BrowseArtist[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [liveResults, setLiveResults] = useState<SpotifySearchResult[]>([]);
  const [liveSearching, setLiveSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Live search via Spotify catalog when R2 data is empty or query doesn't match
  const doLiveSearch = useCallback((query: string) => {
    clearTimeout(debounceRef.current);
    if (query.trim().length < 2) { setLiveResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setLiveSearching(true);
      try {
        const names = query.split(/[,\n]/).map(n => n.trim()).filter(n => n.length > 1);
        const res = await fetch('/api/scan-artists', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ artistNames: names.length > 0 ? names : [query.trim()] }),
        });
        if (res.ok) {
          const data = await res.json();
          setLiveResults(data.tracks || []);
        }
      } catch { /* silent */ }
      finally { setLiveSearching(false); }
    }, 500);
  }, []);

  useEffect(() => {
    setLoading(true);
    // Fetch full artist data (the endpoint returns all when we request a big category)
    // First get categories, then load all artists
    Promise.all([
      fetch('/api/browse-artists').then(r => r.json()),
      // Request each category to build full list — or if R2 has all artists, one call suffices
      // For now, use search with empty query which returns all (via R2 fallback)
    ]).then(([catData]) => {
      setCategories(catData.categories || []);
      // If the API returns total_artists > 0, fetch by letter range
      if (catData.source === 'r2' && catData.total_artists > 0) {
        // Fetch all artists via search with wildcard
        fetch('/api/browse-artists?q=&limit=5000')
          .then(r => r.json())
          .then(d => setAllArtists(d.results || d.artists || []))
          .catch(() => {});
      }
    }).catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let list = allArtists;

    if (activeLetter) {
      list = list.filter(a => a.name.toUpperCase().startsWith(activeLetter));
    }

    if (activeCategory) {
      list = list.filter(a => (a.categories || []).includes(activeCategory));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(a =>
        a.name.toLowerCase().includes(q) ||
        (a.camp_name || '').toLowerCase().includes(q) ||
        (a.spotify_genres || []).some(g => g.toLowerCase().includes(q))
      );
    }

    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [allArtists, activeLetter, activeCategory, searchQuery]);

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a1a', color: '#e0e0e0', fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header */}
      <header style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 16 }}>
        <Link to="/" style={{ color: '#F5C453', textDecoration: 'none', fontSize: 14 }}>&larr; Home</Link>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#fff', margin: 0 }}>Artist Directory</h1>
        <span style={{ fontSize: 13, color: '#7A8CA0', marginLeft: 'auto' }}>
          {allArtists.length > 0 ? `${filtered.length} of ${allArtists.length} artists` : ''}
        </span>
      </header>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '16px 24px' }}>
        {/* Search */}
        <div style={{ marginBottom: 16 }}>
          <input
            type="text"
            placeholder={allArtists.length > 0 ? "Search artists, genres, camps..." : "Type artist names to search Spotify catalog..."}
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value);
              // If no R2 data loaded, do live Spotify search
              if (allArtists.length === 0) doLiveSearch(e.target.value);
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' && allArtists.length === 0) doLiveSearch(searchQuery);
            }}
            style={{
              width: '100%', maxWidth: 500, padding: '10px 14px', borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)',
              color: '#fff', fontSize: 14, outline: 'none',
            }}
          />
          {allArtists.length === 0 && searchQuery.trim().length >= 2 && (
            <button
              onClick={() => doLiveSearch(searchQuery)}
              disabled={liveSearching}
              style={{
                marginLeft: 8, padding: '10px 20px', borderRadius: 8,
                background: '#F5C453', color: '#0a0a1a', border: 'none',
                fontWeight: 600, fontSize: 14, cursor: 'pointer',
              }}
            >
              {liveSearching ? 'Searching...' : 'Search Spotify'}
            </button>
          )}
        </div>

        {/* Letter bar */}
        <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', marginBottom: 12 }}>
          <button
            onClick={() => setActiveLetter(null)}
            style={{
              padding: '4px 10px', borderRadius: 4, border: '1px solid',
              borderColor: !activeLetter ? '#F5C453' : 'rgba(255,255,255,0.1)',
              background: !activeLetter ? 'rgba(245,196,83,0.1)' : 'transparent',
              color: !activeLetter ? '#F5C453' : '#7A8CA0',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}
          >
            ALL
          </button>
          {LETTERS.map(l => (
            <button
              key={l}
              onClick={() => setActiveLetter(activeLetter === l ? null : l)}
              style={{
                padding: '4px 8px', borderRadius: 4, border: '1px solid',
                borderColor: activeLetter === l ? '#F5C453' : 'rgba(255,255,255,0.1)',
                background: activeLetter === l ? 'rgba(245,196,83,0.1)' : 'transparent',
                color: activeLetter === l ? '#F5C453' : '#7A8CA0',
                fontSize: 12, fontWeight: 600, cursor: 'pointer', minWidth: 28,
              }}
            >
              {l}
            </button>
          ))}
        </div>

        {/* Category filters */}
        {categories.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
            {categories.map(c => (
              <button
                key={c.id}
                onClick={() => setActiveCategory(activeCategory === c.id ? null : c.id)}
                style={{
                  padding: '5px 12px', borderRadius: 16, border: '1px solid',
                  borderColor: activeCategory === c.id ? '#3EE6C3' : 'rgba(255,255,255,0.08)',
                  background: activeCategory === c.id ? 'rgba(62,230,195,0.08)' : 'transparent',
                  color: activeCategory === c.id ? '#3EE6C3' : '#aaa',
                  fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap',
                }}
              >
                {c.emoji} {c.name}
              </button>
            ))}
          </div>
        )}

        {/* Loading / empty states */}
        {loading && <div style={{ color: '#7A8CA0', padding: 40, textAlign: 'center' }}>Loading artist directory...</div>}

        {!loading && allArtists.length === 0 && liveResults.length === 0 && !liveSearching && (
          <div style={{ color: '#7A8CA0', padding: 40, textAlign: 'center' }}>
            <p style={{ fontSize: 16, marginBottom: 8 }}>Type artist names above to search for new releases.</p>
            <p style={{ fontSize: 13 }}>You can enter multiple names separated by commas or newlines. Results come from the Spotify catalog.</p>
          </div>
        )}

        {/* Live Spotify search results */}
        {liveSearching && (
          <div style={{ color: '#F5C453', padding: 20, textAlign: 'center' }}>Searching Spotify catalog...</div>
        )}
        {liveResults.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <p style={{ color: '#F5C453', fontSize: 14, fontWeight: 600 }}>
                {liveResults.length} new release{liveResults.length !== 1 ? 's' : ''} found
              </p>
              <button
                onClick={() => {
                  // Navigate to NMF page and pass the tracks via sessionStorage
                  sessionStorage.setItem('nmf_import_tracks', JSON.stringify(liveResults));
                  navigate('/newmusicfriday?import=browse');
                }}
                style={{
                  padding: '8px 16px', borderRadius: 8,
                  background: '#F5C453', color: '#0a0a1a', border: 'none',
                  fontWeight: 600, fontSize: 13, cursor: 'pointer',
                }}
              >
                Import All to Curator Studio
              </button>
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 10,
            }}>
              {liveResults.map((t, i) => (
                <div key={`${t.album_spotify_id}-${i}`} style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: 8, padding: 10,
                  display: 'flex', gap: 10, alignItems: 'center',
                }}>
                  {t.cover_art_300 && (
                    <img src={t.cover_art_300} alt="" style={{ width: 48, height: 48, borderRadius: 4, flexShrink: 0 }} />
                  )}
                  <div style={{ overflow: 'hidden', flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.track_name}
                    </p>
                    <p style={{ fontSize: 12, color: '#7A8CA0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.artist_names} &middot; {t.album_name}
                    </p>
                    <p style={{ fontSize: 11, color: '#556' }}>{t.release_date}</p>
                  </div>
                  {t.track_spotify_url && (
                    <a href={t.track_spotify_url} target="_blank" rel="noopener" style={{ fontSize: 11, color: '#1DB954', flexShrink: 0 }}>
                      Spotify
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Artist grid */}
        {filtered.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 10,
          }}>
            {filtered.slice(0, 200).map(a => (
              <div
                key={a.pg_id}
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: 8,
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: TIER_COLORS[a.tier] || '#555', flexShrink: 0,
                  }} />
                  <a
                    href={`https://nashvilledecoder.com/profiles?pg=${a.pg_id}`}
                    target="_blank"
                    rel="noopener"
                    style={{ color: '#fff', textDecoration: 'none', fontWeight: 600, fontSize: 14 }}
                  >
                    {a.name}
                  </a>
                  {a.no1_songs > 0 && (
                    <span style={{ color: '#F5C453', fontSize: 11, fontWeight: 700 }}>
                      {a.no1_songs} #1{a.no1_songs > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: '#7A8CA0', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span>{a.tier_display || a.tier}</span>
                  {a.credits > 0 && <span>{a.credits} credits</span>}
                  {a.monthly_listeners > 0 && <span>{formatListeners(a.monthly_listeners)} listeners</span>}
                </div>
                {a.camp_name && (
                  <div style={{ fontSize: 11, color: '#556' }}>Camp: {a.camp_name}</div>
                )}
                {(a.spotify_genres || []).length > 0 && (
                  <div style={{ fontSize: 11, color: '#556', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.spotify_genres.slice(0, 3).join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {filtered.length > 200 && (
          <div style={{ textAlign: 'center', padding: 16, color: '#7A8CA0', fontSize: 13 }}>
            Showing 200 of {filtered.length}. Use search or filters to narrow results.
          </div>
        )}
      </div>
    </div>
  );
}
