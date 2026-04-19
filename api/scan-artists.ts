import type { VercelRequest, VercelResponse } from '@vercel/node';
import { bulkLookupCache, saveCacheResult, fetchWith429Retry, RateBudget, normalizeTrackName } from './_platform_cache.js';

const SPOTIFY_API = 'https://api.spotify.com/v1';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';

let cachedToken: { token: string; expiresAt: number } | null = null;

/** Get a Spotify access token via Client Credentials flow (server-side only) */
async function getClientToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Spotify credentials not configured');

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token fetch failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000, // 1 min buffer
  };
  return data.access_token;
}

/** Search Spotify for an artist by name, return best match */
async function findArtist(token: string, name: string): Promise<{ id: string; name: string } | null> {
  const res = await fetch(
    `${SPOTIFY_API}/search?q=${encodeURIComponent(name)}&type=artist&limit=5&market=US`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) return null;
  const data = await res.json();
  const items = data.artists?.items;
  if (!items?.length) return null;

  // STRICT: require exact case-insensitive name match. Falling back to the
  // first result silently polluted Nashville data (e.g. "ANNALEA" fuzzy-matched
  // to "Alea Aquarius" on the Apple side). A missed match beats a wrong match.
  const lower = name.toLowerCase();
  const exact = items.find((a: { name: string }) => (a.name || '').toLowerCase() === lower);
  if (!exact) return null;
  return { id: exact.id, name: exact.name };
}

interface SpotifyAlbum {
  id: string;
  name: string;
  album_type: string;
  release_date: string;
  release_date_precision: string;
  total_tracks: number;
  external_urls: { spotify: string };
  images: { url: string; width: number; height: number }[];
  artists: { id: string; name: string; external_urls: { spotify: string } }[];
}

interface SpotifyTrack {
  id: string;
  name: string;
  track_number: number;
  duration_ms: number;
  explicit: boolean;
  uri: string;
  external_urls: { spotify: string };
}

interface TrackResult {
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
  album_spotify_url: string;
  album_spotify_id: string;
  release_date: string;
  total_tracks: number;
  cover_art_640: string;
  cover_art_300: string;
  cover_art_64: string;
}

function parseDate(d: string, precision: string): string | null {
  if (!d) return null;
  if (precision === 'day') return d;
  if (precision === 'month') return `${d}-01`;
  if (precision === 'year') return `${d}-01-01`;
  if (d.length === 10) return d;
  if (d.length === 7) return `${d}-01`;
  if (d.length === 4) return `${d}-01-01`;
  return null;
}

function getLastFriday(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = day >= 5 ? day - 5 : day + 2;
  const friday = new Date(now);
  friday.setDate(now.getDate() - diff);
  return friday.toISOString().split('T')[0];
}

import { getClientIp, isRateLimited } from './_rateLimit.js';

const SCAN_SECRET = process.env.SCAN_SECRET || '';

const ALLOWED_ORIGINS = new Set([
  'https://maxmeetsmusiccity.com',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5199',
]);

function isAllowedOrigin(req: VercelRequest): boolean {
  const origin = req.headers.origin || '';
  if (origin && ALLOWED_ORIGINS.has(origin)) return true;
  const referer = req.headers.referer || '';
  if (referer) {
    try { if (ALLOWED_ORIGINS.has(new URL(referer).origin)) return true; } catch {}
  }
  return false;
}

function isScanSecretAuth(req: VercelRequest): boolean {
  const auth = req.headers.authorization;
  return !!SCAN_SECRET && auth === `Bearer ${SCAN_SECRET}`;
}

