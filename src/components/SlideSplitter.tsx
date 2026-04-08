import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
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

function computeAutoDividers(trackCount: number, tracksPerSlide: number): number[] {
  const splits = autoSplit(trackCount, tracksPerSlide);
  return splits.slice(0, -1).map(s => s.end);
}

function buildGroups(orderedTracks: TrackItem[], dividers: number[]): SlideGroup[] {
  const sorted = [0, ...dividers.sort((a, b) => a - b), orderedTracks.length];
  const result: SlideGroup[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const start = sorted[i];
    const end = sorted[i + 1];
    const groupTracks = orderedTracks.slice(start, end);
    if (groupTracks.length === 0) continue;
    const opts = getGridsForCount(groupTracks.length);
    const bestGrid = opts.exact[0] || opts.logo[0] || opts.close[0] || opts.mosaic[0];
    result.push({ tracks: groupTracks, gridId: bestGrid?.id || '1x1' });
  }
  return result;
}

export default function SlideSplitter({ tracks, defaultTracksPerSlide, onSplitChange }: Props) {
  const isManual = useRef(false);
  const [orderedTracks, setOrderedTracks] = useState<TrackItem[]>(tracks);
  const dragIdx = useRef<number>(-1);
  const [dragOverIdx, setDragOverIdx] = useState<number>(-1);

  const [dividers, setDividers] = useState<number[]>(() =>
    computeAutoDividers(tracks.length, defaultTracksPerSlide),
  );

  // Sync ordered tracks when parent tracks change (new selections)
  useEffect(() => {
    setOrderedTracks(prev => {
      // Keep existing order for tracks that still exist, append new ones
      const existingIds = new Set(prev.map(t => t.track_id));
      const newIds = new Set(tracks.map(t => t.track_id));
      const kept = prev.filter(t => newIds.has(t.track_id));
      const added = tracks.filter(t => !existingIds.has(t.track_id));
      return [...kept, ...added];
    });
  }, [tracks]);

  // Reset to auto when tracksPerSlide changes from parent
  const prevTracksPerSlide = useRef(defaultTracksPerSlide);
  useEffect(() => {
    if (prevTracksPerSlide.current !== defaultTracksPerSlide) {
      isManual.current = false;
      prevTracksPerSlide.current = defaultTracksPerSlide;
    }
    if (isManual.current) {
      setDividers(prev => prev.filter(d => d > 0 && d < orderedTracks.length));
    } else {
      setDividers(computeAutoDividers(orderedTracks.length, defaultTracksPerSlide));
    }
  }, [orderedTracks.length, defaultTracksPerSlide]);

  const groups = useMemo(
    () => buildGroups(orderedTracks, dividers),
    [orderedTracks, dividers],
  );

  const notifyParent = useCallback((newTracks: TrackItem[], newDividers: number[]) => {
    onSplitChange(buildGroups(newTracks, newDividers));
  }, [onSplitChange]);

  const updateDividers = (newDividers: number[]) => {
    setDividers(newDividers);
    notifyParent(orderedTracks, newDividers);
  };

  const addDivider = (afterIndex: number) => {
    if (dividers.includes(afterIndex)) return;
    isManual.current = true;
    updateDividers([...dividers, afterIndex]);
  };

  const removeDivider = (atIndex: number) => {
    isManual.current = true;
    updateDividers(dividers.filter(d => d !== atIndex));
  };

  const resetToAuto = () => {
    isManual.current = false;
    setOrderedTracks(tracks);
    const newDividers = computeAutoDividers(tracks.length, defaultTracksPerSlide);
    setDividers(newDividers);
    onSplitChange(buildGroups(tracks, newDividers));
  };

  // Drag and drop handlers
  const handleDragStart = (idx: number) => {
    dragIdx.current = idx;
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIdx(idx);
  };

  const handleDrop = (targetIdx: number) => {
    const fromIdx = dragIdx.current;
    if (fromIdx < 0 || fromIdx === targetIdx) {
      dragIdx.current = -1;
      setDragOverIdx(-1);
      return;
    }

    isManual.current = true;
    const newTracks = [...orderedTracks];
    const [moved] = newTracks.splice(fromIdx, 1);
    newTracks.splice(targetIdx, 0, moved);
    setOrderedTracks(newTracks);

    // Adjust dividers: keep them at the same positions relative to the new order
    // (dividers mark positions between tracks, the tracks moved but dividers stay)
    notifyParent(newTracks, dividers);

    dragIdx.current = -1;
    setDragOverIdx(-1);
  };

  const handleDragEnd = () => {
    dragIdx.current = -1;
    setDragOverIdx(-1);
  };

  /** Shuffle tracks within a single slide group */
  const shuffleSlide = (slideIndex: number) => {
    isManual.current = true;
    const group = groups[slideIndex];
    if (!group || group.tracks.length <= 1) return;

    // Find the start index in orderedTracks for this group
    let startIdx = 0;
    for (let i = 0; i < slideIndex; i++) startIdx += groups[i].tracks.length;

    const newTracks = [...orderedTracks];
    const slice = newTracks.slice(startIdx, startIdx + group.tracks.length);
    for (let i = slice.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [slice[i], slice[j]] = [slice[j], slice[i]];
    }
    newTracks.splice(startIdx, slice.length, ...slice);
    setOrderedTracks(newTracks);
    notifyParent(newTracks, dividers);
  };

  return (
    <div data-testid="slide-splitter" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <p style={{ fontSize: 'var(--fs-lg)', color: 'var(--text-muted)' }}>
          Slide Split <span className="mono" style={{ color: 'var(--gold)' }}>({groups.length} slide{groups.length !== 1 ? 's' : ''})</span>
        </p>
        <button
          onClick={resetToAuto}
          style={{ fontSize: 'var(--fs-2xs)', color: 'var(--steel)', cursor: 'pointer' }}
        >
          Reset to Auto
        </button>
      </div>
      <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.4 }}>
        Drag tracks to reorder within or across slides. Click between tracks to add/remove slide breaks.
      </p>

      <div style={{
        display: 'flex', flexDirection: 'column', gap: 2,
        background: 'var(--midnight)', borderRadius: 8, padding: 8,
        border: '1px solid var(--midnight-border)',
      }}>
        {orderedTracks.map((track, i) => {
          const isDivider = dividers.includes(i + 1);
          const slideNum = groups.findIndex(g => g.tracks.some(t => t.track_id === track.track_id)) + 1;
          const isDragOver = dragOverIdx === i;
          // Is this the last track in its slide group?
          const nextSlideNum = i < orderedTracks.length - 1
            ? groups.findIndex(g => g.tracks.some(t => t.track_id === orderedTracks[i + 1].track_id)) + 1
            : -1;
          const isLastInGroup = nextSlideNum !== slideNum;

          return (
            <div key={track.track_id || i}>
              {/* Track row — draggable */}
              <div
                draggable
                onDragStart={() => handleDragStart(i)}
                onDragOver={(e) => handleDragOver(e, i)}
                onDrop={() => handleDrop(i)}
                onDragEnd={handleDragEnd}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 8px', borderRadius: 4,
                  fontSize: 'var(--fs-sm)', cursor: 'grab',
                  background: isDragOver ? 'rgba(212,168,67,0.1)' : 'transparent',
                  borderTop: isDragOver ? '2px solid var(--gold)' : '2px solid transparent',
                  transition: 'background 0.1s',
                }}
              >
                <span style={{ color: 'var(--midnight-border)', fontSize: 'var(--fs-xs)', cursor: 'grab', userSelect: 'none' }}>
                  &#x2630;
                </span>
                <span className="mono" style={{ color: 'var(--gold)', width: 20, textAlign: 'right', fontSize: 'var(--fs-sm)' }}>
                  {i + 1}
                </span>
                {track.cover_art_64 && (
                  <img src={track.cover_art_64} alt="" style={{ width: 20, height: 20, borderRadius: 2 }} draggable={false} onError={e => { (e.target as HTMLImageElement).src = '/placeholder-album.svg'; (e.target as HTMLImageElement).onerror = null; }} />
                )}
                <span style={{ flex: 1, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {track.artist_names} — {track.track_name}
                </span>
                <span className="mono" style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)' }}>
                  S{slideNum}
                </span>
              </div>

              {/* Shuffle button after last track in each group */}
              {isLastInGroup && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '4px 8px' }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); shuffleSlide(slideNum - 1); }}
                    title={`Randomize track order in Slide ${slideNum}`}
                    style={{
                      fontSize: 'var(--fs-xs)', color: 'var(--gold)', cursor: 'pointer',
                      padding: '2px 8px', borderRadius: 4,
                      background: 'rgba(212,168,67,0.1)',
                      border: '1px solid rgba(212,168,67,0.2)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Shuffle Slide {slideNum}
                  </button>
                </div>
              )}

              {/* Divider zone — slide break labels */}
              {i < orderedTracks.length - 1 && isDivider && (
                <div
                  onClick={() => removeDivider(i + 1)}
                  onDragOver={(e) => { e.preventDefault(); setDragOverIdx(i + 0.5); }}
                  onDrop={() => handleDrop(i + 1)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '2px 0', marginLeft: 28, height: 24, cursor: 'pointer',
                    borderTop: '2px solid var(--gold)',
                    transition: 'all 0.15s',
                  }}
                  title="Click to remove slide break"
                >
                  <span style={{
                    fontSize: 'var(--fs-2xs)', color: 'var(--gold)', fontWeight: 600,
                    background: 'var(--midnight)', padding: '0 6px',
                  }}>
                    Slide {slideNum} of {groups.length} ({groups[slideNum - 1]?.tracks.length || 0} tracks)
                  </span>
                </div>
              )}
              {i < orderedTracks.length - 1 && !isDivider && (
                <div
                  onClick={() => addDivider(i + 1)}
                  onDragOver={(e) => { e.preventDefault(); setDragOverIdx(i + 0.5); }}
                  onDrop={() => handleDrop(i + 1)}
                  style={{
                    height: 8, marginLeft: 28, cursor: 'pointer',
                    borderTop: '1px dashed transparent',
                    transition: 'all 0.15s',
                  }}
                  title="Click to add slide break here"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
