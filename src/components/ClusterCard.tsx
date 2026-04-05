import { useState, memo, useEffect } from 'react';
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
  const [showModal, setShowModal] = useState(false);
  const allSlots = selectedSlots || (selectionSlot ? [selectionSlot] : []);
  const isSelected = allSlots.length > 0;
  const selectedTrackIds = new Set(allSlots.map(s => s.track.track_id));
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

  // Close modal on Escape
  useEffect(() => {
    if (!showModal) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowModal(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showModal]);

  return (
    <>
      <div
        className={`card selectable ${isSelected ? 'selected' : ''} ${hasSelections && !isSelected ? 'has-selections' : ''}`}
        style={{ padding: 0, overflow: 'hidden', position: 'relative' }}
      >
        {/* Selection badges */}
        {isSelected && primarySlot && (
          <div style={{
            position: 'absolute', top: 6, right: 6, zIndex: 2,
            display: 'flex', gap: 2,
          }}>
            {allSlots.slice(0, 3).map(s => (
              <div key={s.track.track_id} style={{
                width: 22, height: 22, borderRadius: '50%',
                background: s.isCoverFeature ? 'var(--mmmc-red)' : 'var(--gold)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
                fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-3xs)', fontWeight: 700,
                color: 'var(--midnight)',
              }}>
                {s.selectionNumber}
              </div>
            ))}
            {allSlots.length > 3 && (
              <div style={{
                width: 22, height: 22, borderRadius: '50%', background: 'var(--midnight-border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 'var(--fs-3xs)', color: 'var(--text-muted)',
              }}>+{allSlots.length - 3}</div>
            )}
          </div>
        )}
        {/* Cover feature star */}
        {isSelected && primarySlot && (
          <button
            onClick={(e) => { e.stopPropagation(); onSetCoverFeature(primarySlot.track.track_id); }}
            style={{
              position: 'absolute', top: 6, left: 6, zIndex: 10,
              background: primarySlot.isCoverFeature ? 'var(--gold)' : 'rgba(0,0,0,0.6)',
              border: `2px solid ${primarySlot.isCoverFeature ? 'var(--gold)' : 'rgba(255,255,255,0.3)'}`,
              borderRadius: '50%', width: 28, height: 28,
              color: primarySlot.isCoverFeature ? 'var(--midnight)' : 'white',
              fontSize: 14, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            title={primarySlot.isCoverFeature ? 'Cover feature — click to unset' : 'Set as cover feature image for title slide'}
          >★</button>
        )}

        {/* Cover art */}
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

        {/* Condensed info — 2-3 lines max */}
        <div style={{ padding: '8px 10px' }}>
          <p style={{
            fontSize: 'var(--fs-sm)', fontWeight: 600, lineHeight: 1.2,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {isSelected && allSlots.length === 1 ? primarySlot!.track.track_name : cluster.album_name}
          </p>
          <p style={{
            fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', lineHeight: 1.3,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {cluster.artist_names}
            <span style={{ color: 'var(--text-muted)' }}>
              {' · '}<span className={`badge ${badgeClass}`} style={{ fontSize: 'var(--fs-3xs)', verticalAlign: 'middle' }}>{badgeLabel}</span>
              {!cluster.isSingle && ` · ${cluster.total_tracks} tracks`}
              {featureCount && featureCount > 0 ? ` · ${featureCount}x featured` : ''}
            </span>
          </p>
          {/* Action row — Pick tracks (modal) + Spotify link (hover-reveal at small sizes) */}
          <div className="card-actions" style={{ display: 'flex', gap: 6, marginTop: 4, alignItems: 'center' }}>
            {!cluster.isSingle && (
              <button
                onClick={(e) => { e.stopPropagation(); setShowModal(true); }}
                style={{ fontSize: 'var(--fs-3xs)', color: 'var(--gold)', cursor: 'pointer' }}
                title={`Pick individual tracks from ${cluster.album_name}`}
              >
                Pick tracks ({cluster.total_tracks})
              </button>
            )}
            <a
              href={cluster.album_spotify_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="spotify-link"
              style={{
                fontSize: 'var(--fs-3xs)', color: 'var(--spotify-green)',
                padding: '1px 6px', border: '1px solid rgba(29,185,84,0.3)', borderRadius: 4,
                whiteSpace: 'nowrap',
              }}
            >
              Spotify
            </a>
          </div>
        </div>
      </div>

      {/* Track picker modal */}
      {showModal && !cluster.isSingle && (
        <div
          className="modal-overlay"
          onClick={() => setShowModal(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
          <div
            className="modal"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: 520, width: '100%', maxHeight: '80vh', overflow: 'auto', padding: 0 }}
          >
            {/* Header with album art */}
            <div style={{ display: 'flex', gap: 16, padding: 20, borderBottom: '1px solid var(--midnight-border)' }}>
              <img src={cluster.cover_art_300} alt="" style={{ width: 80, height: 80, borderRadius: 8, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ fontSize: 'var(--fs-xl)', fontWeight: 600, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {cluster.album_name}
                </h3>
                <p style={{ fontSize: 'var(--fs-md)', color: 'var(--text-secondary)' }}>{cluster.artist_names}</p>
                <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginTop: 2 }}>
                  {cluster.total_tracks} tracks · {cluster.album_type} · {cluster.release_date}
                </p>
              </div>
            </div>

            {/* Track list */}
            <div style={{ padding: '8px 0' }}>
              {cluster.tracks.map(track => {
                const isThisSelected = selectedTrackIds.has(track.track_id);
                const trackSlot = allSlots.find(s => s.track.track_id === track.track_id);
                return (
                  <div
                    key={track.track_id}
                    onClick={(e) => handleTrackClick(e, track)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 20px', cursor: 'pointer',
                      background: isThisSelected ? 'rgba(212,168,67,0.1)' : 'transparent',
                      transition: 'background 0.1s',
                    }}
                  >
                    {/* Selection indicator */}
                    <div style={{
                      width: 24, height: 24, borderRadius: 4, flexShrink: 0,
                      border: isThisSelected ? '2px solid var(--gold)' : '2px solid var(--midnight-border)',
                      background: isThisSelected ? 'var(--gold)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--midnight)', fontSize: 'var(--fs-3xs)', fontWeight: 700,
                    }}>
                      {isThisSelected && trackSlot ? trackSlot.selectionNumber : ''}
                    </div>
                    <span className="mono" style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', width: 20, textAlign: 'right' }}>
                      {track.track_number}
                    </span>
                    <span style={{
                      flex: 1, fontSize: 'var(--fs-md)',
                      color: isThisSelected ? 'var(--gold)' : 'var(--text-primary)',
                      fontWeight: isThisSelected ? 600 : 400,
                    }}>
                      {track.track_name}
                    </span>
                    {track.explicit && <span className="badge badge-explicit">E</span>}
                    <span className="mono" style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
                      {formatDuration(track.duration_ms)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--midnight-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
                {allSlots.length} of {cluster.total_tracks} selected
              </span>
              <button
                className="btn btn-gold btn-sm"
                onClick={() => setShowModal(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
});
