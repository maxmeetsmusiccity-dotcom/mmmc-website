import { useState, useMemo } from 'react';
import type { TrackItem } from '../lib/spotify';
import { autoSplit, getGridsForCount } from '../lib/grid-layouts';

export interface SlideGroup {
  tracks: TrackItem[];
  gridId: string;
}

interface Props {
  tracks: TrackItem[];
  defaultTracksPerSlide: number;
  onSplitChange: (groups: SlideGroup[]) => void;
}

export default function SlideSplitter({ tracks, defaultTracksPerSlide, onSplitChange }: Props) {
  // Divider positions (indices where a slide break occurs)
  const [dividers, setDividers] = useState<number[]>(() => {
    const splits = autoSplit(tracks.length, defaultTracksPerSlide);
    // Dividers are at the end of each group except the last
    return splits.slice(0, -1).map(s => s.end);
  });

  // Compute groups from dividers
  const groups = useMemo(() => {
    const sortedDividers = [0, ...dividers.sort((a, b) => a - b), tracks.length];
    const result: SlideGroup[] = [];
    for (let i = 0; i < sortedDividers.length - 1; i++) {
      const start = sortedDividers[i];
      const end = sortedDividers[i + 1];
      const groupTracks = tracks.slice(start, end);
      if (groupTracks.length === 0) continue;
      // Pick best grid for this group's track count
      const opts = getGridsForCount(groupTracks.length);
      const bestGrid = opts.exact[0] || opts.logo[0] || opts.close[0] || opts.mosaic[0];
      result.push({
        tracks: groupTracks,
        gridId: bestGrid?.id || '1x1',
      });
    }
    return result;
  }, [tracks, dividers]);

  // Notify parent of changes
  const updateDividers = (newDividers: number[]) => {
    setDividers(newDividers);
    // Recompute and notify (will happen via effect below)
    const sortedDividers = [0, ...newDividers.sort((a, b) => a - b), tracks.length];
    const result: SlideGroup[] = [];
    for (let i = 0; i < sortedDividers.length - 1; i++) {
      const start = sortedDividers[i];
      const end = sortedDividers[i + 1];
      const groupTracks = tracks.slice(start, end);
      if (groupTracks.length === 0) continue;
      const opts = getGridsForCount(groupTracks.length);
      const bestGrid = opts.exact[0] || opts.logo[0] || opts.close[0] || opts.mosaic[0];
      result.push({ tracks: groupTracks, gridId: bestGrid?.id || '1x1' });
    }
    onSplitChange(result);
  };

  const addDivider = (afterIndex: number) => {
    if (dividers.includes(afterIndex)) return;
    updateDividers([...dividers, afterIndex]);
  };

  const removeDivider = (atIndex: number) => {
    updateDividers(dividers.filter(d => d !== atIndex));
  };

  const resetToAuto = () => {
    const splits = autoSplit(tracks.length, defaultTracksPerSlide);
    const newDividers = splits.slice(0, -1).map(s => s.end);
    updateDividers(newDividers);
  };

  return (
    <div data-testid="slide-splitter" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Slide Split <span className="mono" style={{ color: 'var(--gold)' }}>({groups.length} slide{groups.length !== 1 ? 's' : ''})</span>
        </p>
        <button
          onClick={resetToAuto}
          style={{ fontSize: '0.6rem', color: 'var(--steel)', cursor: 'pointer' }}
        >
          Reset to Auto
        </button>
      </div>

      <div style={{
        display: 'flex', flexDirection: 'column', gap: 2,
        background: 'var(--midnight)', borderRadius: 8, padding: 8,
        border: '1px solid var(--midnight-border)',
      }}>
        {tracks.map((track, i) => {
          const isDivider = dividers.includes(i + 1);
          const slideNum = groups.findIndex(g => g.tracks.includes(track)) + 1;

          return (
            <div key={track.track_id || i}>
              {/* Track row */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '4px 8px', borderRadius: 4,
                fontSize: '0.7rem',
              }}>
                <span className="mono" style={{ color: 'var(--gold)', width: 20, textAlign: 'right', fontSize: '0.6rem' }}>
                  {i + 1}
                </span>
                {track.cover_art_64 && (
                  <img src={track.cover_art_64} alt="" style={{ width: 20, height: 20, borderRadius: 2 }} />
                )}
                <span style={{ flex: 1, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {track.artist_names} — {track.track_name}
                </span>
                <span className="mono" style={{ fontSize: '0.5rem', color: 'var(--text-muted)' }}>
                  S{slideNum}
                </span>
              </div>

              {/* Divider zone (clickable area between tracks) */}
              {i < tracks.length - 1 && (
                <div
                  onClick={() => isDivider ? removeDivider(i + 1) : addDivider(i + 1)}
                  style={{
                    height: isDivider ? 24 : 8,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', margin: '0 28px',
                    borderTop: isDivider ? '2px solid var(--gold)' : '1px dashed transparent',
                    transition: 'all 0.15s',
                  }}
                  title={isDivider ? 'Click to remove slide break' : 'Click to add slide break here'}
                >
                  {isDivider && (
                    <span style={{
                      fontSize: '0.5rem', color: 'var(--gold)', fontWeight: 600,
                      background: 'var(--midnight)', padding: '0 6px',
                    }}>
                      ── Slide Break ──
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Group summary */}
      <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
        {groups.map((group, i) => (
          <span key={i} className="badge" style={{
            background: 'rgba(212,168,67,0.12)', color: 'var(--gold)',
            fontSize: '0.6rem',
          }}>
            Slide {i + 1}: {group.tracks.length} track{group.tracks.length !== 1 ? 's' : ''}
          </span>
        ))}
      </div>
    </div>
  );
}
