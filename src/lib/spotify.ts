import { clearToken } from './auth';
export { parseReleaseDate } from './scan-utils';
import { parseReleaseDate } from './scan-utils';

const API = 'https://api.spotify.com/v1';

export interface SpotifyArtist {
  id: string;
  name: string;
  external_urls: { spotify: string };
  genres: string[];
  followers: { total: number };
}

export interface SpotifyAlbum {
  id: string;
  name: string;
  album_type: string;
  release_date: string;
  total_tracks: number;
  external_urls: { spotify: string };
  images: { url: string; width: number; height: number }[];
  artists: { id: string; name: string; external_urls: { spotify: string } }[];
}

export interface SpotifyTrack {
  id: string;
  name: string;
  track_number: number;
  duration_ms: number;
  explicit: boolean;
  uri: string;
  external_urls: { spotify: string };
}

export interface TrackItem {
  track_name: string;
  track_number: number;
  track_uri: string;
  track_spotify_url: string;
  track_id: string;
  duration_ms: number;
  explicit: boolean;
  album_name: string;
  artist_names: string;
  artist_id: string;
  artist_spotify_url: string;
  artist_genres: string[];
  artist_followers: number;
  album_type: string;
  release_date: string;
  total_tracks: number;
  album_spotify_url: string;
  album_spotify_id: string;
  cover_art_640: string;
  cover_art_300: string;
  cover_art_64: string;
  apple_music_url?: string;
  composer_name?: string | null;
}

export interface ReleaseCluster {
  album_spotify_id: string;
  album_name: string;
  album_type: string;
  release_date: string;
  artist_names: string;
  total_tracks: number;
  cover_art_640: string;
  cover_art_300: string;
  cover_art_64: string;
  album_spotify_url: string;
  isSingle: boolean;
  tracks: TrackItem[];
  titleTrackId: string; // best default track
}

/** Group flat track list into release clusters */
export function groupIntoReleases(tracks: TrackItem[]): ReleaseCluster[] {
  const map = new Map<string, TrackItem[]>();
  for (const t of tracks) {
    // Guard against malformed track data
    if (!t || !t.album_spotify_id) continue;
    if (!t.artist_names) t.artist_names = 'Unknown Artist';
    if (!t.album_name) t.album_name = t.track_name || 'Unknown';
    if (!t.cover_art_640) t.cover_art_640 = '/placeholder-album.svg';
    if (!t.cover_art_300) t.cover_art_300 = t.cover_art_640;
    const arr = map.get(t.album_spotify_id) || [];
    arr.push(t);
    map.set(t.album_spotify_id, arr);
  }

  const clusters: ReleaseCluster[] = [];
  for (const [albumId, albumTracks] of map) {
    albumTracks.sort((a, b) => a.track_number - b.track_number);
    const first = albumTracks[0];
    const isSingle = first.total_tracks === 1 && first.album_type === 'single';

    // Find title track: track name matches or contains album name
    const albumLower = first.album_name.toLowerCase();
    const titleTrack = albumTracks.find(t =>
      t.track_name.toLowerCase() === albumLower ||
      albumLower.includes(t.track_name.toLowerCase()) ||
      t.track_name.toLowerCase().includes(albumLower)
    ) || albumTracks[0];

    clusters.push({
      album_spotify_id: albumId,
      album_name: first.album_name,
      album_type: first.album_type,
      release_date: first.release_date,
      artist_names: first.artist_names,
      total_tracks: first.total_tracks,
      cover_art_640: first.cover_art_640,
      cover_art_300: first.cover_art_300,
      cover_art_64: first.cover_art_64,
      album_spotify_url: first.album_spotify_url,
      isSingle,
      tracks: albumTracks,
      titleTrackId: titleTrack.track_id,
    });
  }

  // Sort by release date desc, then artist name
  clusters.sort((a, b) => {
    const d = b.release_date.localeCompare(a.release_date);
    return d !== 0 ? d : a.artist_names.localeCompare(b.artist_names);
  });

  return clusters;
}

