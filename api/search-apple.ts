import type { VercelRequest, VercelResponse } from '@vercel/node';
import { SignJWT, importPKCS8 } from 'jose';

const TEAM_ID = process.env.APPLE_MUSIC_TEAM_ID || 'G46PBQ4ZQL';
const KEY_ID = process.env.APPLE_MUSIC_SEARCH_KEY_ID || 'XP4Q9YVKQU';
const APPLE_API = 'https://api.music.apple.com/v1/catalog/us';

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAppleToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.token;

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

function isAuthorized(req: VercelRequest): boolean {
  const auth = req.headers.authorization;
  if (SCAN_SECRET && auth === `Bearer ${SCAN_SECRET}`) return true;
  const supabaseToken = req.headers['x-supabase-auth'];
  if (typeof supabaseToken === 'string' && supabaseToken.length > 20) return true;
  return false;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  if (!isAuthorized(req)) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (await isRateLimited(getClientIp(req), 5, 60_000)) {
    return res.status(429).json({ error: 'Rate limit exceeded. Try again in a minute.' });
  }

  const { artistNames, daysBack: rawDaysBack = 7 } = req.body as { artistNames: string[]; daysBack?: number };
  const daysBack = Math.min(Math.max(1, Number(rawDaysBack) || 7), 30);
  if (!Array.isArray(artistNames) || artistNames.length === 0) {
    return res.status(400).json({ error: 'artistNames array required' });
  }
  if (artistNames.length > 100) {
    return res.status(400).json({ error: 'Max 100 artists per request' });
  }

  try {
    const token = await getAppleToken();
    const friday = getLastFriday();
    const cutoff = new Date(friday + 'T12:00:00');
    cutoff.setDate(cutoff.getDate() - daysBack);
    const cutoffStr = cutoff.toISOString().split('T')[0];

    const headers = { Authorization: `Bearer ${token}` };
    const allTracks: any[] = [];
    const seenIds = new Set<string>();

    for (const name of artistNames) {
      const trimmed = name.trim();
      if (!trimmed) continue;

      // Search for artist
      const searchRes = await fetch(
        `${APPLE_API}/search?term=${encodeURIComponent(trimmed)}&types=artists&limit=3`,
        { headers },
      );
      if (!searchRes.ok) continue;
      const searchData = await searchRes.json();
      const artists = searchData.results?.artists?.data;
      if (!artists?.length) continue;

      // Find best match
      const lower = trimmed.toLowerCase();
      const match = artists.find((a: any) => a.attributes.name.toLowerCase() === lower) || artists[0];
      const artistId = match.id;
      const artistName = match.attributes.name;

      // Fetch recent albums
      const albumRes = await fetch(
        `${APPLE_API}/artists/${artistId}/albums?limit=10`,
        { headers },
      );
      if (!albumRes.ok) continue;
      const albumData = await albumRes.json();

      for (const album of (albumData.data || []) as AppleAlbum[]) {
        const releaseDate = album.attributes.releaseDate;
        if (!releaseDate || releaseDate < cutoffStr || releaseDate > friday) continue;

        const artUrl = album.attributes.artwork?.url
          ?.replace('{w}', '640').replace('{h}', '640') || '';
        const art300 = album.attributes.artwork?.url
          ?.replace('{w}', '300').replace('{h}', '300') || '';

        // Each album as a track entry (Apple doesn't return tracks in album list)
        const trackId = `apple_${album.id}`;
        if (seenIds.has(trackId)) continue;
        seenIds.add(trackId);

        allTracks.push({
          track_name: album.attributes.name,
          track_number: 1,
          track_uri: '',
          track_spotify_url: '',
          track_id: trackId,
          duration_ms: 0,
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
        });
      }
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
