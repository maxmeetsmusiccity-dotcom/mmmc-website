/**
 * Spotify source adapter.
 * Wraps existing spotify.ts scan functions.
 * Results feed directly into the TrackItem pipeline.
 */

import {
  fetchFollowedArtists,
  fetchNewReleases,
  checkScanHealth,
  type SpotifyArtist,
  type TrackItem,
  type ScanResult,
  type ScanStatus,
} from '../spotify';

export interface SpotifyScanOptions {
  token: string;
  cutoffDate: string;
  forceRefreshArtists?: boolean;
  onArtistProgress?: (current: number, total: number) => void;
  onScanProgress?: (current: number, total: number, releasesFound: number, status: ScanStatus) => void;
  onReleasesFound?: (tracks: TrackItem[]) => void;
}

export interface SpotifyScanResult extends ScanResult {
  artists: SpotifyArtist[];
}

/**
 * Run a full Spotify scan:
 * 1. Health check (detect rate limit before scanning)
 * 2. Fetch followed artists (cached 7 days)
 * 3. Sequential scan for new releases
 */
export async function scanSpotify(options: SpotifyScanOptions): Promise<SpotifyScanResult> {
  const { token, cutoffDate, forceRefreshArtists, onArtistProgress, onScanProgress, onReleasesFound } = options;

  // Pre-scan health check
  const health = await checkScanHealth(token);
  if (!health.ok) {
    return {
      tracks: [],
      failCount: 0,
      totalArtists: 0,
      rateLimited: true,
      retryAfterSeconds: health.retryAfter || 60,
      completedArtists: 0,
      artists: [],
    };
  }

  // Fetch followed artists
  const artists = await fetchFollowedArtists(
    token,
    onArtistProgress || (() => {}),
    forceRefreshArtists,
  );

  // Run sequential scan
  const result = await fetchNewReleases(
    artists,
    token,
    cutoffDate,
    onScanProgress || (() => {}),
    onReleasesFound,
  );

  return { ...result, artists };
}