export class RateLimitError extends Error {
  retryAfterSeconds: number;
  constructor(retryAfter: number) {
    super('RATE_LIMITED');
    this.name = 'RateLimitError';
    this.retryAfterSeconds = retryAfter;
  }
}

/** Minimum ms between Spotify API requests — safety floor */
const MIN_GAP_MS = 150;
let lastCallTime = 0;

async function enforceGap(): Promise<void> {
  const elapsed = Date.now() - lastCallTime;
  if (elapsed < MIN_GAP_MS) {
    await new Promise(r => setTimeout(r, MIN_GAP_MS - elapsed));
  }
}

/**
 * Core Spotify API caller — matches Python nmf_common.py retry strategy:
 * - 429: throw RateLimitError immediately. Do NOT retry — each retry
 *   EXTENDS the penalty. Retry-After can escalate to 13+ hours.
 * - 5xx: retry up to 8 times with min(30s, 1.2^attempt + random()) backoff.
 * - 401: throw immediately.
 * - Network errors: retry up to 8 times with same backoff (cap 15s).
 */
async function callSpotify(url: string, token: string, signal?: AbortSignal): Promise<Response> {
  const MAX_RETRIES = 8;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    await enforceGap();
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });
      lastCallTime = Date.now();

      if (res.status === 401) {
        clearToken();
        throw new Error('AUTH_EXPIRED');
      }

      // 429: STOP. Do NOT retry — it extends the jail.
      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get('Retry-After') || '60', 10);
        console.error(`[SCAN] 429 Rate limited. Retry-After: ${retryAfter}s. NOT retrying.`);
        throw new RateLimitError(retryAfter);
      }

      // 5xx: transient server error — retry with exponential backoff
      if (res.status >= 500 && attempt < MAX_RETRIES) {
        const wait = Math.min(30000, Math.round(Math.pow(1.2, attempt) * 1000 + Math.random() * 1000));
        console.warn(`[SCAN] HTTP ${res.status} attempt ${attempt + 1}/${MAX_RETRIES}, retrying in ${wait}ms`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }

      if (!res.ok) {
        throw new Error(`Spotify API error: ${res.status}`);
      }

      return res;
    } catch (e) {
      lastError = e as Error;
      if (lastError.message === 'AUTH_EXPIRED') throw lastError;
      if (lastError instanceof RateLimitError) throw lastError;
      if ((lastError as DOMException).name === 'AbortError') throw lastError;

      // Network error — retry with backoff (cap 15s)
      if (attempt < MAX_RETRIES) {
        const wait = Math.min(15000, Math.round(Math.pow(1.2, attempt) * 1000 + Math.random() * 1000));
        console.warn(`[SCAN] Network error attempt ${attempt + 1}/${MAX_RETRIES}: ${lastError.message}, retrying in ${wait}ms`);
        await new Promise(r => setTimeout(r, wait));
      }
    }
  }

  throw lastError || new Error(`Spotify call failed after ${MAX_RETRIES} retries`);
}

/**
 * Pre-scan health check. Hits GET /v1/me — the lightest endpoint.
 *
 * IMPORTANT: 200 only proves "not currently jailed." It does NOT mean
 * the scan is safe. Spotify does NOT expose X-RateLimit-Remaining.
 * You could be 1 request from the limit.
 */
