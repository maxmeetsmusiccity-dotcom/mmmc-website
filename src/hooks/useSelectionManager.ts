import { useState, useMemo, useCallback, useRef } from 'react';
import type { ReleaseCluster } from '../lib/spotify';
import { type SelectionSlot, buildSlots, getSlideGroup } from '../lib/selection';

export function useSelectionManager() {
  const [selections, setSelections] = useState<SelectionSlot[]>([]);
  const selectionHistory = useRef<SelectionSlot[][]>([]);
  const [historyLength, setHistoryLength] = useState(0);

  const pushSelectionHistory = useCallback((prev: SelectionSlot[]) => {
    selectionHistory.current = [...selectionHistory.current.slice(-19), prev];
    setHistoryLength(selectionHistory.current.length);
  }, []);

  const selectionsByAlbum = useMemo(() => {
    const map = new Map<string, SelectionSlot[]>();
    for (const s of selections) {
      const arr = map.get(s.albumId) || [];
      arr.push(s);
      map.set(s.albumId, arr);
    }
    return map;
  }, [selections]);

  const haptic = useCallback((ms = 10) => {
    try { navigator?.vibrate?.(ms); } catch { /* not supported */ }
  }, []);

  const handleSelectRelease = useCallback((cluster: ReleaseCluster, trackId?: string) => {
    haptic();
    setSelections(prev => {
      pushSelectionHistory(prev);
      const chosenTrackId = trackId || cluster.titleTrackId;
      const track = cluster.tracks.find(t => t.track_id === chosenTrackId) || cluster.tracks[0];

      const existingTrack = prev.findIndex(s => s.track.track_id === track.track_id);
      if (existingTrack >= 0) {
        return buildSlots(prev.filter((_, i) => i !== existingTrack));
      }

      if (cluster.isSingle) {
        const existingAlbum = prev.findIndex(s => s.albumId === cluster.album_spotify_id);
        if (existingAlbum >= 0) {
          return buildSlots(prev.filter((_, i) => i !== existingAlbum));
        }
      }

      const newSlot: SelectionSlot = {
        track,
        albumId: cluster.album_spotify_id,
        selectionNumber: prev.length + 1,
        slideGroup: getSlideGroup(prev.length + 1),
        positionInSlide: ((prev.length) % 8) + 1,
        isCoverFeature: false,
      };

      return buildSlots([...prev, newSlot]);
    });
  }, [haptic, pushSelectionHistory]);

  const handleDeselect = useCallback((albumId: string, trackId?: string) => {
    haptic(5);
    setSelections(prev => {
      if (trackId) return buildSlots(prev.filter(s => s.track.track_id !== trackId));
      return buildSlots(prev.filter(s => s.albumId !== albumId));
    });
  }, [haptic]);

  const handleSetCoverFeature = useCallback((trackId: string) => {
    haptic(15);
    setSelections(prev => prev.map(s => ({
      ...s,
      isCoverFeature: s.track.track_id === trackId,
    })));
  }, [haptic]);

  const undoSelection = useCallback(() => {
    const prev = selectionHistory.current.pop();
    if (prev) {
      setSelections(prev);
      setHistoryLength(selectionHistory.current.length);
    }
  }, []);

  return {
    selections,
    setSelections,
    selectionsByAlbum,
    handleSelectRelease,
    handleDeselect,
    handleSetCoverFeature,
    pushSelectionHistory,
    undoSelection,
    selectionHistory,
    historyLength,
    haptic,
  };
}
