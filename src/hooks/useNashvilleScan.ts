import { useState, useCallback, useRef } from 'react';
import {
  fetchFollowedArtists,
  fetchNewReleases,
  getScanCutoff,
  groupIntoReleases,
  checkScanHealth,
  type TrackItem,
  type ReleaseCluster,
} from '../lib/spotify';
import { isTokenExpired, refreshToken } from '../lib/auth';
import { saveWeek, getFeatureCounts } from '../lib/supabase';
import { batchResolveAppleMusic } from '../lib/apple-music';

type Phase = 'auth' | 'ready' | 'scanning' | 'results';

interface ScanDeps {
  userId: string | null;
  weekDate: string;
  allTracks: TrackItem[];
  setPhase: (p: Phase) => void;
  setError: (e: string) => void;
  setToken: (t: string | null) => void;
  setAllTracks: React.Dispatch<React.SetStateAction<TrackItem[]>>;
  setReleases: (r: ReleaseCluster[]) => void;
  setArtistCount: (n: number) => void;
  setLastScanned: (s: string) => void;
  setRateLimited: (b: boolean) => void;
  setLoadedFromCache: (b: boolean) => void;
  setFeatureCounts: (m: Map<string, number>) => void;
  setAppleEnriching: (b: boolean) => void;
}

