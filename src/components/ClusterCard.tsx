import { useState, memo } from 'react';
import type { ReleaseCluster, TrackItem } from '../lib/spotify';
import type { SelectionSlot } from '../lib/selection';
import { formatDuration } from '../lib/utils';

interface Props {
  cluster: ReleaseCluster;
  selectionSlot: SelectionSlot | null;
  /** All selections from this album (supports multi-track selection) */
  selectedSlots?: SelectionSlot[];
  hasSelections: boolean;
  onSelectRelease: (cluster: ReleaseCluster, trackId?: string) => void;
  onDeselect: (albumId: string, trackId?: string) => void;
  onSetCoverFeature: (trackId: string) => void;
  featureCount?: number;
}

export default memo(function ClusterCard({ cluster, selectionSlot, selectedSlots, hasSelections, onSelectRelease, onDeselect, onSetCoverFeature, featureCount }: Props) {
  const [expanded, setExpanded] = useState(false);
  const allSlots = selectedSlots || (selectionSlot ? [selectionSlot] : []);
  const isSelected = allSlots.length > 0;
  const selectedTrackIds = new Set(allSlots.map(s => s.track.track_id));
  // Show first selected slot's info in the badge
  const primarySlot = allSlots[0] || null;

  const badgeClass = cluster.isSingle ? 'badge-single'
    : cluster.album_type === 'album' ? 'badge-album' : 'badge-ep';
  const badgeLabel = cluster.isSingle ? 'Single'
    : cluster.album_type === 'album' ? 'Album' : 'EP';

  const handleCardClick = () => {
    if (isSelected && cluster.isSingle) {
      onDeselect(cluster.album_spotify_id);
    } else {
      onSelectRelease(cluster);
    }
  };

  const handleTrackClick = (e: React.MouseEvent, track: TrackItem) => {
    e.stopPropagation();
    if (selectedTrackIds.has(track.track_id)) {
      onDeselect(cluster.album_spotify_id, track.track_id);
    } else {
      onSelectRelease(cluster, track.track_id);
    }
  };

  return (
    <div
      className={`card selectable ${isSelected ? 'selected' : ''} ${hasSelections && !isSelected ? 'has-selections' : ''}`}
      style={{ padding: 0, overflow: 'hidden', position: 'relative' }}
    >
      {/* Selection number badge(s) */}
      {isSelected && primarySlot && (
        <div style={{
          position: 'absolute', top: 8, right: 8, zIndex: 2,
          display: 'flex', gap: 3,
        }}>
          {allSlots.map(s => (
            <div key={s.track.track_id} style={{
              width: 24, height: 24, borderRadius: '50%',
              background: s.isCoverFeature ? 'var(--mmmc-red)' : 'var(--gold)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
              fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-2xs)', fontWeight: 700,
              color: 'var(--midnight)',
            }}>
              {s.selectionNumber}
            </div>
          ))}
        </div>
      )}
      {/* Cover feature star */}
      {isSelected && primarySlot && (
        <button
          onClick={(e) => { e.stopPropagation(); onSetCoverFeature(primarySlot.track.track_id); }}
          style={{
            position: 'absolute', top: 8, left: 8, zIndex: 10,
            background: primarySlot.isCoverFeature ? 'var(--gold)' : 'rgba(0,0,0,0.6)',
            border: `2px solid ${primarySlot.isCoverFeature ? 'var(--gold)' : 'rgba(255,255,255,0.3)'}`,
            borderRadius: '50%', width: 32, height: 32,
            color: primarySlot.isCoverFeature ? 'var(--midnight)' : 'white',
            fontSize: 16, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          title={primarySlot.isCoverFeature ? 'Cover feature — click to unset' : 'Set as cover feature'}
        >★</button>
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
          fontSize: 'var(--fs-md)', fontWeight: 600, lineHeight: 1.3, marginBottom: 4,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {isSelected && allSlots.length === 1 ? primarySlot!.track.track_name : cluster.album_name}
        </p>
        <p style={{
          fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 8,
        }}>
          {cluster.artist_names}
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span className={`badge ${badgeClass}`}>{badgeLabel}</span>
          {featureCount && featureCount > 0 ? (
            <span className="badge" style={{ background: 'rgba(212,168,67,0.15)', color: 'var(--gold)', fontSize: 'var(--fs-2xs)' }}>
              Featured {featureCount}x
            </span>
          ) : null}
          {!cluster.isSingle && (
            <span className="badge" style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--text-muted)' }}>
              {cluster.total_tracks} tracks
            </span>
          )}
          {allSlots.length > 1 && (
            <span className="badge" style={{ background: 'rgba(212,168,67,0.2)', color: 'var(--gold)', fontSize: 'var(--fs-2xs)' }}>
              {allSlots.length} picked
            </span>
          )}
        </div>

        {/* Expand toggle for multi-track releases — auto-expand when selected */}
        {!cluster.isSingle && (
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            style={{
              marginTop: 8, fontSize: 'var(--fs-xs)', color: 'var(--gold)',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            {expanded ? '▾ Hide tracks' : `▸ Pick tracks (${cluster.total_tracks})`}
          </button>
        )}

        {/* Expanded track list */}
        {expanded && !cluster.isSingle && (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {cluster.tracks.map(track => {
              const isThisTrackSelected = selectedTrackIds.has(track.track_id);
              const trackSlot = allSlots.find(s => s.track.track_id === track.track_id);
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
                  {isThisTrackSelected && trackSlot && (
                    <span style={{
                      width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                      background: 'var(--gold)', color: 'var(--midnight)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-3xs)', fontWeight: 700,
                    }}>
                      {trackSlot.selectionNumber}
                    </span>
                  )}
                  <span className="mono" style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)', width: 16, textAlign: 'right' }}>
                    {track.track_number}
                  </span>
                  <span style={{
                    fontSize: 'var(--fs-sm)', flex: 1,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    color: isThisTrackSelected ? 'var(--gold)' : 'var(--text-primary)',
                    fontWeight: isThisTrackSelected ? 600 : 400,
                  }}>
                    {track.track_name}
                  </span>
                  {track.explicit && <span className="badge badge-explicit">E</span>}
                  <span className="mono" style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)' }}>
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
              fontSize: 'var(--fs-2xs)', color: 'var(--spotify-green)',
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
