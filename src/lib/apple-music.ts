import { supabase } from './supabase';

let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getDeveloperToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  // Get current Supabase session for auth
  const headers: Record<string, string> = {};
  if (supabase) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
  }

  const res = await fetch('/api/apple-token', { headers });
  if (!res.ok) throw new Error(`Apple token fetch failed: ${res.status}`);
  const data = await res.json();
  cachedToken = {
    token: data.token,
    expiresAt: Date.now() + (data.expires_in - 300) * 1000, // 5 min buffer
  };
  return data.token;
}

const AM_API = 'https://api.music.apple.com/v1';

interface AppleMusicTrack {
  id: string;
  attributes: {
    name: string;
    artistName: string;
    albumName: string;
    isrc?: string;
    url: string;
    durationInMillis: number;
    artwork?: { url: string; width: number; height: number };
  };
}

/** Search Apple Music catalog by ISRC to find matching track */
export async function findByISRC(isrc: string): Promise<string | null> {
  if (!isrc) return null;
  try {
    const token = await getDeveloperToken();
    const res = await fetch(
      `${AM_API}/catalog/us/songs?filter[isrc]=${encodeURIComponent(isrc)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const track = data.data?.[0] as AppleMusicTrack | undefined;
    return track?.attributes?.url || null;
  } catch {
    return null;
  }
}

/** Search Apple Music catalog by artist name + track name */
export async function searchTrack(artistName: string, trackName: string): Promise<string | null> {
  try {
    const token = await getDeveloperToken();
    const query = `${trackName} ${artistName}`;
    const res = await fetch(
      `${AM_API}/catalog/us/search?types=songs&term=${encodeURIComponent(query)}&limit=5`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const results = data.results?.songs?.data as AppleMusicTrack[] | undefined;
    if (!results?.length) return null;

    // Try to find exact match
    const exactMatch = results.find(t =>
      t.attributes.name.toLowerCase() === trackName.toLowerCase() &&
      t.attributes.artistName.toLowerCase().includes((artistName || '').split(',')[0].toLowerCase())
    );
    return (exactMatch || results[0]).attributes.url;
  } catch {
    return null;
  }
}

/** Batch resolve Apple Music URLs for tracks. Uses ISRC when available, falls back to search. */
export async function batchResolveAppleMusic(
  tracks: Array<{ track_name: string; artist_names: string; isrc?: string }>,
  onProgress?: (current: number, total: number) => void,
): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  const BATCH = 5;

  for (let i = 0; i < tracks.length; i += BATCH) {
    const batch = tracks.slice(i, i + BATCH);
    const promises = batch.map(async (t) => {
      const key = `${t.artist_names}::${t.track_name}`;
      // Try ISRC first
      if (t.isrc) {
        const url = await findByISRC(t.isrc);
        if (url) { results.set(key, url); return; }
      }
      // Fall back to search
      const url = await searchTrack((t.artist_names || '').split(',')[0].trim(), t.track_name);
      if (url) results.set(key, url);
    });
    await Promise.all(promises);
    onProgress?.(Math.min(i + BATCH, tracks.length), tracks.length);
    if (i + BATCH < tracks.length) await new Promise(r => setTimeout(r, 200));
  }

  return results;
}
