import type { TrackItem } from '../lib/spotify';
import { formatDuration } from '../lib/utils';

interface Props {
  track: TrackItem;
  isSelected: boolean;
  hasSelections: boolean;
  onToggle: () => void;
}

export default function ReleaseCard({ track, isSelected, hasSelections, onToggle }: Props) {
  const badgeClass =
    track.album_type === 'single' && track.total_tracks === 1
      ? 'badge-single'
      : track.album_type === 'album'
        ? 'badge-album'
        : 'badge-ep';

  const badgeLabel =
    track.album_type === 'single' && track.total_tracks === 1
      ? 'Single'
      : track.album_type === 'album'
        ? 'Album'
        : 'EP';

  return (
    <div
      className={`card selectable ${isSelected ? 'selected' : ''} ${hasSelections && !isSelected ? 'has-selections' : ''}`}
      onClick={onToggle}
      style={{ padding: 0, overflow: 'hidden', position: 'relative' }}
    >
      {/* Selection checkmark */}
      {isSelected && (
        <div style={{
          position: 'absolute',
          top: 8,
          right: 8,
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: 'var(--gold)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2,
          boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--midnight)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
      )}

      {/* Cover art */}
      <div style={{ position: 'relative', paddingBottom: '100%', background: 'var(--midnight)' }}>
        {track.cover_art_300 && (
          <img
            src={track.cover_art_300}
            alt={`${track.album_name} cover`}
            loading="lazy"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        )}
      </div>

      {/* Info */}
      <div style={{ padding: '12px' }}>
        <p style={{
          fontSize: '0.85rem',
          fontWeight: 600,
          lineHeight: 1.3,
          marginBottom: 4,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {track.track_name}
        </p>
        <p style={{
          fontSize: '0.75rem',
          color: 'var(--text-secondary)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          marginBottom: 8,
        }}>
          {track.artist_names}
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span className={`badge ${badgeClass}`}>{badgeLabel}</span>
          {track.explicit && <span className="badge badge-explicit">E</span>}
          <span className="mono" style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
            {formatDuration(track.duration_ms)}
          </span>
        </div>

        {track.total_tracks > 1 && (
          <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 6 }}>
            from <em>{track.album_name}</em> ({track.track_number}/{track.total_tracks})
          </p>
        )}

        <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
          <a
            href={track.track_spotify_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{
              fontSize: '0.65rem',
              color: 'var(--spotify-green)',
              padding: '2px 8px',
              border: '1px solid rgba(29,185,84,0.3)',
              borderRadius: 6,
            }}
          >
            Open in Spotify
          </a>
        </div>
      </div>
    </div>
  );
}
