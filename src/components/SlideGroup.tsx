import { useRef } from 'react';
import type { SelectionSlot } from '../lib/selection';
import { GRID_POSITIONS } from '../lib/selection';

interface Props {
  slideNumber: number;
  slots: SelectionSlot[];
  onShuffle: () => void;
  onReorder: (fromPos: number, toPos: number) => void;
  onSetCoverFeature: (trackId: string) => void;
  onDeselect: (albumId: string) => void;
}

export default function SlideGroup({ slideNumber, slots, onShuffle, onReorder, onSetCoverFeature, onDeselect }: Props) {
  const dragIdx = useRef<number | null>(null);

  const handleDragStart = (idx: number) => {
    dragIdx.current = idx;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (targetIdx: number) => {
    if (dragIdx.current !== null && dragIdx.current !== targetIdx) {
      onReorder(dragIdx.current, targetIdx);
    }
    dragIdx.current = null;
  };

  return (
    <div style={{ marginBottom: 32 }}>
      {/* Slide header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 12, padding: '8px 0',
        borderBottom: '1px solid var(--midnight-border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem' }}>
            Slide {slideNumber}
          </h3>
          <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {slots.length}/8
          </span>
        </div>
        <button className="btn btn-sm" onClick={onShuffle}>
          Shuffle
        </button>
      </div>

      {/* 3x3 Grid preview */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 8,
        maxWidth: 'min(360px, 100%)',
      }}>
        {Array.from({ length: 9 }, (_, i) => {
          // Position 4 (0-indexed) = center = MMMC logo
          if (i === 4) {
            return (
              <div key="logo" style={{
                aspectRatio: '1', borderRadius: 8,
                background: 'var(--midnight)',
                border: '1px solid var(--midnight-border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 600,
              }}>
                MMMC
              </div>
            );
          }

          // Map grid position to slot index (skip position 4)
          const slotIdx = i < 4 ? i : i - 1;
          const slot = slots[slotIdx];

          if (!slot) {
            return (
              <div key={i} style={{
                aspectRatio: '1', borderRadius: 8,
                background: 'var(--midnight)',
                border: '1px dashed var(--midnight-border)',
              }} />
            );
          }

          const posLabel = GRID_POSITIONS[slotIdx];

          return (
            <div
              key={slot.track.track_id}
              draggable
              onDragStart={() => handleDragStart(slotIdx)}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(slotIdx)}
              style={{
                aspectRatio: '1', borderRadius: 8, overflow: 'hidden',
                position: 'relative', cursor: 'grab',
                border: slot.isCoverFeature ? '2px solid var(--mmmc-red)' : '1px solid var(--midnight-border)',
              }}
              title={`${posLabel}: ${slot.track.artist_names} — ${slot.track.track_name}`}
            >
              <img
                src={slot.track.cover_art_300}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              {/* Selection number overlay */}
              <div style={{
                position: 'absolute', top: 2, left: 2,
                width: 18, height: 18, borderRadius: '50%',
                background: slot.isCoverFeature ? 'var(--mmmc-red)' : 'var(--gold)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.55rem', fontWeight: 700, color: 'var(--midnight)',
                fontFamily: 'var(--font-mono)',
              }}>
                {slot.selectionNumber}
              </div>
              {/* Context menu on right-click area */}
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                background: 'rgba(0,0,0,0.7)', padding: '2px 4px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{
                  fontSize: '0.5rem', color: '#fff',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                }}>
                  {slot.track.track_name}
                </span>
                <div style={{ display: 'flex', gap: 2 }}>
                  {!slot.isCoverFeature && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onSetCoverFeature(slot.track.track_id); }}
                      title="Set as cover feature"
                      style={{ fontSize: '0.5rem', color: 'var(--mmmc-red)', padding: '0 2px' }}
                    >
                      ★
                    </button>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); onDeselect(slot.albumId); }}
                    title="Remove"
                    style={{ fontSize: '0.5rem', color: 'var(--text-muted)', padding: '0 2px' }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Track list below grid */}
      <div style={{ marginTop: 8 }}>
        {slots.map(slot => (
          <div key={slot.track.track_id} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '4px 0', fontSize: '0.7rem',
          }}>
            <span className="mono" style={{ color: 'var(--gold)', width: 20, textAlign: 'right' }}>
              {slot.selectionNumber}
            </span>
            <span style={{ color: 'var(--text-secondary)', flex: 1 }}>
              {slot.track.artist_names} — {slot.track.track_name}
            </span>
            {slot.isCoverFeature && (
              <span style={{ color: 'var(--mmmc-red)', fontSize: '0.6rem', fontWeight: 600 }}>COVER</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