export function useNashvilleScan(deps: ScanDeps) {
  const [scanStatus, setScanStatus] = useState('');
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0 });
  const scanAbortRef = useRef<AbortController | null>(null);

  // Ref holds the latest deps so runScan doesn't need to re-create on each render
  const depsRef = useRef(deps);
  depsRef.current = deps;

  const runScan = useCallback(async (tkn: string) => {
    const d = depsRef.current;
    d.setPhase('scanning');
    d.setError('');
    d.setRateLimited(false);
    d.setLoadedFromCache(false);
    const abortController = new AbortController();
    scanAbortRef.current = abortController;
    const { signal } = abortController;
    const scanStart = Date.now();
    try {
      let activeToken = tkn;
      if (isTokenExpired()) {
        setScanStatus('Refreshing Spotify token...');
        const refreshed = await refreshToken();
        if (refreshed) {
          activeToken = refreshed;
          d.setToken(refreshed);
        } else {
          d.setToken(null);
          d.setPhase('ready');
          d.setError('Session expired. Please reconnect Spotify.');
          return;
        }
      }

      setScanStatus('Checking Spotify status...');
      const health = await checkScanHealth(activeToken);
      if (!health.ok) {
        d.setRateLimited(true);
        d.setError(health.message);
        d.setPhase('ready');
        return;
      }
      if (import.meta.env.DEV) console.log(`[SCAN] Health check: ${health.message}`);

      setScanStatus('Fetching followed artists...');
      const artists = await fetchFollowedArtists(activeToken, (cur, tot) => {
        setScanProgress({ current: cur, total: tot });
        setScanStatus(`Loaded ${cur} artists...`);
      }, false, signal);

      const cutoff = getScanCutoff();
      setScanStatus(`Scanning releases since ${cutoff}...`);
      setScanProgress({ current: 0, total: artists.length });

      let liveTrackCount = 0;
      const result = await fetchNewReleases(artists, activeToken, cutoff, (cur, tot, albumsFound, status) => {
        setScanProgress({ current: cur, total: tot });
        const elapsed = (Date.now() - scanStart) / 1000;
        const statusDot = status === 'green' ? '\uD83D\uDFE2' : status === 'yellow' ? '\uD83D\uDFE1' : '\uD83D\uDD34';
        const countLabel = `${albumsFound} album${albumsFound !== 1 ? 's' : ''} \u00B7 ${liveTrackCount} track${liveTrackCount !== 1 ? 's' : ''}`;
        if (status === 'red') {
          setScanStatus(`${statusDot} Rate limited \u2014 saving ${countLabel} found so far`);
        } else if (cur >= 30 && cur < tot) {
          const rate = cur / elapsed;
          const remaining = (tot - cur) / rate;
          const eta = remaining < 10 ? 'Almost done...'
            : remaining < 60 ? `~${Math.round(remaining)}s remaining`
            : `~${Math.floor(remaining / 60)}m ${Math.round(remaining % 60)}s remaining`;
          setScanStatus(`${statusDot} ${cur}/${tot} artists \u00B7 ${countLabel} \u00B7 ${eta}`);
        } else {
          setScanStatus(`${statusDot} ${cur}/${tot} artists \u00B7 ${countLabel}`);
        }
      }, (tracks) => {
        liveTrackCount = tracks.length;
        d.setAllTracks(tracks);
        d.setReleases(groupIntoReleases(tracks));
      }, signal);

      scanAbortRef.current = null;
      const { tracks, failCount, totalArtists, rateLimited: wasRateLimited, retryAfterSeconds } = result;

      if (result.aborted) {
        if (tracks.length > 0) {
          d.setAllTracks(tracks);
          d.setReleases(groupIntoReleases(tracks));
          d.setPhase('results');
          d.setError(`Scan cancelled after ${result.completedArtists}/${totalArtists} artists. Showing ${tracks.length} tracks found.`);
        } else {
          d.setPhase('ready');
        }
        return;
      }
      const now = new Date().toISOString();
      d.setAllTracks(tracks);
      d.setReleases(groupIntoReleases(tracks));
      d.setArtistCount(totalArtists);
      d.setLastScanned(now);
      d.setRateLimited(wasRateLimited);
      d.setPhase('results');

      if (wasRateLimited) {
        const mins = Math.ceil(retryAfterSeconds / 60);
        d.setError(`Rate limited after ${result.completedArtists}/${totalArtists} artists. Found ${tracks.length} releases. Try again in ~${mins} min.`);
      }

      const artistIds = [...new Set(tracks.map(t => t.artist_id).filter(Boolean))];
      if (artistIds.length > 0) {
        getFeatureCounts(artistIds).then(d.setFeatureCounts).catch(() => {});
      }

      if (tracks.length > 0) {
        d.setAppleEnriching(true);
        batchResolveAppleMusic(tracks).then(appleMap => {
          d.setAllTracks(prev => prev.map(t => {
            const key = `${t.artist_names}::${t.track_name}`;
            const url = appleMap.get(key);
            return url ? { ...t, apple_music_url: url } : t;
          }));
          d.setAppleEnriching(false);
        }).catch(() => d.setAppleEnriching(false));
      }

      if (tracks.length > 0) {
        if (d.userId) {
          try {
            sessionStorage.setItem(`nmf_scan_${d.weekDate}_${d.userId}`, JSON.stringify({ tracks, timestamp: now }));
          } catch { /* storage full, ignore */ }
          saveWeek({ week_date: d.weekDate, all_releases: tracks, playlist_master_pushed: false, carousel_generated: false }, d.userId);
        }
      } else if (failCount > totalArtists * 0.5) {
        d.setError(`Spotify rate limit hit \u2014 ${failCount}/${totalArtists} artists failed. Wait 30-60 minutes and try again.`);
      } else {
        d.setError(`Scan found 0 releases since ${cutoff}. Try re-scanning.`);
      }
    } catch (e) {
      scanAbortRef.current = null;
      if ((e as DOMException).name === 'AbortError') {
        if (d.allTracks.length > 0) d.setPhase('results');
        else d.setPhase('ready');
        return;
      }
      if ((e as Error).message === 'AUTH_EXPIRED') {
        d.setToken(null);
        d.setPhase('ready');
        d.setError('Spotify session expired. Use the Nashville source or paste artist names instead.');
      } else {
        d.setError((e as Error).message);
        d.setPhase('ready');
      }
    }
  }, []);

  const cancelScan = useCallback(() => {
    scanAbortRef.current?.abort();
  }, []);

  return {
    scanStatus,
    setScanStatus,
    scanProgress,
    setScanProgress,
    scanAbortRef,
    runScan,
    cancelScan,
  };
}
