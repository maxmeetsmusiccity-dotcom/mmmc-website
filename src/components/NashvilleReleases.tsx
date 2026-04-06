import { useState, useEffect, useRef } from 'react';
import type { TrackItem } from '../lib/spotify';
import { NASHVILLE_SEED_ARTISTS, releasesToTrackItems, type NashvilleRelease } from '../lib/sources/nashville';

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
  const scanning = useRef(false);

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

  // Don't auto-scan — let user click the button
  useEffect(() => { /* intentionally empty — user triggers scan */ }, []);

  const filtered = chartFilter ? releases.filter(r => r.is_charting) : releases;
  const chartingCount = releases.filter(r => r.is_charting).length;

  const handleImportAll = () => {
    const tracks = releasesToTrackItems(filtered);
    onImport(tracks);
  };

  if (!loading && releases.length === 0 && !error) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-lg)', marginBottom: 12 }}>
          Scan {NASHVILLE_SEED_ARTISTS.length} Nashville artists for this week's new releases.
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
          {progress.current}/{progress.total} artists scanned &middot; {progress.found} releases found
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <span style={{ fontSize: 'var(--fs-lg)', fontWeight: 600 }}>
            Nashville Releases
          </span>
          {week && <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', marginLeft: 8 }}>Week of {week}</span>}
        </div>
        <button
          onClick={handleImportAll}
          disabled={filtered.length === 0}
          style={{
            padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: 'var(--gold)', color: '#000', fontWeight: 600, fontSize: 'var(--fs-sm)',
            opacity: filtered.length === 0 ? 0.4 : 1,
          }}
        >
          Import {filtered.length} releases
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button
          onClick={() => setChartFilter(false)}
          style={{
            padding: '4px 12px', borderRadius: 16, border: '1px solid',
            borderColor: !chartFilter ? 'var(--gold)' : 'var(--midnight-border)',
            background: !chartFilter ? 'rgba(245,196,83,0.1)' : 'transparent',
            color: !chartFilter ? 'var(--gold)' : 'var(--text-muted)',
            fontSize: 'var(--fs-xs)', cursor: 'pointer',
          }}
        >
          All ({releases.length})
        </button>
        <button
          onClick={() => setChartFilter(true)}
          style={{
            padding: '4px 12px', borderRadius: 16, border: '1px solid',
            borderColor: chartFilter ? '#3EE6C3' : 'var(--midnight-border)',
            background: chartFilter ? 'rgba(62,230,195,0.08)' : 'transparent',
            color: chartFilter ? '#3EE6C3' : 'var(--text-muted)',
            fontSize: 'var(--fs-xs)', cursor: 'pointer',
          }}
        >
          Charting ({chartingCount})
        </button>
      </div>

      {/* Release list */}
      <div style={{ maxHeight: 400, overflowY: 'auto' }}>
        {filtered.slice(0, 100).map((r, i) => (
          <div key={r.spotify_track_id || i} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
            borderBottom: '1px solid var(--midnight-border)',
          }}>
            {r.cover_art_300 && (
              <img
                src={r.cover_art_300}
                alt=""
                style={{ width: 40, height: 40, borderRadius: 4, flexShrink: 0 }}
                onError={e => { (e.target as HTMLImageElement).src = '/placeholder-album.svg'; (e.target as HTMLImageElement).onerror = null; }}
              />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 500, fontSize: 'var(--fs-sm)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.track_name}
              </div>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.artist_name}
                {r.release_type !== 'single' && <span> · {r.album_name}</span>}
              </div>
            </div>
            {r.is_charting && (
              <span style={{
                padding: '2px 8px', borderRadius: 10, fontSize: 'var(--fs-2xs)', fontWeight: 700,
                background: 'rgba(245,196,83,0.1)', color: 'var(--gold)', border: '1px solid rgba(245,196,83,0.2)',
                flexShrink: 0,
              }}>
                #{r.current_position}
              </span>
            )}
            <span style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)', flexShrink: 0, width: 55, textAlign: 'right' }}>
              {r.release_date?.slice(5) || ''}
            </span>
          </div>
        ))}
      </div>

      {filtered.length > 100 && (
        <div style={{ textAlign: 'center', padding: 8, fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
          Showing 100 of {filtered.length}. Import to see all.
        </div>
      )}

      {generatedAt && (
        <div style={{ marginTop: 8, fontSize: 'var(--fs-3xs)', color: 'var(--text-muted)' }}>
          Data generated: {new Date(generatedAt).toLocaleDateString()}
        </div>
      )}
    </div>
  );
}
