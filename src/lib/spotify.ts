import { clearToken } from './auth';

const API = 'https://api.spotify.com/v1';
const BATCH_SIZE = 8;
const BATCH_DELAY = 150;
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
  const day = now.getDay(); // 0=Sun, 5=Fri
  const diff = day >= 5 ? day - 5 : day + 2;
  const friday = new Date(now);
  friday.setDate(now.getDate() - diff);
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

export async function fetchNewReleases(
  artists: SpotifyArtist[],
  token: string,
  cutoffDate: string,
  onProgress: (current: number, total: number) => void,
): Promise<TrackItem[]> {
  const albumMap = new Map<string, { album: SpotifyAlbum; triggerArtist: SpotifyArtist }>();

  // Batch artist album fetches
  for (let i = 0; i < artists.length; i += BATCH_SIZE) {
    const batch = artists.slice(i, i + BATCH_SIZE);
    const promises = batch.map(async (artist) => {
      try {
        const res = await apiFetch(
          `${API}/artists/${artist.id}/albums?include_groups=album,single&limit=10&market=US`,
          token,
        );
        const data = await res.json();
        for (const album of data.items as SpotifyAlbum[]) {
          if (album.release_date >= cutoffDate && !albumMap.has(album.id)) {
            albumMap.set(album.id, { album, triggerArtist: artist });
          }
        }
      } catch (e) {
        if ((e as Error).message === 'AUTH_EXPIRED') throw e;
        // Skip individual artist failures
      }
    });
    await Promise.all(promises);
    onProgress(Math.min(i + BATCH_SIZE, artists.length), artists.length);
    if (i + BATCH_SIZE < artists.length) await sleep(BATCH_DELAY);
  }

  // Now fetch tracks for each album
  const albums = Array.from(albumMap.values());
  const allTracks: TrackItem[] = [];

  for (let i = 0; i < albums.length; i += BATCH_SIZE) {
    const batch = albums.slice(i, i + BATCH_SIZE);
    const promises = batch.map(async ({ album, triggerArtist }) => {
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
    await Promise.all(promises);
    if (i + BATCH_SIZE < albums.length) await sleep(BATCH_DELAY);
  }

  // Sort by release date descending, then artist name
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
