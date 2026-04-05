import { useState, useEffect } from 'react';
import type { TrackItem } from '../lib/spotify';
import { fetchNashvilleReleases, releasesToTrackItems, type NashvilleRelease } from '../lib/sources/nashville';

interface Props {
  onImport: (tracks: TrackItem[]) => void;
}

export default function NashvilleReleases({ onImport }: Props) {
  const [loading, setLoading] = useState(true);
  const [releases, setReleases] = useState<NashvilleRelease[]>([]);
  const [week, setWeek] = useState('');
  const [error, setError] = useState('');
  const [generatedAt, setGeneratedAt] = useState('');
  const [chartFilter, setChartFilter] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchNashvilleReleases()
      .then(data => {
        setReleases(data.releases || []);
        setWeek(data.week || '');
        setGeneratedAt(data.generated_at || '');
        if (data.message && (!data.releases || data.releases.length === 0)) {
          setError(data.message);
        }
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = chartFilter ? releases.filter(r => r.is_charting) : releases;
  const chartingCount = releases.filter(r => r.is_charting).length;

  const handleImportAll = () => {
    const tracks = releasesToTrackItems(filtered);
    onImport(tracks);
  };

  if (loading) {
    return <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>Loading Nashville releases...</div>;
  }

  if (error && releases.length === 0) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)', marginBottom: 8 }}>{error}</p>
        <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
          Release data populates after the weekly cascade runs (typically Wednesday 3 AM CT).
        </p>
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
