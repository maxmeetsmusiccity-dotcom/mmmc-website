import { clearToken } from './auth';

const API = 'https://api.spotify.com/v1';
const MAX_CONCURRENT = 50;
const MAX_RETRIES = 3;

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

async function apiFetch(url: string, token: string, retries = 0): Promise<Response> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 401) {
    clearToken();
    throw new Error('AUTH_EXPIRED');
  }

  if (res.status === 429 && retries < MAX_RETRIES) {
    const retryAfter = parseInt(res.headers.get('Retry-After') || '1', 10);
    await sleep((retryAfter + 1) * 1000);
    return apiFetch(url, token, retries + 1);
  }

  if (!res.ok) {
    throw new Error(`Spotify API error: ${res.status}`);
  }

  return res;
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

export function getLastFriday(): string {
  const now = new Date();
  const day = now.getDay(); // 0=Sun ... 5=Fri 6=Sat
  // Days since the most recent Friday that is strictly before today
  // If today IS Friday, we still want the PREVIOUS Friday (7 days ago)
  // so we always go back at least 1 day
  const daysSinceFriday = ((day - 5) + 7) % 7 || 7;
  const friday = new Date(now);
  friday.setDate(now.getDate() - daysSinceFriday);
  friday.setHours(0, 0, 0, 0);
  return friday.toISOString().split('T')[0];
}

export async function fetchFollowedArtists(
  token: string,
  onProgress: (current: number, total: number) => void,
): Promise<SpotifyArtist[]> {
  const artists: SpotifyArtist[] = [];
  let after: string | null = null;

  // First fetch to get a sense of total
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

  return artists;
}

/** Concurrent pool — runs up to `limit` promises at once, no artificial delays */
async function pool<T>(tasks: (() => Promise<T>)[], limit: number, onDone?: () => void): Promise<T[]> {
  const results: T[] = [];
  let idx = 0;
  async function next(): Promise<void> {
    while (idx < tasks.length) {
      const i = idx++;
      results[i] = await tasks[i]();
      onDone?.();
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, () => next()));
  return results;
}

export async function fetchNewReleases(
  artists: SpotifyArtist[],
  token: string,
  cutoffDate: string,
  onProgress: (current: number, total: number) => void,
): Promise<TrackItem[]> {
  const albumMap = new Map<string, { album: SpotifyAlbum; triggerArtist: SpotifyArtist }>();
  let done = 0;

  // Phase 1: fetch albums — all artists in concurrent pool, early exit on old releases
  const albumTasks = artists.map((artist) => async () => {
    try {
      const res = await apiFetch(
        `${API}/artists/${artist.id}/albums?include_groups=album,single&limit=10&market=US`,
        token,
      );
      const data = await res.json();
      for (const album of data.items as SpotifyAlbum[]) {
        // Results are sorted by release_date desc — early exit once past cutoff
        if (album.release_date < cutoffDate) break;
        if (!albumMap.has(album.id)) {
          albumMap.set(album.id, { album, triggerArtist: artist });
        }
      }
    } catch (e) {
      if ((e as Error).message === 'AUTH_EXPIRED') throw e;
    }
  });

  await pool(albumTasks, MAX_CONCURRENT, () => {
    done++;
    onProgress(done, artists.length);
  });

  // Phase 2: fetch tracks — only for multi-track releases
  // Singles already have all data from the album endpoint
  const albums = Array.from(albumMap.values());
  const allTracks: TrackItem[] = [];

  // For singles, build TrackItem directly from album data (no extra API call)
  const multiTrackAlbums: typeof albums = [];
  for (const { album, triggerArtist } of albums) {
    const img640 = album.images.find(i => i.width === 640)?.url || album.images[0]?.url || '';
    const img300 = album.images.find(i => i.width === 300)?.url || album.images[1]?.url || '';
    const img64 = album.images.find(i => i.width === 64)?.url || album.images[2]?.url || '';
    const artistNames = album.artists.map(a => a.name).join(', ');

    if (album.total_tracks === 1) {
      // Single — synthesize track from album data, skip tracks API call
      allTracks.push({
        track_name: album.name,
        track_number: 1,
        track_uri: '', // will be filled if user selects it
        track_spotify_url: album.external_urls.spotify,
        track_id: `synth_${album.id}`,
        duration_ms: 0,
        explicit: false,
        album_name: album.name,
        artist_names: artistNames,
        artist_id: triggerArtist.id,
        artist_spotify_url: triggerArtist.external_urls.spotify,
        artist_genres: triggerArtist.genres,
        artist_followers: triggerArtist.followers.total,
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
      multiTrackAlbums.push({ album, triggerArtist });
    }
  }

  // Fetch tracks only for multi-track releases
  const trackTasks = multiTrackAlbums.map(({ album, triggerArtist }) => async () => {
    try {
      const res = await apiFetch(
        `${API}/albums/${album.id}/tracks?limit=50&market=US`,
        token,
      );
      const data = await res.json();
      const tracks = data.items as SpotifyTrack[];
      const img640 = album.images.find(i => i.width === 640)?.url || album.images[0]?.url || '';
      const img300 = album.images.find(i => i.width === 300)?.url || album.images[1]?.url || '';
      const img64 = album.images.find(i => i.width === 64)?.url || album.images[2]?.url || '';
      const artistNames = album.artists.map(a => a.name).join(', ');

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
          artist_id: triggerArtist.id,
          artist_spotify_url: triggerArtist.external_urls.spotify,
          artist_genres: triggerArtist.genres,
          artist_followers: triggerArtist.followers.total,
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
      if ((e as Error).message === 'AUTH_EXPIRED') throw e;
    }
  });

  if (trackTasks.length > 0) {
    await pool(trackTasks, MAX_CONCURRENT);
  }

  // Now backfill single track URIs — fetch just the ones we need
  const synthTracks = allTracks.filter(t => t.track_id.startsWith('synth_'));
  if (synthTracks.length > 0) {
    const backfillTasks = synthTracks.map((t) => async () => {
      try {
        const res = await apiFetch(`${API}/albums/${t.album_spotify_id}/tracks?limit=1&market=US`, token);
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
      } catch { /* non-critical */ }
    });
    await pool(backfillTasks, MAX_CONCURRENT);
  }

  allTracks.sort((a, b) => {
    const dateComp = b.release_date.localeCompare(a.release_date);
    if (dateComp !== 0) return dateComp;
    return a.artist_names.localeCompare(b.artist_names);
  });

  return allTracks;
}

export async function replacePlaylistTracks(
  token: string,
  playlistId: string,
  uris: string[],
): Promise<void> {
  // Clear playlist
  await apiFetch(
    `${API}/playlists/${playlistId}/tracks`,
    token,
  ).then(() => {}); // just to check auth

  const clearRes = await fetch(`${API}/playlists/${playlistId}/tracks`, {
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
    const res = await fetch(`${API}/playlists/${playlistId}/tracks`, {
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
    const res = await fetch(`${API}/playlists/${playlistId}/tracks`, {
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
    const res = await fetch(`${API}/playlists/${playlistId}/tracks`, {
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
