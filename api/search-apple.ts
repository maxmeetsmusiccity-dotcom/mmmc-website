import type { VercelRequest, VercelResponse } from '@vercel/node';
import { SignJWT, importPKCS8 } from 'jose';

const TEAM_ID = process.env.APPLE_MUSIC_TEAM_ID || '';
const KEY_ID = process.env.APPLE_MUSIC_KEY_ID || process.env.APPLE_MUSIC_SEARCH_KEY_ID || '';
const APPLE_API = 'https://api.music.apple.com/v1/catalog/us';

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAppleToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.token;

  if (!TEAM_ID || !KEY_ID) throw new Error('APPLE_MUSIC_TEAM_ID or APPLE_MUSIC_KEY_ID not configured');
  const privateKeyPem = process.env.APPLE_MUSIC_PRIVATE_KEY;
  if (!privateKeyPem) throw new Error('APPLE_MUSIC_PRIVATE_KEY not configured');

  const privateKey = await importPKCS8(privateKeyPem, 'ES256');
  const now = Math.floor(Date.now() / 1000);
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: KEY_ID })
    .setIssuer(TEAM_ID)
    .setIssuedAt(now)
    .setExpirationTime(now + 43200) // 12 hours
    .sign(privateKey);

  cachedToken = { token, expiresAt: Date.now() + 39600000 }; // 11 hours
  return token;
}

function getLastFriday(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = day >= 5 ? day - 5 : day + 2;
  const friday = new Date(now);
  friday.setDate(now.getDate() - diff);
  return friday.toISOString().split('T')[0];
}

interface AppleAlbum {
  id: string;
  attributes: {
    name: string;
    artistName: string;
    releaseDate: string;
    trackCount: number;
    isSingle: boolean;
    artwork: { url: string; width: number; height: number };
    url: string;
  };
  relationships?: {
    tracks?: {
      data: Array<{
        id: string;
        attributes: {
          name: string;
          trackNumber: number;
          durationInMillis: number;
          isrc: string;
          hasLyrics: boolean;
          url: string;
        };
      }>;
    };
  };
}

import { getClientIp, isRateLimited } from './_rateLimit.js';

const SCAN_SECRET = process.env.SCAN_SECRET || '';

const ALLOWED_ORIGINS = new Set([
  'https://maxmeetsmusiccity.com',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5199',
]);

function isScanSecretAuth(req: VercelRequest): boolean {
  const auth = req.headers.authorization;
  return !!SCAN_SECRET && auth === `Bearer ${SCAN_SECRET}`;
}

function isAuthorized(req: VercelRequest): boolean {
  if (isScanSecretAuth(req)) return true;
  const supabaseToken = req.headers['x-supabase-auth'];
  if (typeof supabaseToken === 'string' && supabaseToken.length > 20) return true;
  const origin = req.headers.origin || '';
  if (origin && ALLOWED_ORIGINS.has(origin)) return true;
  const referer = req.headers.referer || '';
  if (referer) {
    try { if (ALLOWED_ORIGINS.has(new URL(referer).origin)) return true; } catch {}
  }
  return false;
}

