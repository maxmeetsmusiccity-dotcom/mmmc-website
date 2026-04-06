import { useState, useEffect, useRef } from 'react';
import type { TrackItem } from '../lib/spotify';
import { NASHVILLE_SEED_ARTISTS, releasesToTrackItems, type NashvilleRelease } from '../lib/sources/nashville';
import { supabase } from '../lib/supabase';

interface ShowcaseCategory {
  id: string;
  name: string;
  emoji: string;
  type: string;
  count: number;
}

interface Props {
  onImport: (tracks: TrackItem[]) => void;
}

export default function NashvilleReleases({ onImport }: Props) {
  const [loading, setLoading] = useState(false);
  const [releases, setReleases] = useState<NashvilleRelease[]>([]);
  const [week, setWeek] = useState('');
  const [error, setError] = useState('');
  const [generatedAt, setGeneratedAt] = useState('');
  const [chartFilter, setChartFilter] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, found: 0 });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const scanning = useRef(false);

  // Showcase filter state
  const [showcases, setShowcases] = useState<ShowcaseCategory[]>([]);
  const [activeShowcase, setActiveShowcase] = useState<string | null>(null);
  const [showcaseArtists, setShowcaseArtists] = useState<Set<string>>(new Set());
  const [loadingShowcase, setLoadingShowcase] = useState(false);

  // Load showcase categories on mount
  useEffect(() => {
    fetch('/api/browse-artists')
      .then(r => r.json())
      .then(d => {
        const cats = (d.categories || []).filter((c: ShowcaseCategory) => c.type === 'showcase');
        setShowcases(cats);
      })
      .catch(() => {}); // non-critical
  }, []);

  // When a showcase is selected, fetch its artist list
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

  const runScan = async () => {
    if (scanning.current) return;
    scanning.current = true;
    setLoading(true);
    setError('');
    setReleases([]);
    const totalArtists = NASHVILLE_SEED_ARTISTS.length;
    const batchSize = 25;
    const allReleases: NashvilleRelease[] = [];
    setProgress({ current: 0, total: totalArtists, found: 0 });

    for (let i = 0; i < totalArtists; i += batchSize) {
      const batch = NASHVILLE_SEED_ARTISTS.slice(i, i + batchSize);
      setProgress({ current: Math.min(i + batchSize, totalArtists), total: totalArtists, found: allReleases.length });
      try {
        const resp = await fetch('/api/scan-artists', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ artistNames: batch }),
        });
        if (resp.ok) {
          const data = await resp.json();
          for (const t of (data.tracks || [])) {
            allReleases.push({
              pg_id: t.artist_id || '',
              artist_name: t.artist_names,
              track_name: t.track_name,
              album_name: t.album_name,
              release_type: t.album_type || 'single',
              release_date: t.release_date,
              spotify_track_id: t.track_id,
              spotify_track_uri: t.track_uri,
              spotify_album_id: t.album_spotify_id,
              cover_art_url: t.cover_art_640,
              cover_art_300: t.cover_art_300,
              track_number: t.track_number || 1,
              duration_ms: t.duration_ms || 0,
              explicit: t.explicit || false,
              total_tracks: t.total_tracks || 1,
              is_charting: false,
            });
          }
        }
      } catch { /* batch failed, continue */ }
    }

    setReleases(allReleases);
    setWeek(new Date().toISOString().split('T')[0]);
    setGeneratedAt(new Date().toISOString());
    setProgress({ current: totalArtists, total: totalArtists, found: allReleases.length });
    if (allReleases.length === 0) setError('No new releases found this week from Nashville artists.');
    setLoading(false);
    scanning.current = false;
  };

  // On mount: check Supabase cache for this week's releases
  useEffect(() => {
    (async () => {
      try {
        if (!supabase) return;
        const { data, error: err } = await supabase
          .from('weekly_nashville_releases')
          .select('*')
          .order('artist_name');
        if (!err && data && data.length > 0) {
          const mapped: NashvilleRelease[] = data.map(r => ({
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
          }));
          setReleases(mapped);
          setWeek(data[0]?.scan_week || '');
          setGeneratedAt(data[0]?.scanned_at || '');
        }
      } catch { /* no cache, user can trigger scan */ }
    })();
  }, []);

  // Apply filters: chart + showcase
  const filtered = (() => {
    let list = chartFilter ? releases.filter(r => r.is_charting) : releases;
    if (activeShowcase && showcaseArtists.size > 0) {
      list = list.filter(r => {
        // Match against primary artist name (before comma/feat)
        const primary = (r.artist_name || '').split(/,|feat\.|ft\./i)[0].trim().toLowerCase();
        return showcaseArtists.has(primary);
      });
    }
    return list;
  })();

  const chartingCount = releases.filter(r => r.is_charting).length;

  // Group by album for expandable view
  const grouped = (() => {
    const map = new Map<string, NashvilleRelease[]>();
    for (const r of filtered) {
      const key = r.spotify_album_id || `${r.artist_name}_${r.album_name}`;
      const arr = map.get(key) || [];
      arr.push(r);
      map.set(key, arr);
    }
    return [...map.entries()].map(([key, tracks]) => ({
      key,
      album: tracks[0].album_name,
      artist: tracks[0].artist_name,
      type: tracks[0].release_type,
      cover: tracks[0].cover_art_300,
      date: tracks[0].release_date,
      isCharting: tracks.some(t => t.is_charting),
      chartPos: tracks.find(t => t.is_charting)?.current_position,
      tracks,
    }));
  })();

  const toggleSelect = (trackId: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(trackId)) next.delete(trackId); else next.add(trackId);
      return next;
    });
  };

  const selectAll = () => {
    setSelected(new Set(filtered.map(r => r.spotify_track_id)));
  };

  const handleImportSelected = () => {
    const toImport = selected.size > 0
      ? filtered.filter(r => selected.has(r.spotify_track_id))
      : filtered;
    onImport(releasesToTrackItems(toImport));
  };

  // Showcase filter pills (rendered in multiple places)
  const showcasePills = showcases.length > 0 ? (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
      <button
        onClick={() => setActiveShowcase(null)}
        className={`filter-pill ${!activeShowcase ? 'active' : ''}`}
        style={{ fontSize: 'var(--fs-xs)', padding: '4px 10px' }}
      >
        All Nashville
      </button>
      {showcases.map(s => (
        <button
          key={s.id}
          onClick={() => setActiveShowcase(activeShowcase === s.id ? null : s.id)}
          className={`filter-pill ${activeShowcase === s.id ? 'active' : ''}`}
          style={{ fontSize: 'var(--fs-xs)', padding: '4px 10px' }}
          title={`${s.count} ${s.count === 1 ? 'artist' : 'artists'}`}
        >
          {s.emoji} {s.name}
        </button>
      ))}
    </div>
  ) : null;

  if (!loading && releases.length === 0 && !error) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        {showcasePills}
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-lg)', marginBottom: 12 }}>
          Scan {NASHVILLE_SEED_ARTISTS.length} Nashville {NASHVILLE_SEED_ARTISTS.length === 1 ? 'artist' : 'artists'} for this week's new releases.
        </p>
        <button
          className="btn btn-gold"
          onClick={runScan}
          style={{ fontSize: 'var(--fs-lg)', padding: '14px 32px' }}
        >
          Scan Nashville Releases
        </button>
        <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginTop: 12 }}>
          Searches the Spotify catalog for releases from the past 7 days. Takes about 30 seconds.
        </p>
      </div>
    );
  }

  if (loading) {
    const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <p style={{ color: 'var(--gold)', fontSize: 'var(--fs-lg)', fontWeight: 600, marginBottom: 12 }}>
          Scanning Nashville Artists...
        </p>
        <div className="progress-bar" style={{ marginBottom: 12, maxWidth: 400, margin: '0 auto 12px' }}>
          <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <p className="mono" style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-md)' }}>
          {progress.current}/{progress.total} {progress.total === 1 ? 'artist' : 'artists'} scanned &middot; {progress.found} {progress.found === 1 ? 'release' : 'releases'} found
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-xs)', marginTop: 8 }}>
          {pct < 30 ? 'Getting started...' : pct < 70 ? 'Making progress...' : 'Almost done...'}
        </p>
      </div>
    );
  }

  if (error && releases.length === 0) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)', marginBottom: 8 }}>{error}</p>
        <button className="btn btn-sm" onClick={runScan} style={{ marginTop: 8 }}>Try Again</button>
      </div>
    );
  }

  return (
    <div style={{ textAlign: 'left' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <span style={{ fontSize: 'var(--fs-lg)', fontWeight: 600 }}>
            Nashville Releases
          </span>
          {week && <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', marginLeft: 8 }}>Week of {week}</span>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={selectAll} style={{ fontSize: 'var(--fs-sm)', color: 'var(--steel)', cursor: 'pointer', background: 'none', border: 'none', fontWeight: 600 }}>
            Select All
          </button>
          {selected.size > 0 && (
            <button onClick={() => setSelected(new Set())} style={{ fontSize: 'var(--fs-sm)', color: 'var(--mmmc-red)', cursor: 'pointer', background: 'none', border: 'none', fontWeight: 600 }}>
              Clear ({selected.size})
            </button>
          )}
          <button
            onClick={handleImportSelected}
            disabled={filtered.length === 0}
            style={{
              padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: 'var(--gold)', color: '#000', fontWeight: 600, fontSize: 'var(--fs-sm)',
              opacity: filtered.length === 0 ? 0.4 : 1,
            }}
          >
            Import {selected.size > 0 ? selected.size : filtered.length} {(selected.size > 0 ? selected.size : filtered.length) === 1 ? 'release' : 'releases'}
          </button>
        </div>
      </div>

      {/* Showcase filter pills */}
      {showcasePills}
      {loadingShowcase && (
        <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginBottom: 8 }}>Loading showcase artists...</p>
      )}
      {activeShowcase && !loadingShowcase && showcaseArtists.size > 0 && (
        <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginBottom: 8 }}>
          Showing releases from {showcaseArtists.size} {showcases.find(s => s.id === activeShowcase)?.name} {showcaseArtists.size === 1 ? 'artist' : 'artists'}
          {filtered.length > 0 && <> &middot; {filtered.length} {filtered.length === 1 ? 'release' : 'releases'} this week</>}
        </p>
      )}

      {/* Chart / All filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button
          onClick={() => setChartFilter(false)}
          className={`filter-pill ${!chartFilter ? 'active' : ''}`}
          style={{ fontSize: 'var(--fs-xs)' }}
        >
          All ({releases.length})
        </button>
        <button
          onClick={() => setChartFilter(true)}
          className={`filter-pill ${chartFilter ? 'active' : ''}`}
          style={{ fontSize: 'var(--fs-xs)' }}
        >
          Charting ({chartingCount})
        </button>
      </div>

      {/* Empty state for showcase filter */}
      {activeShowcase && filtered.length === 0 && !loadingShowcase && (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
          No releases this week from {showcases.find(s => s.id === activeShowcase)?.name} artists.
        </div>
      )}

      {/* Release list — grouped by album, selectable, expandable */}
      <div style={{ maxHeight: 600, overflowY: 'auto' }}>
        {grouped.map(g => {
          const isSingle = g.tracks.length === 1;
          const isExpanded = expanded.has(g.key);
          const titleTrack = g.tracks[0];
          const isSelected = g.tracks.some(t => selected.has(t.spotify_track_id));
          const allSelected = g.tracks.every(t => selected.has(t.spotify_track_id));

          return (
            <div key={g.key} style={{
              borderBottom: '1px solid var(--midnight-border)',
              background: isSelected ? 'rgba(212,168,67,0.06)' : 'transparent',
            }}>
              {/* Album/Single row */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0',
                cursor: 'pointer',
              }}
                onClick={() => {
                  if (isSingle) {
                    toggleSelect(titleTrack.spotify_track_id);
                  } else {
                    // Toggle all tracks in this release
                    const allIn = g.tracks.every(t => selected.has(t.spotify_track_id));
                    setSelected(prev => {
                      const next = new Set(prev);
                      for (const t of g.tracks) {
                        if (allIn) next.delete(t.spotify_track_id); else next.add(t.spotify_track_id);
                      }
                      return next;
                    });
                  }
                }}
              >
                {/* Checkbox */}
                <div style={{
                  width: 20, height: 20, borderRadius: 4, flexShrink: 0,
                  border: allSelected ? '2px solid var(--gold)' : '2px solid var(--midnight-border)',
                  background: allSelected ? 'var(--gold)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, color: 'var(--midnight)',
                }}>
                  {allSelected && '\u2713'}
                </div>

                {g.cover && (
                  <img src={g.cover} alt="" style={{ width: 44, height: 44, borderRadius: 4, flexShrink: 0 }}
                    onError={e => { (e.target as HTMLImageElement).src = '/placeholder-album.svg'; (e.target as HTMLImageElement).onerror = null; }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 'var(--fs-sm)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {isSingle ? titleTrack.track_name : g.album}
                  </div>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {g.artist}
                    <span style={{ marginLeft: 6, fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      {g.type}
                    </span>
                    {!isSingle && <span> &middot; {g.tracks.length} {g.tracks.length === 1 ? 'track' : 'tracks'}</span>}
                  </div>
                </div>
                {g.isCharting && (
                  <span style={{
                    padding: '2px 8px', borderRadius: 10, fontSize: 'var(--fs-2xs)', fontWeight: 700,
                    background: 'rgba(245,196,83,0.1)', color: 'var(--gold)', border: '1px solid rgba(245,196,83,0.2)',
                    flexShrink: 0,
                  }}>
                    #{g.chartPos}
                  </span>
                )}
                {!isSingle && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setExpanded(prev => { const n = new Set(prev); if (n.has(g.key)) n.delete(g.key); else n.add(g.key); return n; }); }}
                    style={{ color: 'var(--gold)', fontSize: 'var(--fs-xs)', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, padding: '4px 8px' }}
                  >
                    {isExpanded ? '\u25BE' : '\u25B8'} tracks
                  </button>
                )}
                <span style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)', flexShrink: 0, width: 50, textAlign: 'right' }}>
                  {g.date?.slice(5) || ''}
                </span>
              </div>

              {/* Expanded tracks for albums/EPs */}
              {!isSingle && isExpanded && (
                <div style={{ paddingLeft: 36, paddingBottom: 8 }}>
                  {g.tracks.map(t => (
                    <div key={t.spotify_track_id} style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0',
                      cursor: 'pointer', fontSize: 'var(--fs-xs)',
                    }} onClick={(e) => { e.stopPropagation(); toggleSelect(t.spotify_track_id); }}>
                      <div style={{
                        width: 16, height: 16, borderRadius: 3, flexShrink: 0,
                        border: selected.has(t.spotify_track_id) ? '2px solid var(--gold)' : '2px solid var(--midnight-border)',
                        background: selected.has(t.spotify_track_id) ? 'var(--gold)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, color: 'var(--midnight)',
                      }}>
                        {selected.has(t.spotify_track_id) && '\u2713'}
                      </div>
                      <span style={{ color: 'var(--text-muted)', width: 20, textAlign: 'right' }}>{t.track_number}</span>
                      <span style={{ color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.track_name}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {generatedAt && (
        <div style={{ marginTop: 8, fontSize: 'var(--fs-3xs)', color: 'var(--text-muted)' }}>
          Data generated: {new Date(generatedAt).toLocaleDateString()}
        </div>
      )}
    </div>
  );
}
