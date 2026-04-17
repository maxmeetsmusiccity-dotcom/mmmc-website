// Apple artist ID ISRC cross-verification.
//
// R12: An Apple strict-name match is NOT sufficient. "Mark Williams" resolves
// to Nashville country artist on Spotify AND UK classical conductor on Apple,
// both named exactly "Mark Williams". Without cross-verification we cache the
// wrong one and pollute every subsequent scan.
//
// Verification path:
//   1. Fetch N most recent Spotify albums for the artist
//   2. Collect ISRCs from those album tracks (Spotify exposes via /albums/{id}/tracks)
//   3. Fetch N most recent Apple albums for the candidate Apple artist
//   4. Collect ISRCs via /v1/catalog/us/albums?ids=...&include=tracks
//   5. Intersect. Any overlap ⇒ verified. Zero overlap ⇒ reject.
//
// Cost: ~4 extra API calls per first-time Apple resolution. Only runs on
// cache-miss with a known Spotify ID. Once verified, cache keeps the result
// forever. Long-term cost per artist: amortized to zero.

import type { RateBudget } from './_platform_cache.js';
import { fetchWith429Retry } from './_platform_cache.js';

const SPOTIFY_API = 'https://api.spotify.com/v1';
const APPLE_API = 'https://api.music.apple.com/v1/catalog/us';

export interface VerifyResult {
  verified: boolean;
  matchingIsrcs: string[];      // first few ISRC matches (max 5) for audit
  spotifyIsrcCount: number;
  appleIsrcCount: number;
  reason?: 'no_isrc_overlap' | 'spotify_no_tracks' | 'apple_no_tracks' | 'spotify_api_error' | 'apple_api_error';
}

/** Fetch the ISRC set for up to 3 recent Spotify albums from an artist. */
async function collectSpotifyIsrcs(
  spotifyArtistId: string,
  spotifyToken: string,
  budget: RateBudget,
): Promise<Set<string>> {
  const isrcs = new Set<string>();
  const albumRes = await fetchWith429Retry(
    `${SPOTIFY_API}/artists/${spotifyArtistId}/albums?include_groups=album,single&market=US&limit=5`,
    { headers: { Authorization: `Bearer ${spotifyToken}` } },
    budget,
  );
  if (!albumRes.ok) return isrcs;
  const albumData = await albumRes.json();
  const albums = (albumData.items || []).slice(0, 5);
  // Spotify's /albums/{id}/tracks doesn't include ISRCs — need /tracks/{id}
  // OR /albums?ids= with market. Use /albums?ids= (batch, 1 call for many).
  if (albums.length === 0) return isrcs;
  const ids = albums.map((a: any) => a.id).join(',');
  const detailRes = await fetchWith429Retry(
    `${SPOTIFY_API}/albums?ids=${ids}&market=US`,
    { headers: { Authorization: `Bearer ${spotifyToken}` } },
    budget,
  );
  if (!detailRes.ok) return isrcs;
  const detail = await detailRes.json();
  for (const alb of (detail.albums || [])) {
    for (const t of (alb.tracks?.items || [])) {
      const isrc = t.external_ids?.isrc;
      if (isrc) isrcs.add(isrc.toUpperCase());
    }
  }
  return isrcs;
}

/** Fetch the ISRC set for up to 3 recent Apple albums from the candidate. */
async function collectAppleIsrcs(
  appleArtistId: string,
  appleToken: string,
  budget: RateBudget,
): Promise<Set<string>> {
  const isrcs = new Set<string>();
  const headers = { Authorization: `Bearer ${appleToken}` };
  const albumRes = await fetchWith429Retry(
    `${APPLE_API}/artists/${appleArtistId}/albums?limit=5&sort=-releaseDate`,
    { headers },
    budget,
  );
  if (!albumRes.ok) return isrcs;
  const albumData = await albumRes.json();
  const albums = (albumData.data || []).slice(0, 5);
  if (albums.length === 0) return isrcs;
  const ids = albums.map((a: any) => a.id).join(',');
  const detailRes = await fetchWith429Retry(
    `${APPLE_API}/albums?ids=${ids}&include=tracks`,
    { headers },
    budget,
  );
  if (!detailRes.ok) return isrcs;
  const detail = await detailRes.json();
  for (const alb of (detail.data || [])) {
    for (const t of (alb.relationships?.tracks?.data || [])) {
      const isrc = t.attributes?.isrc;
      if (isrc) isrcs.add(String(isrc).toUpperCase());
    }
  }
  return isrcs;
}

/**
 * Returns whether the Apple artist ID plausibly refers to the same real
 * person as the Spotify artist ID, verified by ISRC overlap.
 *
 * When `spotifyArtistId` is null (artist unknown on Spotify), we can't
 * cross-verify. Caller should decide whether to accept the Apple match
 * anyway or flag for human review. This function returns
 * `verified: false, reason: 'spotify_no_tracks'` in that case so callers
 * can make that decision.
 */
export async function verifyAppleIdByIsrc(
  spotifyArtistId: string | null | undefined,
  appleArtistId: string,
  spotifyToken: string,
  appleToken: string,
  budget: RateBudget,
): Promise<VerifyResult> {
  if (!spotifyArtistId) {
    return { verified: false, matchingIsrcs: [], spotifyIsrcCount: 0, appleIsrcCount: 0, reason: 'spotify_no_tracks' };
  }

  // Parallel fetch — saves ~2s on a critical path call
  const [spIsrcs, apIsrcs] = await Promise.all([
    collectSpotifyIsrcs(spotifyArtistId, spotifyToken, budget).catch(() => new Set<string>()),
    collectAppleIsrcs(appleArtistId, appleToken, budget).catch(() => new Set<string>()),
  ]);

  if (spIsrcs.size === 0) {
    return { verified: false, matchingIsrcs: [], spotifyIsrcCount: 0, appleIsrcCount: apIsrcs.size, reason: 'spotify_no_tracks' };
  }
  if (apIsrcs.size === 0) {
    return { verified: false, matchingIsrcs: [], spotifyIsrcCount: spIsrcs.size, appleIsrcCount: 0, reason: 'apple_no_tracks' };
  }

  const overlap: string[] = [];
  for (const isrc of spIsrcs) {
    if (apIsrcs.has(isrc)) {
      overlap.push(isrc);
      if (overlap.length >= 5) break;
    }
  }

  return {
    verified: overlap.length > 0,
    matchingIsrcs: overlap,
    spotifyIsrcCount: spIsrcs.size,
    appleIsrcCount: apIsrcs.size,
    reason: overlap.length === 0 ? 'no_isrc_overlap' : undefined,
  };
}