export async function checkScanHealth(token: string): Promise<{
  ok: boolean;
  retryAfter?: number;
  message: string;
}> {
  try {
    const res = await fetch(`${API}/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 200) {
      return {
        ok: true,
        message: 'Spotify responding. Rate limits cannot be pre-checked. CSV import is the safe path.',
      };
    }
    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('Retry-After') || '60', 10);
      return {
        ok: false,
        retryAfter,
        message: `Rate limited. Retry after ${retryAfter}s. Use CSV import.`,
      };
    }
    if (res.status === 401 || res.status === 403) {
      clearToken();
      throw new Error('AUTH_EXPIRED');
    }
    return { ok: true, message: 'Spotify status unknown. Proceed with caution.' };
  } catch (e) {
    if ((e as Error).message === 'AUTH_EXPIRED') throw e;
    return { ok: false, message: 'Cannot reach Spotify. Use CSV import.' };
  }
}

// Re-export from scan-utils (canonical source for date logic)
export { computeLastFriday as getLastFriday, computeScanCutoff } from './scan-utils';
import { computeLastFriday, computeScanCutoff } from './scan-utils';

export function getScanCutoff(daysBack = 6): string {
  return computeScanCutoff(computeLastFriday(), daysBack);
}

export async function fetchFollowedArtists(
  token: string,
  onProgress: (current: number, total: number) => void,
  forceRefresh = false,
  signal?: AbortSignal,
): Promise<SpotifyArtist[]> {
  // Check localStorage cache first. TTL is 1 hour, not 7 days — Max's follow
  // list changes weekly (he follows new Nashville artists all the time), and
  // a week-long cache silently masked every new follow from the scan. One hour
  // is long enough to avoid pounding /me/following on repeated scans in the
  // same session, short enough that next-day scans pick up yesterday's
  // follows.
  const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
  if (!forceRefresh) {
    try {
      const cached = localStorage.getItem('nmf_followed_artists');
      if (cached) {
        const { artists, timestamp } = JSON.parse(cached);
        if (artists?.length > 0 && Date.now() - timestamp < CACHE_TTL_MS) {
          onProgress(artists.length, artists.length);
          if (import.meta.env.DEV) console.log(`[SCAN] Loaded ${artists.length} artists from cache (age: ${Math.round((Date.now() - timestamp)/60000)}min)`);
          return artists;
        }
      }
    } catch { /* corrupted cache */ }
  }

  const artists: SpotifyArtist[] = [];
  let after: string | null = null;

  do {
    const url = after
      ? `${API}/me/following?type=artist&limit=50&after=${after}`
      : `${API}/me/following?type=artist&limit=50`;
    const res = await callSpotify(url, token, signal);
    const data = await res.json();
    const items = data.artists.items as SpotifyArtist[];
    artists.push(...items);
    after = data.artists.cursors?.after || null;
    onProgress(artists.length, data.artists.total || artists.length);
  } while (after && !signal?.aborted);

  // Cache for next time
  try {
    localStorage.setItem('nmf_followed_artists', JSON.stringify({ artists, timestamp: Date.now() }));
  } catch { /* storage full */ }

  return artists;
}

export interface ScanResult {
  tracks: TrackItem[];
  failCount: number;
  totalArtists: number;
  rateLimited: boolean;
  retryAfterSeconds: number;
  completedArtists: number;
  aborted: boolean;
}

export type ScanStatus = 'green' | 'yellow' | 'red';

/** Max albums to scan per artist — configurable, default 20 (matching Max's Python config) */
function getMaxAlbumsPerArtist(): number {
  try {
    const stored = localStorage.getItem('nmf_max_albums_per_artist');
    if (stored) return Math.max(1, parseInt(stored, 10));
  } catch {}
  return 20;
}

/**
 * Scan for new releases — SEQUENTIAL, one artist at a time.
 *
 * Matches Python automation behavior:
 * - Process artists ONE AT A TIME in a simple for loop with await
 * - 150ms minimum gap between requests
 * - On 429: STOP immediately, cache partial results (do NOT retry — extends jail)
 * - On 5xx: retry up to 8 times with 1.2^n backoff (transient server errors)
 * - Never break early on old dates — scan up to maxAlbumsPerArtist
 * - Precision-aware date parsing matching Python _parse_release_date()
 * - Track deduplication via seenTrackIds set
 * - Stream results live via onReleasesFound callback
 * - Progress logged every 50 artists
 */
export async function fetchNewReleases(
  artists: SpotifyArtist[],
  token: string,
  cutoffDate: string,
  onProgress: (current: number, total: number, releasesFound: number, status: ScanStatus) => void,
  onReleasesFound?: (tracks: TrackItem[]) => void,
  signal?: AbortSignal,
): Promise<ScanResult> {
  const scanStart = Date.now();
  let apiCalls = 0;
  let failCount = 0;
  let rateLimited = false;
  let retryAfterSeconds = 0;
  const allTracks: TrackItem[] = [];
  const seenAlbumIds = new Set<string>();
  const seenTrackIds = new Set<string>();
  const maxAlbums = getMaxAlbumsPerArtist();

  // Smart ordering: artists with recent scan hits go first
  const recentHits = new Set<string>(
    JSON.parse(localStorage.getItem('nmf_recent_release_artists') || '[]')
  );
  const sorted = [...artists].sort((a, b) => {
    const aHit = recentHits.has(a.id) ? 0 : 1;
    const bHit = recentHits.has(b.id) ? 0 : 1;
    return aHit - bHit;
  });

  if (import.meta.env.DEV) console.log(`[SCAN START] ${sorted.length} artists, cutoff=${cutoffDate}, maxAlbums=${maxAlbums}, mode=SEQUENTIAL`);

  // SEQUENTIAL: one artist at a time, just like the Python script
  for (let i = 0; i < sorted.length; i++) {
    if (signal?.aborted) break;
    const artist = sorted[i];

    try {
      // Fetch this artist's albums — ONE request, await it
      const res = await callSpotify(
        `${API}/artists/${artist.id}/albums?include_groups=album,single&limit=${Math.min(maxAlbums, 50)}&market=US`,
        token,
        signal,
      );
      apiCalls++;
      const data = await res.json();
      const albums = (data.items || []) as (SpotifyAlbum & { release_date_precision?: string })[];

      // Filter to releases within the date window — NO early break on old dates
      const newAlbums: SpotifyAlbum[] = [];
      let albumsScanned = 0;
      for (const album of albums) {
        albumsScanned++;
        if (albumsScanned > maxAlbums) break;
        if (seenAlbumIds.has(album.id)) continue;
        const normalized = parseReleaseDate(album.release_date, album.release_date_precision);
        if (!normalized) continue;
        if (normalized >= cutoffDate) {
          newAlbums.push(album);
          seenAlbumIds.add(album.id);
        }
        // Do NOT break on older dates — Python scans full page
      }

      if (newAlbums.length === 0) {
        onProgress(i + 1, sorted.length, seenAlbumIds.size, 'green');
        if ((i + 1) % 50 === 0) {
          if (import.meta.env.DEV) console.log(`[SCAN] Processed ${i + 1}/${sorted.length} artists, releases=${seenAlbumIds.size}`);
        }
        continue;
      }

      // For each new album, fetch tracks — SEQUENTIALLY
      for (const album of newAlbums) {
        const img640 = album.images.find(im => im.width === 640)?.url || album.images[0]?.url || '';
        const img300 = album.images.find(im => im.width === 300)?.url || album.images[1]?.url || '';
        const img64 = album.images.find(im => im.width === 64)?.url || album.images[2]?.url || '';
        const artistNames = album.artists.map(a => a.name).join(', ');

        if (album.total_tracks === 1) {
          // Single — synthesize track, skip tracks API call
          const synthId = `synth_${album.id}`;
          if (!seenTrackIds.has(synthId)) {
            seenTrackIds.add(synthId);
            allTracks.push({
              track_name: album.name,
              track_number: 1,
              track_uri: '',
              track_spotify_url: album.external_urls.spotify,
              track_id: synthId,
              duration_ms: 0,
              explicit: false,
              album_name: album.name,
              artist_names: artistNames,
              artist_id: artist.id,
              artist_spotify_url: artist.external_urls.spotify,
              artist_genres: artist.genres,
              artist_followers: artist.followers.total,
              album_type: album.album_type,
              release_date: album.release_date,
              total_tracks: 1,
              album_spotify_url: album.external_urls.spotify,
              album_spotify_id: album.id,
              cover_art_640: img640,
              cover_art_300: img300,
              cover_art_64: img64,
            });
          }
        } else {
          // Multi-track — fetch track listing sequentially
          try {
            const trackRes = await callSpotify(
              `${API}/albums/${album.id}/tracks?limit=50&market=US`,
              token,
              signal,
            );
            apiCalls++;
            const trackData = await trackRes.json();
            const tracks = (trackData.items || []) as SpotifyTrack[];

            for (const track of tracks) {
              if (seenTrackIds.has(track.id)) continue;
              seenTrackIds.add(track.id);
              allTracks.push({
                track_name: track.name,
                track_number: track.track_number,
                track_uri: track.uri,
                track_spotify_url: track.external_urls.spotify,
                track_id: track.id,
                duration_ms: track.duration_ms,
                explicit: track.explicit,
                album_name: album.name,
                artist_names: artistNames,
                artist_id: artist.id,
                artist_spotify_url: artist.external_urls.spotify,
                artist_genres: artist.genres,
                artist_followers: artist.followers.total,
                album_type: album.album_type,
                release_date: album.release_date,
                total_tracks: album.total_tracks,
                album_spotify_url: album.external_urls.spotify,
                album_spotify_id: album.id,
                cover_art_640: img640,
                cover_art_300: img300,
                cover_art_64: img64,
              });
            }
          } catch (e) {
            if (e instanceof RateLimitError) throw e;
            if ((e as Error).message === 'AUTH_EXPIRED') throw e;
            // Skip this album's tracks on network/server error
          }
        }

        // Stream results live to UI
        if (onReleasesFound) onReleasesFound([...allTracks]);
      }

      onProgress(i + 1, sorted.length, seenAlbumIds.size, 'green');
      if ((i + 1) % 50 === 0) {
        if (import.meta.env.DEV) console.log(`[SCAN] Processed ${i + 1}/${sorted.length} artists, releases=${seenAlbumIds.size}`);
      }
    } catch (e) {
      if (e instanceof RateLimitError) {
        rateLimited = true;
        retryAfterSeconds = e.retryAfterSeconds;
        onProgress(i + 1, sorted.length, seenAlbumIds.size, 'red');
        console.error(
          `[SCAN STOPPED] 429 at artist ${i + 1}/${sorted.length}. ` +
          `Retry-After: ${retryAfterSeconds}s. ` +
          `${apiCalls} API calls in ${((Date.now() - scanStart) / 1000).toFixed(1)}s. ` +
          `Showing ${allTracks.length} tracks found so far.`
        );
        break;
      }
      if ((e as Error).message === 'AUTH_EXPIRED') throw e;
      failCount++;
      onProgress(i + 1, sorted.length, seenAlbumIds.size, 'green');
    }
  }

  // Backfill single track URIs (only if not rate limited)
  const synthTracks = allTracks.filter(t => t.track_id.startsWith('synth_'));
  if (synthTracks.length > 0 && !rateLimited) {
    for (const t of synthTracks) {
      try {
        const res = await callSpotify(
          `${API}/albums/${t.album_spotify_id}/tracks?limit=1&market=US`,
          token,
          signal,
        );
        apiCalls++;
        const data = await res.json();
        const real = data.items?.[0] as SpotifyTrack | undefined;
        if (real) {
          t.track_id = real.id;
          t.track_uri = real.uri;
          t.track_name = real.name;
          t.track_spotify_url = real.external_urls.spotify;
          t.duration_ms = real.duration_ms;
          t.explicit = real.explicit;
        }
      } catch (e) {
        if (e instanceof RateLimitError) break;
      }
    }
  }

  // Sort results
  allTracks.sort((a, b) => {
    const dateComp = b.release_date.localeCompare(a.release_date);
    if (dateComp !== 0) return dateComp;
    return a.artist_names.localeCompare(b.artist_names);
  });

  // Save artists with releases for smart ordering next time
  const releaseArtistIds = [...new Set(allTracks.map(t => t.artist_id))];
  try {
    localStorage.setItem('nmf_recent_release_artists', JSON.stringify(releaseArtistIds));
  } catch { /* storage full */ }

  const elapsed = (Date.now() - scanStart) / 1000;
  if (import.meta.env.DEV) console.log(
    `[SCAN COMPLETE] ${apiCalls} API calls in ${elapsed.toFixed(1)}s ` +
    `(${(apiCalls / elapsed).toFixed(1)} req/s). ` +
    `Albums: ${seenAlbumIds.size}, Tracks: ${allTracks.length}, ` +
    `Fails: ${failCount}, RateLimited: ${rateLimited}`
  );

  // Final stream of sorted results
  if (onReleasesFound && allTracks.length > 0) {
    onReleasesFound(allTracks);
  }

  const aborted = signal?.aborted ?? false;
  return {
    tracks: allTracks,
    failCount,
    totalArtists: artists.length,
    rateLimited,
    retryAfterSeconds,
    aborted,
    completedArtists: rateLimited || aborted
      ? sorted.findIndex(a => allTracks.some(t => t.artist_id === a.id)) + 1
      : sorted.length,
  };
}

export async function replacePlaylistTracks(
  token: string,
  playlistId: string,
  uris: string[],
): Promise<void> {
  // Clear playlist
  await callSpotify(
    `${API}/playlists/${playlistId}/items`,
    token,
  ).then(() => {}); // just to check auth

  const clearRes = await fetch(`${API}/playlists/${playlistId}/items`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ uris: [] }),
  });
  if (clearRes.status === 401) { clearToken(); throw new Error('AUTH_EXPIRED'); }
  if (!clearRes.ok) throw new Error(`Failed to clear playlist: ${clearRes.status}`);

  // Add in chunks of 100
  for (let i = 0; i < uris.length; i += 100) {
    const chunk = uris.slice(i, i + 100);
    const res = await fetch(`${API}/playlists/${playlistId}/items`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ uris: chunk }),
    });
    if (res.status === 401) { clearToken(); throw new Error('AUTH_EXPIRED'); }
    if (!res.ok) throw new Error(`Failed to add tracks: ${res.status}`);
  }
}

export async function appendPlaylistTracks(
  token: string,
  playlistId: string,
  uris: string[],
): Promise<void> {
  for (let i = 0; i < uris.length; i += 100) {
    const chunk = uris.slice(i, i + 100);
    const res = await fetch(`${API}/playlists/${playlistId}/items`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ uris: chunk }),
    });
    if (res.status === 401) { clearToken(); throw new Error('AUTH_EXPIRED'); }
    if (!res.ok) throw new Error(`Failed to add tracks: ${res.status}`);
  }
}

export async function getPlaylistName(token: string, playlistId: string): Promise<string> {
  const res = await callSpotify(`${API}/playlists/${playlistId}?fields=name`, token);
  const data = await res.json();
  return data.name;
}

export async function getCurrentUserId(token: string): Promise<string> {
  const res = await callSpotify(`${API}/me`, token);
  const data = await res.json();
  return data.id;
}

export async function createPlaylist(
  token: string,
  name: string,
  isPublic: boolean,
  uris: string[],
): Promise<{ id: string; url: string }> {
  const userId = await getCurrentUserId(token);

  const createRes = await fetch(`${API}/users/${userId}/playlists`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      public: isPublic,
      description: 'Curated by Max Meets Music City',
    }),
  });
  if (createRes.status === 401) { clearToken(); throw new Error('AUTH_EXPIRED'); }
  if (!createRes.ok) throw new Error(`Failed to create playlist: ${createRes.status}`);

  const playlist = await createRes.json();
  const playlistId = playlist.id;
  const playlistUrl = playlist.external_urls.spotify;

  // Add tracks
  for (let i = 0; i < uris.length; i += 100) {
    const chunk = uris.slice(i, i + 100);
    const res = await fetch(`${API}/playlists/${playlistId}/items`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ uris: chunk }),
    });
    if (res.status === 401) { clearToken(); throw new Error('AUTH_EXPIRED'); }
    if (!res.ok) throw new Error(`Failed to add tracks to new playlist: ${res.status}`);
  }

  return { id: playlistId, url: playlistUrl };
}