function isAuthorized(req: VercelRequest): boolean {
  // Accept SCAN_SECRET for cron/internal calls
  if (isScanSecretAuth(req)) return true;
  // Accept valid Supabase JWT for authenticated frontend users
  const supabaseToken = req.headers['x-supabase-auth'];
  if (typeof supabaseToken === 'string' && supabaseToken.length > 20) return true;
  // Accept same-origin requests (exact-match allowlist)
  if (isAllowedOrigin(req)) return true;
  return false;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Trusted server-to-server calls (SCAN_SECRET) bypass the per-IP rate limit,
  // which exists only to protect against external abuse.
  if (!isScanSecretAuth(req) && await isRateLimited(getClientIp(req), 5, 60_000)) {
    return res.status(429).json({ error: 'Rate limit exceeded. Try again in a minute.' });
  }

  const { artistNames, daysBack: rawDaysBack = 6, targetFriday: rawTargetFriday } = req.body as { artistNames: string[]; daysBack?: number; targetFriday?: string };
  const daysBack = Math.min(Math.max(1, Number(rawDaysBack) || 6), 30);
  if (!Array.isArray(artistNames) || artistNames.length === 0) {
    return res.status(400).json({ error: 'artistNames array required' });
  }
  if (artistNames.length > 1000) {
    return res.status(400).json({ error: 'Max 1000 artists per request' });
  }

  try {
    const token = await getClientToken();
    const friday = rawTargetFriday && /^\d{4}-\d{2}-\d{2}$/.test(rawTargetFriday) ? rawTargetFriday : getLastFriday();
    const cutoff = new Date(friday + 'T12:00:00');
    cutoff.setDate(cutoff.getDate() - daysBack);
    const cutoffStr = cutoff.toISOString().split('T')[0];

    const allTracks: TrackResult[] = [];
    const seenTrackIds = new Set<string>();
    const seenTrackNameKeys = new Set<string>();  // M-Z11: (artist_id, normalizedName) dedup
    let scannedCount = 0;

    // Single shared retry-sleep budget across the entire handler. Vercel's
    // 300s function timeout means per-call 60s sleeps can cascade into a
    // timeout on a rate-limit storm. 30s total keeps us responsive.
    const budget = new RateBudget(30_000);

    // Bulk-lookup the platform-ID cache up front so the main loop can skip
    // the Spotify search step whenever we've already resolved an artist's ID.
    const cacheMap = await bulkLookupCache(artistNames);

    for (const name of artistNames) {
      const trimmed = name.trim();
      if (!trimmed) continue;

      // Try cache first. Cache hit → skip search, go directly to /albums.
      // Cache miss → run findArtist (existing path) and persist the result
      // (hit or miss) so the next scan is cheaper.
      const cached = cacheMap.get(trimmed.toLowerCase());
      let artist: { id: string; name: string } | null = null;
      if (cached?.spotify_artist_id) {
        artist = { id: cached.spotify_artist_id, name: cached.spotify_display_name || trimmed };
      } else {
        // Skip re-searching artists that have repeatedly not been found on Spotify
        // (saves budget for the real universe). 3 strikes = stop searching.
        if (cached && cached.spotify_not_found_count >= 3) { scannedCount++; continue; }
        artist = await findArtist(token, trimmed);
        // Write-through: record the lookup result (hit OR miss)
        saveCacheResult({
          platform: 'spotify',
          artistName: trimmed,
          id: artist?.id ?? null,
          displayName: artist?.name ?? null,
          error: artist ? undefined : 'not_found',
        }).catch(() => {});
      }
      if (!artist) { scannedCount++; continue; }

      // Fetch recent albums. 429s retry with shared budget so we can't timeout.
      const albumRes = await fetchWith429Retry(
        `${SPOTIFY_API}/artists/${artist.id}/albums?include_groups=album,single&market=US&limit=20`,
        { headers: { Authorization: `Bearer ${token}` } },
        budget,
      );
      if (!albumRes.ok) { scannedCount++; continue; }
      const albumData = await albumRes.json();
      const albums = (albumData.items || []) as SpotifyAlbum[];

      for (const alb of albums) {
        const releaseDate = parseDate(alb.release_date, alb.release_date_precision);
        if (!releaseDate) continue;
        if (releaseDate < cutoffStr || releaseDate > friday) continue;

        const images = alb.images || [];
        const cover640 = images.find((i: { width: number }) => i.width === 640)?.url || images[0]?.url || '';
        const cover300 = images.find((i: { width: number }) => i.width === 300)?.url || cover640;
        const cover64 = images.find((i: { width: number }) => i.width === 64)?.url || '';
        const artistName = alb.artists.map(a => a.name).join(', ');

        // Fetch tracks for this album
        const trackRes = await fetch(
          `${SPOTIFY_API}/albums/${alb.id}/tracks?limit=50&market=US`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!trackRes.ok) continue;
        const trackData = await trackRes.json();

        for (const t of (trackData.items || []) as SpotifyTrack[]) {
          if (seenTrackIds.has(t.id)) continue;
          seenTrackIds.add(t.id);
          const nameKey = `${artist.id}:${normalizeTrackName(t.name)}`;
          if (seenTrackNameKeys.has(nameKey)) continue;
          seenTrackNameKeys.add(nameKey);

          allTracks.push({
            track_name: t.name,
            track_number: t.track_number,
            track_uri: t.uri,
            track_spotify_url: t.external_urls.spotify,
            track_id: t.id,
            duration_ms: t.duration_ms,
            explicit: t.explicit,
            album_name: alb.name,
            artist_names: artistName,
            artist_id: artist.id,
            artist_spotify_url: '',
            artist_genres: [],
            artist_followers: 0,
            album_type: alb.album_type,
            album_spotify_url: alb.external_urls.spotify,
            album_spotify_id: alb.id,
            release_date: releaseDate,
            total_tracks: alb.total_tracks,
            cover_art_640: cover640,
            cover_art_300: cover300,
            cover_art_64: cover64,
          });
        }
      }

      scannedCount++;

      // 100ms gap between artists to stay well under rate limits
      await new Promise(r => setTimeout(r, 100));
    }

    // Sort by release date desc, then artist
    allTracks.sort((a, b) => {
      const d = b.release_date.localeCompare(a.release_date);
      return d !== 0 ? d : a.artist_names.localeCompare(b.artist_names);
    });

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
    return res.status(200).json({
      tracks: allTracks,
      scannedArtists: scannedCount,
      totalArtists: artistNames.length,
      weekDate: friday,
    });
  } catch (e) {
    console.error('scan-artists error:', e);
    console.error('[scan-artists] Error:', e);
    return res.status(500).json({ error: 'Scan failed' });
  }
}
