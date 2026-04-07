import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { NashvilleRelease } from '../lib/sources/nashville';

interface ShowcaseCategory {
  id: string;
  name: string;
  emoji: string;
  type: string;
  count: number;
}

interface Props {
  /** Called when user confirms their artist selection for scanning */
  onScanArtists: (names: string[]) => void;
  scanning: boolean;
}

/**
 * ArtistBrowser — shows only artists who released music this week,
 * filtered by showcase. Uses the same weekly Nashville release cache
 * as the Nashville source. No full artist directory is exposed.
 */
export default function ArtistBrowser({ onScanArtists, scanning }: Props) {
  const [showcases, setShowcases] = useState<ShowcaseCategory[]>([]);
  const [activeShowcase, setActiveShowcase] = useState<string | null>(null);
  const [showcaseArtists, setShowcaseArtists] = useState<Set<string>>(new Set());
  const [loadingShowcase, setLoadingShowcase] = useState(false);
  const [releases, setReleases] = useState<NashvilleRelease[]>([]);
  const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  // Load showcase categories on mount
  useEffect(() => {
    fetch('/api/browse-artists')
      .then(r => r.json())
      .then(d => {
        const cats = (d.categories || []).filter((c: ShowcaseCategory) => c.type === 'showcase');
        setShowcases(cats);
      })
      .catch(() => {});
  }, []);

  // Load weekly Nashville releases from Supabase cache (same as NashvilleReleases)
  useEffect(() => {
    (async () => {
      if (!supabase) return;
      const { data } = await supabase
        .from('weekly_nashville_releases')
        .select('*')
        .order('artist_name');
      if (data && data.length > 0) {
        setReleases(data.map(r => ({
          pg_id: r.spotify_artist_id || '',
          artist_name: r.artist_name,
          track_name: r.track_name,
          album_name: r.album_name,
          release_type: r.album_type || 'single',
          release_date: r.release_date,
          spotify_track_id: r.track_id,
          spotify_album_id: r.album_id || '',
          cover_art_url: r.cover_art_640 || '',
          cover_art_300: r.cover_art_300 || '',
          track_number: r.track_number || 1,
          duration_ms: r.duration_ms || 0,
          explicit: r.explicit || false,
          total_tracks: r.total_tracks || 1,
          is_charting: false,
        })));
      }
    })();
  }, []);

  // When a showcase is selected, fetch its artist list for filtering
  useEffect(() => {
    if (!activeShowcase) { setShowcaseArtists(new Set()); return; }
    setLoadingShowcase(true);
    fetch(`/api/browse-artists?category=${activeShowcase}`)
      .then(r => r.json())
      .then(d => {
        const names = new Set<string>((d.artists || []).map((a: { name: string }) => a.name.toLowerCase()));
        setShowcaseArtists(names);
      })
      .catch(() => setShowcaseArtists(new Set()))
      .finally(() => setLoadingShowcase(false));
  }, [activeShowcase]);

  // Filter releases: only show artists who released this week AND match showcase
  const filtered = (() => {
    let list = releases;
    if (activeShowcase && showcaseArtists.size > 0) {
      list = list.filter(r => {
        const primary = (r.artist_name || '').split(/,|feat\.|ft\./i)[0].trim().toLowerCase();
        return showcaseArtists.has(primary);
      });
    }
    if (searchQuery.length >= 2) {
      const q = searchQuery.toLowerCase();
      list = list.filter(r =>
        r.artist_name.toLowerCase().includes(q) ||
        r.track_name.toLowerCase().includes(q)
      );
    }
    return list;
  })();

  // Group by artist
  const artistGroups = (() => {
    const map = new Map<string, NashvilleRelease[]>();
    for (const r of filtered) {
      const key = (r.artist_name || '').split(/,|feat\.|ft\./i)[0].trim();
      const arr = map.get(key) || [];
      arr.push(r);
      map.set(key, arr);
    }
    return [...map.entries()].map(([name, tracks]) => ({
      name,
      tracks: tracks.sort((a, b) => (a.track_number || 0) - (b.track_number || 0)),
      cover: tracks[0].cover_art_300,
    })).sort((a, b) => a.name.localeCompare(b.name));
  })();

  const toggleArtist = (name: string) => {
    setSelectedNames(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  // Weekly release count per showcase
  const showcaseWeeklyCount = activeShowcase && showcaseArtists.size > 0
    ? releases.filter(r => {
        const primary = (r.artist_name || '').split(/,|feat\.|ft\./i)[0].trim().toLowerCase();
        return showcaseArtists.has(primary);
      }).length
    : null;

  return (
    <div>
      {/* Search */}
      <div style={{ marginBottom: 12 }}>
        <input
          type="text"
          className="search-input"
          placeholder="Search this week's artists..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{ width: '100%', fontSize: 'var(--fs-md)', padding: '8px 12px' }}
        />
      </div>

      {/* Showcase dropdown */}
      {showcases.length > 0 && (
        <select
          value={activeShowcase || ''}
          onChange={e => setActiveShowcase(e.target.value || null)}
          style={{
            width: '100%', padding: '8px 12px', borderRadius: 8, marginBottom: 12,
            background: 'var(--midnight)', border: '1px solid var(--midnight-border)',
            color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)',
            fontFamily: 'var(--font-mono)', cursor: 'pointer',
          }}
        >
          <option value="">All Nashville ({releases.length} releases this week)</option>
          {showcases.map(s => (
            <option key={s.id} value={s.id}>
              {s.emoji} {s.name}{s.id === activeShowcase && showcaseWeeklyCount !== null ? ` (${showcaseWeeklyCount} releases)` : ''}
            </option>
          ))}
        </select>
      )}

      {loadingShowcase && (
        <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginBottom: 8 }}>Loading...</p>
      )}

      {/* Selected artists bar — always visible when selections exist */}
      {selectedNames.size > 0 && (
        <div style={{
          padding: '8px 12px', marginBottom: 12, borderRadius: 8,
          background: 'rgba(212,168,67,0.08)', border: '1px solid var(--gold-dark)',
          display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--gold)', fontWeight: 600 }}>
            {selectedNames.size} selected:
          </span>
          {[...selectedNames].map(name => (
            <span key={name} style={{
              fontSize: 'var(--fs-2xs)', background: 'var(--gold)', color: 'var(--midnight)',
              padding: '2px 8px', borderRadius: 10, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4,
            }}>
              {name}
              <button onClick={() => toggleArtist(name)} style={{
                background: 'none', border: 'none', cursor: 'pointer', color: 'var(--midnight)',
                fontSize: 10, lineHeight: 1, padding: 0,
              }}>&times;</button>
            </span>
          ))}
          <button onClick={() => setSelectedNames(new Set())}
            style={{ fontSize: 'var(--fs-2xs)', color: 'var(--mmmc-red)', cursor: 'pointer', marginLeft: 'auto', background: 'none', border: 'none' }}>
            Clear All
          </button>
        </div>
      )}

      {/* Stats */}
      {artistGroups.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
            {artistGroups.length} artists with new music this week
          </span>
          <button onClick={() => { for (const g of artistGroups) selectedNames.add(g.name); setSelectedNames(new Set(selectedNames)); }}
            style={{ fontSize: 'var(--fs-2xs)', color: 'var(--steel)', cursor: 'pointer', background: 'none', border: 'none' }}>
            Select All
          </button>
        </div>
      )}

      {/* Artist list */}
      <div style={{ maxHeight: 400, overflowY: 'auto' }}>
        {artistGroups.map(g => {
          const isSelected = selectedNames.has(g.name);
          return (
            <div key={g.name} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px',
              borderBottom: '1px solid var(--midnight-border)', cursor: 'pointer',
              background: isSelected ? 'rgba(212,168,67,0.06)' : 'transparent',
            }} onClick={() => toggleArtist(g.name)}>
              <div style={{
                width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                border: isSelected ? '2px solid var(--gold)' : '2px solid var(--midnight-border)',
                background: isSelected ? 'var(--gold)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--midnight)', fontSize: 11, fontWeight: 700,
              }}>
                {isSelected ? '\u2713' : ''}
              </div>
              {g.cover && (
                <img src={g.cover} alt="" style={{ width: 36, height: 36, borderRadius: 4, flexShrink: 0 }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: isSelected ? 'var(--gold)' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {g.name}
                </div>
                <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)' }}>
                  {g.tracks.length} {g.tracks.length === 1 ? 'track' : 'tracks'} this week
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty states */}
      {!loadingShowcase && releases.length === 0 && (
        <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
          No weekly release data loaded yet. Try the Nashville source first.
        </div>
      )}
      {!loadingShowcase && releases.length > 0 && artistGroups.length === 0 && activeShowcase && (
        <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
          No releases this week from {showcases.find(s => s.id === activeShowcase)?.name} artists.
        </div>
      )}

      {/* Scan button */}
      {selectedNames.size > 0 && (
        <div style={{ marginTop: 16 }}>
          <button
            className="btn btn-gold"
            onClick={() => onScanArtists([...selectedNames])}
            disabled={scanning}
            style={{ width: '100%', fontSize: 'var(--fs-md)', padding: '10px 24px', justifyContent: 'center' }}
          >
            {scanning ? 'Scanning...' : `Scan ${selectedNames.size} ${selectedNames.size === 1 ? 'Artist' : 'Artists'} for New Releases`}
          </button>
        </div>
      )}
    </div>
  );
}
