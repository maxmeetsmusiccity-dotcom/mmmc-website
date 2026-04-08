import { useMemo } from 'react';
import type { ReleaseCluster } from '../lib/spotify';
import type { SelectionSlot } from '../lib/selection';

interface Props {
  releases: ReleaseCluster[];
  selections: SelectionSlot[];
  onSelectRelease: (cluster: ReleaseCluster, trackId?: string) => void;
}

/**
 * Suggests tracks the user hasn't selected yet, prioritizing:
 * 1. Artists not yet represented in selections
 * 2. Singles (easier to add than album tracks)
 * 3. Diversity of release dates
 */
export default function TrackSuggestions({ releases, selections, onSelectRelease }: Props) {
  const suggestions = useMemo(() => {
    if (selections.length < 3) return [];

    const selectedArtists = new Set(
      selections.map(s => (s.track.artist_names || '').split(/,/)[0].trim().toLowerCase())
    );
    const selectedTrackIds = new Set(selections.map(s => s.track.track_id));

    // Score each unselected release
    const scored = releases
      .filter(r => !r.tracks.every(t => selectedTrackIds.has(t.track_id)))
      .map(r => {
        const primaryArtist = r.artist_names.split(/,/)[0].trim().toLowerCase();
        let score = 0;
        // Boost artists not yet selected (diversity)
        if (!selectedArtists.has(primaryArtist)) score += 10;
        // Slight boost for singles (easy add)
        if (r.isSingle) score += 2;
        // Slight boost for recent releases
        if (r.tracks[0]?.release_date) score += 1;
        return { release: r, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    return scored.map(s => s.release);
  }, [releases, selections]);

  if (suggestions.length === 0) return null;

  return (
    <div style={{
      marginTop: 16, padding: '12px 16px', borderRadius: 10,
      background: 'var(--midnight)', border: '1px solid var(--midnight-border)',
    }}>
      <p style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
        Suggested — artists not in your carousel yet
      </p>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
        {suggestions.map(r => (
          <div
            key={r.album_spotify_id}
            onClick={() => onSelectRelease(r)}
            style={{
              flexShrink: 0, width: 90, cursor: 'pointer', textAlign: 'center',
              borderRadius: 8, padding: 6,
              border: '1px solid var(--midnight-border)',
              background: 'var(--midnight-raised)',
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--gold)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--midnight-border)')}
          >
            <img
              src={r.tracks[0]?.cover_art_300 || r.tracks[0]?.cover_art_640}
              alt=""
              style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 4, marginBottom: 4 }}
            />
            <div style={{ fontSize: 'var(--fs-3xs)', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {r.album_name}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {r.artist_names}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
