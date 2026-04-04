import { clearToken } from './auth';

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

async function apiFetch(url: string, token: string): Promise<Response> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 401) {
    clearToken();
    throw new Error('AUTH_EXPIRED');
  }

  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get('Retry-After') || '60', 10);
    console.error(`[429] Rate limited. Retry-After: ${retryAfter}s`);
    throw new RateLimitError(retryAfter);
  }

  if (!res.ok) {
    throw new Error(`Spotify API error: ${res.status}`);
  }

  return res;
}

export class RateLimitError extends Error {
  retryAfterSeconds: number;
  constructor(retryAfter: number) {
    super('RATE_LIMITED');
    this.retryAfterSeconds = retryAfter;
  }
}

export function getLastFriday(): string {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 5=Fri
  // Most recent Friday INCLUDING today if today is Friday
  // Music drops Thursday night with Friday's release_date
  const diff = day >= 5 ? day - 5 : day + 2;
  const friday = new Date(now);
  friday.setDate(now.getDate() - diff);
  friday.setHours(0, 0, 0, 0);
  return friday.toISOString().split('T')[0];
}

export async function fetchFollowedArtists(
  token: string,
  onProgress: (current: number, total: number) => void,
  forceRefresh = false,
): Promise<SpotifyArtist[]> {
  // Check localStorage cache first
  if (!forceRefresh) {
    try {
      const cached = localStorage.getItem('nmf_followed_artists');
      if (cached) {
        const { artists, timestamp } = JSON.parse(cached);
        if (artists?.length > 0 && Date.now() - timestamp < 7 * 24 * 60 * 60 * 1000) {
          onProgress(artists.length, artists.length);
          console.log(`[SCAN] Loaded ${artists.length} artists from cache`);
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
    const res = await apiFetch(url, token);
    const data = await res.json();
    const items = data.artists.items as SpotifyArtist[];
    artists.push(...items);
    after = data.artists.cursors?.after || null;
    onProgress(artists.length, data.artists.total || artists.length);
  } while (after);

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
}

export type ScanStatus = 'green' | 'yellow' | 'red';

/**
 * Scan for new releases — SEQUENTIAL, one artist at a time.
 *
 * Replicates the Python script (new_music_art.py) behavior exactly:
 * - Process artists ONE AT A TIME in a simple for loop with await
 * - Natural HTTP latency (~100-200ms) provides pacing at ~5-7 req/s
 * - This is well within Spotify's rolling 30s window (~180 req/30s)
 * - No concurrency pool, no batching, no explicit delays
 * - Abort on first 429, cache partial results
 * - Stream results live via onReleasesFound callback
 */
export async function fetchNewReleases(
  artists: SpotifyArtist[],
  token: string,
  cutoffDate: string,
  onProgress: (current: number, total: number, releasesFound: number, status: ScanStatus) => void,
  onReleasesFound?: (tracks: TrackItem[]) => void,
): Promise<ScanResult> {
  const scanStart = Date.now();
  let apiCalls = 0;
  let failCount = 0;
  let rateLimited = false;
  let retryAfterSeconds = 0;
  const allTracks: TrackItem[] = [];
  const seenAlbumIds = new Set<string>();

  // Smart ordering: artists with recent scan hits go first
  const recentHits = new Set<string>(
    JSON.parse(localStorage.getItem('nmf_recent_release_artists') || '[]')
  );
  const sorted = [...artists].sort((a, b) => {
    const aHit = recentHits.has(a.id) ? 0 : 1;
    const bHit = recentHits.has(b.id) ? 0 : 1;
    return aHit - bHit;
  });

  console.log(`[SCAN START] ${sorted.length} artists, cutoff=${cutoffDate}, mode=SEQUENTIAL`);

  // SEQUENTIAL: one artist at a time, just like the Python script
  for (let i = 0; i < sorted.length; i++) {
    const artist = sorted[i];

    try {
      // Fetch this artist's albums — ONE request, await it
      const res = await apiFetch(
        `${API}/artists/${artist.id}/albums?include_groups=album,single&limit=20&market=US`,
        token,
      );
      apiCalls++;
      const data = await res.json();
      const albums = (data.items || []) as (SpotifyAlbum & { release_date_precision?: string })[];

      // Filter to releases within the date window
      const newAlbums: SpotifyAlbum[] = [];
      for (const album of albums) {
        if (seenAlbumIds.has(album.id)) continue;
        let normalized = album.release_date;
        if (normalized.length === 4) normalized += '-01-01';
        else if (normalized.length === 7) normalized += '-01';
        if (normalized >= cutoffDate) {
          newAlbums.push(album);
          seenAlbumIds.add(album.id);
        }
      }

      if (newAlbums.length === 0) {
        onProgress(i + 1, sorted.length, seenAlbumIds.size, 'green');
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
          allTracks.push({
            track_name: album.name,
            track_number: 1,
            track_uri: '',
            track_spotify_url: album.external_urls.spotify,
            track_id: `synth_${album.id}`,
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
        } else {
          // Multi-track — fetch track listing sequentially
          try {
            const trackRes = await apiFetch(
              `${API}/albums/${album.id}/tracks?limit=50&market=US`,
              token,
            );
            apiCalls++;
            const trackData = await trackRes.json();
            const tracks = (trackData.items || []) as SpotifyTrack[];

            for (const track of tracks) {
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
            // Skip this album's tracks on network error
          }
        }

        // Stream results live to UI as each album is processed
        if (onReleasesFound) onReleasesFound([...allTracks]);
      }

      onProgress(i + 1, sorted.length, seenAlbumIds.size, 'green');
    } catch (e) {
      if (e instanceof RateLimitError) {
        rateLimited = true;
        retryAfterSeconds = e.retryAfterSeconds;
        onProgress(i + 1, sorted.length, seenAlbumIds.size, 'red');
        console.error(
          `[SCAN ABORTED] 429 at artist ${i + 1}/${sorted.length}. ` +
          `Retry-After: ${retryAfterSeconds}s. ` +
          `${apiCalls} API calls in ${((Date.now() - scanStart) / 1000).toFixed(1)}s`
        );
        break;
      }
      if ((e as Error).message === 'AUTH_EXPIRED') throw e;
      // Skip individual artist failures
      failCount++;
      onProgress(i + 1, sorted.length, seenAlbumIds.size, 'green');
    }
  }

  // Backfill single track URIs for synthesized entries
  const synthTracks = allTracks.filter(t => t.track_id.startsWith('synth_'));
  if (synthTracks.length > 0 && !rateLimited) {
    for (const t of synthTracks) {
      try {
        const res = await apiFetch(
          `${API}/albums/${t.album_spotify_id}/tracks?limit=1&market=US`,
          token,
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
        if (e instanceof RateLimitError) break; // stop backfill on rate limit
        // Non-critical — skip
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
  console.log(
    `[SCAN COMPLETE] ${apiCalls} API calls in ${elapsed.toFixed(1)}s ` +
    `(${(apiCalls / elapsed).toFixed(1)} req/s). ` +
    `Albums: ${seenAlbumIds.size}, Tracks: ${allTracks.length}, ` +
    `Fails: ${failCount}, RateLimited: ${rateLimited}`
  );

  // Final stream of sorted results
  if (onReleasesFound && allTracks.length > 0) {
    onReleasesFound(allTracks);
  }

  return {
    tracks: allTracks,
    failCount,
    totalArtists: artists.length,
    rateLimited,
    retryAfterSeconds,
    completedArtists: rateLimited
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
  await apiFetch(
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
  const res = await apiFetch(`${API}/playlists/${playlistId}?fields=name`, token);
  const data = await res.json();
  return data.name;
}

export async function getCurrentUserId(token: string): Promise<string> {
  const res = await apiFetch(`${API}/me`, token);
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
