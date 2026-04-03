import { useState, memo } from 'react';
import type { ReleaseCluster, TrackItem } from '../lib/spotify';
import type { SelectionSlot } from '../lib/selection';
import { formatDuration } from '../lib/utils';

interface Props {
  cluster: ReleaseCluster;
  selectionSlot: SelectionSlot | null; // null = not selected
  hasSelections: boolean;
  onSelectRelease: (cluster: ReleaseCluster, trackId?: string) => void;
  onDeselect: (albumId: string) => void;
}

export default memo(function ClusterCard({ cluster, selectionSlot, hasSelections, onSelectRelease, onDeselect }: Props) {
  const [expanded, setExpanded] = useState(false);
  const isSelected = selectionSlot !== null;
  const selectedTrackId = selectionSlot?.track.track_id;

  const badgeClass = cluster.isSingle ? 'badge-single'
    : cluster.album_type === 'album' ? 'badge-album' : 'badge-ep';
  const badgeLabel = cluster.isSingle ? 'Single'
    : cluster.album_type === 'album' ? 'Album' : 'EP';

  const handleCardClick = () => {
    if (isSelected) {
      onDeselect(cluster.album_spotify_id);
    } else {
      onSelectRelease(cluster);
    }
  };

  const handleTrackClick = (e: React.MouseEvent, track: TrackItem) => {
    e.stopPropagation();
    if (isSelected && selectedTrackId === track.track_id) {
      onDeselect(cluster.album_spotify_id);
    } else {
      onSelectRelease(cluster, track.track_id);
    }
  };

  return (
    <div
      className={`card selectable ${isSelected ? 'selected' : ''} ${hasSelections && !isSelected ? 'has-selections' : ''}`}
      style={{ padding: 0, overflow: 'hidden', position: 'relative' }}
    >
      {/* Selection number badge */}
      {isSelected && selectionSlot && (
        <div style={{
          position: 'absolute', top: 8, right: 8, zIndex: 2,
          width: 28, height: 28, borderRadius: '50%',
          background: selectionSlot.isCoverFeature ? 'var(--mmmc-red)' : 'var(--gold)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
          fontFamily: 'var(--font-mono)', fontSize: '0.7rem', fontWeight: 700,
          color: 'var(--midnight)',
        }}>
          {selectionSlot.selectionNumber}
        </div>
      )}

      {/* Cover art — clickable for selection */}
      <div
        onClick={handleCardClick}
        style={{ position: 'relative', paddingBottom: '100%', background: 'var(--midnight)', cursor: 'pointer' }}
      >
        <img
          src={cluster.cover_art_300 || ''}
          alt={`${cluster.album_name} cover`}
          loading="lazy"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          onError={(e) => {
            const el = e.currentTarget;
            el.style.display = 'none';
            const parent = el.parentElement;
            if (parent && !parent.querySelector('.art-fallback')) {
              const fb = document.createElement('div');
              fb.className = 'art-fallback';
              fb.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:var(--midnight-raised);color:var(--text-muted);font-size:1.5rem;font-weight:700;';
              fb.textContent = cluster.artist_names.split(',')[0].trim().split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
              parent.appendChild(fb);
            }
          }}
        />
      </div>

      {/* Info */}
      <div style={{ padding: '12px' }}>
        <p style={{
          fontSize: '0.85rem', fontWeight: 600, lineHeight: 1.3, marginBottom: 4,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {isSelected ? selectionSlot!.track.track_name : cluster.album_name}
        </p>
        <p style={{
          fontSize: '0.75rem', color: 'var(--text-secondary)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 8,
        }}>
          {cluster.artist_names}
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span className={`badge ${badgeClass}`}>{badgeLabel}</span>
          {!cluster.isSingle && (
            <span className="badge" style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--text-muted)' }}>
              {cluster.total_tracks} tracks
            </span>
          )}
          {isSelected && (
            <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
              Slide {selectionSlot!.slideGroup}, Pos {selectionSlot!.positionInSlide}
            </span>
          )}
        </div>

        {/* Expand toggle for multi-track releases */}
        {!cluster.isSingle && (
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            style={{
              marginTop: 8, fontSize: '0.7rem', color: 'var(--gold)',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            {expanded ? '▾ Hide tracks' : '▸ Pick specific track'}
          </button>
        )}

        {/* Expanded track list */}
        {expanded && !cluster.isSingle && (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {cluster.tracks.map(track => {
              const isThisTrackSelected = isSelected && selectedTrackId === track.track_id;
              return (
                <div
                  key={track.track_id}
                  onClick={(e) => handleTrackClick(e, track)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 8px', borderRadius: 6, cursor: 'pointer',
                    background: isThisTrackSelected ? 'rgba(212,168,67,0.15)' : 'transparent',
                    border: isThisTrackSelected ? '1px solid var(--gold-dark)' : '1px solid transparent',
                    transition: 'all 0.15s',
                  }}
                >
                  <span className="mono" style={{ fontSize: '0.65rem', color: 'var(--text-muted)', width: 16, textAlign: 'right' }}>
                    {track.track_number}
                  </span>
                  <span style={{
                    fontSize: '0.75rem', flex: 1,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    color: isThisTrackSelected ? 'var(--gold)' : 'var(--text-primary)',
                  }}>
                    {track.track_name}
                  </span>
                  {track.explicit && <span className="badge badge-explicit">E</span>}
                  <span className="mono" style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>
                    {formatDuration(track.duration_ms)}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Spotify link */}
        <div style={{ marginTop: 8 }}>
          <a
            href={cluster.album_spotify_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{
              fontSize: '0.65rem', color: 'var(--spotify-green)',
              padding: '2px 8px', border: '1px solid rgba(29,185,84,0.3)', borderRadius: 6,
            }}
          >
            Open in Spotify
          </a>
        </div>
      </div>
    </div>
  );
});