/** Pool executor: runs `worker` over `items` with at most `concurrency` in flight. */
async function runPool<T, R>(items: T[], concurrency: number, worker: (item: T) => Promise<R[]>): Promise<R[]> {
  const results: R[] = [];
  let idx = 0;
  async function oneRunner() {
    while (true) {
      const i = idx++;
      if (i >= items.length) return;
      try {
        const r = await worker(items[i]);
        if (r.length) results.push(...r);
      } catch (e) {
        // Per-artist failures never poison the pool
      }
    }
  }
  const workers: Promise<void>[] = [];
  const n = Math.min(concurrency, items.length);
  for (let i = 0; i < n; i++) workers.push(oneRunner());
  await Promise.all(workers);
  return results;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  if (!isAuthorized(req)) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Trusted server-to-server calls (SCAN_SECRET) bypass the per-IP rate limit.
  if (!isScanSecretAuth(req) && await isRateLimited(getClientIp(req), 5, 60_000)) {
    return res.status(429).json({ error: 'Rate limit exceeded. Try again in a minute.' });
  }

  const { artistNames, daysBack: rawDaysBack = 7, targetFriday: rawTargetFriday } = req.body as { artistNames: string[]; daysBack?: number; targetFriday?: string };
  const daysBack = Math.min(Math.max(1, Number(rawDaysBack) || 7), 30);
  if (!Array.isArray(artistNames) || artistNames.length === 0) {
    return res.status(400).json({ error: 'artistNames array required' });
  }
  if (artistNames.length > 100) {
    return res.status(400).json({ error: 'Max 100 artists per request' });
  }

  try {
    const token = await getAppleToken();
    const friday = rawTargetFriday && /^\d{4}-\d{2}-\d{2}$/.test(rawTargetFriday) ? rawTargetFriday : getLastFriday();
    const cutoff = new Date(friday + 'T12:00:00');
    cutoff.setDate(cutoff.getDate() - daysBack);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    // Include future releases up to 4 weeks out for "Coming Soon" feature
    const futureLimit = new Date(friday + 'T12:00:00');
    futureLimit.setDate(futureLimit.getDate() + 28);
    const futureLimitStr = futureLimit.toISOString().split('T')[0];

    const headers = { Authorization: `Bearer ${token}` };

    // Worker: look up one artist and return all tracks (albums) in the date window.
    async function processArtist(name: string): Promise<any[]> {
      const trimmed = name.trim();
      if (!trimmed) return [];

      const searchRes = await fetch(
        `${APPLE_API}/search?term=${encodeURIComponent(trimmed)}&types=artists&limit=3`,
        { headers },
      );
      if (!searchRes.ok) return [];
      const searchData = await searchRes.json();
      const artists = searchData.results?.artists?.data;
      if (!artists?.length) return [];

      const lower = trimmed.toLowerCase();
      const match = artists.find((a: any) => a.attributes.name.toLowerCase() === lower) || artists[0];
      const artistId = match.id;
      const artistName = match.attributes.name;

      const albumRes = await fetch(
        `${APPLE_API}/artists/${artistId}/albums?limit=10`,
        { headers },
      );
      if (!albumRes.ok) return [];
      const albumData = await albumRes.json();

      const matchingAlbums: AppleAlbum[] = [];
      for (const album of (albumData.data || []) as AppleAlbum[]) {
        const releaseDate = album.attributes.releaseDate;
        if (!releaseDate || releaseDate < cutoffStr || releaseDate > futureLimitStr) continue;
        matchingAlbums.push(album);
      }
      if (matchingAlbums.length === 0) return [];

      const albumTrackMap = new Map<string, { composerName: string | null; tracks: any[] }>();
      const batchIds = matchingAlbums.map(a => a.id).slice(0, 25);
      try {
        const trackRes = await fetch(
          `${APPLE_API}/albums?ids=${batchIds.join(',')}&include=tracks`,
          { headers },
        );
        if (trackRes.ok) {
          const trackData = await trackRes.json();
          for (const albumDetail of (trackData.data || [])) {
            const tracks = albumDetail.relationships?.tracks?.data || [];
            const firstTrack = tracks[0];
            albumTrackMap.set(albumDetail.id, {
              composerName: firstTrack?.attributes?.composerName || null,
              tracks,
            });
          }
        }
      } catch { /* batch fetch failed — continue without composer data */ }

      const out: any[] = [];
      for (const album of matchingAlbums) {
        const releaseDate = album.attributes.releaseDate;
        const artUrl = album.attributes.artwork?.url
          ?.replace('{w}', '640').replace('{h}', '640') || '';
        const art300 = album.attributes.artwork?.url
          ?.replace('{w}', '300').replace('{h}', '300') || '';

        const trackInfo = albumTrackMap.get(album.id);
        const composerName = trackInfo?.composerName || null;

        out.push({
          track_name: album.attributes.name,
          track_number: 1,
          track_uri: '',
          track_spotify_url: '',
          track_id: `apple_${album.id}`,
          duration_ms: trackInfo?.tracks?.[0]?.attributes?.durationInMillis || 0,
          explicit: false,
          album_name: album.attributes.name,
          artist_names: artistName,
          artist_id: artistId,
          artist_spotify_url: '',
          artist_genres: [],
          artist_followers: 0,
          album_type: album.attributes.isSingle ? 'single' : 'album',
          album_spotify_url: '',
          album_spotify_id: '',
          release_date: releaseDate,
          total_tracks: album.attributes.trackCount,
          cover_art_640: artUrl,
          cover_art_300: art300,
          cover_art_64: art300,
          apple_music_url: album.attributes.url,
          composer_name: composerName,
        });
      }
      return out;
    }

    // Run up to 10 artist lookups concurrently (trusted callers only — frontend
    // keeps the same 100-artist cap so parallelism stays bounded regardless).
    const concurrency = isScanSecretAuth(req) ? 10 : 5;
    const gathered = await runPool(artistNames, concurrency, processArtist);

    // Dedupe by track_id after the pool — preserves first-seen ordering.
    const seenIds = new Set<string>();
    const allTracks: any[] = [];
    for (const t of gathered) {
      if (seenIds.has(t.track_id)) continue;
      seenIds.add(t.track_id);
      allTracks.push(t);
    }

    res.setHeader('Cache-Control', 's-maxage=300');
    return res.status(200).json({
      tracks: allTracks,
      artists_searched: artistNames.length,
      source: 'apple_music_catalog',
    });
  } catch (e) {
    console.error('[search-apple] Error:', e);
    return res.status(500).json({ error: 'Search failed' });
  }
}
