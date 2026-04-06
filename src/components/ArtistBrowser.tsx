import { useState, useEffect } from 'react';

interface BrowseCategory {
  id: string;
  name: string;
  description: string;
  emoji: string;
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
}

interface Props {
  /** Called when user confirms their artist selection for scanning */
  onScanArtists: (names: string[]) => void;
  scanning: boolean;
}

export default function ArtistBrowser({ onScanArtists, scanning }: Props) {
  const [categories, setCategories] = useState<BrowseCategory[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [artists, setArtists] = useState<BrowseArtist[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<(BrowseArtist & { categories: BrowseCategory[] })[]>([]);
  const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');

  // Load categories on mount
  useEffect(() => {
    fetch('/api/browse-artists')
      .then(r => r.json())
      .then(d => setCategories(d.categories || []))
      .catch(() => setError('Could not load categories'));
  }, []);

  // Load artists when category changes
  useEffect(() => {
    if (!activeCategory) { setArtists([]); return; }
    setLoading(true);
    setError('');
    fetch(`/api/browse-artists?category=${activeCategory}`)
      .then(r => r.json())
      .then(d => {
        setArtists(d.artists || []);
        if (d.artists?.length === 0) setError('No artists found in this category yet.');
      })
      .catch(() => setError('Failed to load artists'))
      .finally(() => setLoading(false));
  }, [activeCategory]);

  // Search with debounce
  useEffect(() => {
    if (searchQuery.length < 2) { setSearchResults([]); return; }
    const timer = setTimeout(() => {
      fetch(`/api/browse-artists?q=${encodeURIComponent(searchQuery)}`)
        .then(r => r.json())
        .then(d => setSearchResults(d.results || []))
        .catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const toggleArtist = (name: string) => {
    setSelectedNames(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const selectAll = () => {
    const names = new Set(selectedNames);
    for (const a of artists) names.add(a.name);
    setSelectedNames(names);
  };

  const formatListeners = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
    return n.toString();
  };

  const displayArtists = searchQuery.length >= 2 ? searchResults : artists;

  return (
    <div>
      {/* Search bar */}
      <div style={{ marginBottom: 12 }}>
        <input
          type="text"
          className="search-input"
          placeholder="Search artists by name..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{ width: '100%', fontSize: 'var(--fs-md)', padding: '8px 12px' }}
        />
      </div>

      {/* Category pills */}
      {searchQuery.length < 2 && (
        <div style={{
          display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16,
        }}>
          {categories.map(cat => (
            <button
              key={cat.id}
              className={`filter-pill ${activeCategory === cat.id ? 'active' : ''}`}
              onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
              style={{ fontSize: 'var(--fs-xs)', padding: '5px 12px' }}
              title={cat.description}
            >
              {cat.emoji} {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* Category description */}
      {activeCategory && !searchQuery && (
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginBottom: 12 }}>
          {categories.find(c => c.id === activeCategory)?.description}
        </p>
      )}

      {/* Artist grid */}
      {loading && (
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-md)', textAlign: 'center', padding: 24 }}>
          Loading artists...
        </p>
      )}

      {error && (
        <p style={{ color: 'var(--mmmc-red)', fontSize: 'var(--fs-sm)', marginBottom: 12 }}>{error}</p>
      )}

      {displayArtists.length > 0 && (
        <>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: 8,
          }}>
            <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
              {displayArtists.length} artists
              {selectedNames.size > 0 && (
                <span style={{ color: 'var(--gold)', fontWeight: 600, marginLeft: 8 }}>
                  {selectedNames.size} selected
                </span>
              )}
            </span>
            {!searchQuery && artists.length > 0 && (
              <button
                onClick={selectAll}
                style={{ fontSize: 'var(--fs-2xs)', color: 'var(--steel)', cursor: 'pointer' }}
              >
                Select All
              </button>
            )}
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 8, maxHeight: 400, overflowY: 'auto',
            padding: 4,
          }}>
            {displayArtists.map(artist => {
              const isSelected = selectedNames.has(artist.name);
              return (
                <button
                  key={artist.pg_id}
                  onClick={() => toggleArtist(artist.name)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
                    background: isSelected ? 'rgba(212,168,67,0.12)' : 'var(--midnight)',
                    border: isSelected ? '1px solid var(--gold-dark)' : '1px solid var(--midnight-border)',
                    transition: 'all 0.15s', textAlign: 'left',
                  }}
                >
                  {/* Checkbox indicator */}
                  <div style={{
                    width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                    border: isSelected ? '2px solid var(--gold)' : '2px solid var(--midnight-border)',
                    background: isSelected ? 'var(--gold)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--midnight)', fontSize: 'var(--fs-2xs)', fontWeight: 700,
                  }}>
                    {isSelected ? '\u2713' : ''}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 'var(--fs-md)', fontWeight: 600,
                      color: isSelected ? 'var(--gold)' : 'var(--text-primary)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {artist.name}
                    </div>
                    <div style={{
                      fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)',
                      display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2,
                    }}>
                      <span>{(artist.tier_display || artist.tier || '').split(' (')[0]}</span>
                      {artist.monthly_listeners > 0 && (
                        <span>{formatListeners(artist.monthly_listeners)} listeners</span>
                      )}
                      {artist.no1_songs > 0 && (
                        <span style={{ color: 'var(--gold)' }}>{artist.no1_songs} #1s</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Scan button */}
      {selectedNames.size > 0 && (
        <div style={{ marginTop: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            className="btn btn-gold"
            onClick={() => onScanArtists([...selectedNames])}
            disabled={scanning}
            style={{ fontSize: 'var(--fs-md)', padding: '10px 24px' }}
          >
            {scanning ? 'Scanning...' : `Scan ${selectedNames.size} Artists for New Releases`}
          </button>
          <button
            onClick={() => setSelectedNames(new Set())}
            style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            Clear
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !searchQuery && !activeCategory && categories.length > 0 && (
        <div style={{
          textAlign: 'center', padding: '24px 16px',
          color: 'var(--text-muted)', fontSize: 'var(--fs-md)',
        }}>
          Pick a category above or search for artists to build your follow list.
          <br />
          <span style={{ fontSize: 'var(--fs-xs)' }}>No Spotify login required.</span>
        </div>
      )}
    </div>
  );
}
