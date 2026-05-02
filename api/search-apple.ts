import type { VercelRequest, VercelResponse } from '@vercel/node';
import { bulkLookupCache, saveCacheResult, fetchWith429Retry, RateBudget, normalizeTrackName } from './_platform_cache.js';
import { verifyAppleIdByIsrc } from './_apple_verify.js';
import { getSpotifyClientToken } from './_spotify_token.js';
import { getAppleDeveloperToken } from './_apple_token.js';
import type { AppleRejection } from './_scan_intelligence.js';

const APPLE_API = 'https://api.music.apple.com/v1/catalog/us';

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
  'https://newmusicfriday.app',
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
    const token = await getAppleDeveloperToken();
    const friday = rawTargetFriday && /^\d{4}-\d{2}-\d{2}$/.test(rawTargetFriday) ? rawTargetFriday : getLastFriday();
    const cutoff = new Date(friday + 'T12:00:00');
    cutoff.setDate(cutoff.getDate() - daysBack);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    // Include future releases up to 4 weeks out for "Coming Soon" feature
    const futureLimit = new Date(friday + 'T12:00:00');
    futureLimit.setDate(futureLimit.getDate() + 28);
    const futureLimitStr = futureLimit.toISOString().split('T')[0];

    const headers = { Authorization: `Bearer ${token}` };

    // Shared 30s retry-sleep budget for this invocation. Bounds total 429
    // backoff so a rate-limit storm can't burn the function timeout.
    const budget = new RateBudget(30_000);

    // Bulk-lookup the platform-ID cache so processArtist() can skip the search
    // step whenever we've already resolved an Apple artist ID in a prior scan.
    const cacheMap = await bulkLookupCache(artistNames);

    // R12: handler-scope accumulators for ISRC cross-verification. Populated
    // only when a cache-miss Apple strict-match is attempted against an artist
    // whose Spotify ID is already cached (the anchor identity). Returned in
    // the response so the cron can feed them into scan_intelligence.
    const appleRejections: AppleRejection[] = [];
    let appleVerifiedCount = 0;
    // Lazily fetched on the first artist that needs ISRC verification —
    // saves the token call entirely for batches with no verifiable artists.
    let spotifyTokenCache: string | null = null;

    // Worker: look up one artist and return all tracks (albums) in the date window.
    async function processArtist(name: string): Promise<any[]> {
      const trimmed = name.trim();
      if (!trimmed) return [];

      let artistId: string;
      let artistName: string;

      const cached = cacheMap.get(trimmed.toLowerCase());
      if (cached?.apple_artist_id) {
        // Cache hit — skip search entirely
        artistId = cached.apple_artist_id;
        artistName = cached.apple_display_name || trimmed;
      } else {
        // Skip artists we've failed to find 3+ times (budget preservation)
        if (cached && cached.apple_not_found_count >= 3) return [];
        const searchRes = await fetchWith429Retry(
          `${APPLE_API}/search?term=${encodeURIComponent(trimmed)}&types=artists&limit=3`,
          { headers },
          budget,
        );
        if (!searchRes.ok) {
          saveCacheResult({ platform: 'apple', artistName: trimmed, id: null, error: `search_${searchRes.status}` }).catch(() => {});
          return [];
        }
        const searchData = await searchRes.json();
        const artists = searchData.results?.artists?.data;
        if (!artists?.length) {
          saveCacheResult({ platform: 'apple', artistName: trimmed, id: null, error: 'not_found' }).catch(() => {});
          return [];
        }
        // STRICT matching: require exact (case-insensitive) name equality.
        // Falling back to `artists[0]` silently polluted the data — e.g. searching
        // for "ANNALEA" (a Nashville artist) returned "Alea Aquarius" (a German
        // audiodrama) as the top fuzzy match, whose albums then landed in the
        // Nashville release feed. A missed match beats a wrong match.
        const lower = trimmed.toLowerCase();
        const match = artists.find((a: any) => (a.attributes?.name || '').toLowerCase() === lower);
        if (!match) {
          saveCacheResult({ platform: 'apple', artistName: trimmed, id: null, error: 'no_exact_match' }).catch(() => {});
          return [];
        }
        artistId = match.id;
        artistName = match.attributes.name;

        // R12: ISRC cross-verification before caching. A strict name match on
        // Apple is necessary but NOT sufficient — "Mark Williams" resolves to
        // a Nashville country artist on Spotify AND a UK classical conductor
        // on Apple, both exact-name matches. Without this gate, we cache the
        // wrong person and poison every subsequent scan.
        //
        // Policy: REJECT only on `no_isrc_overlap` — a CONFIRMED mismatch
        // where both catalogs returned ISRCs and zero overlapped. On API
        // failure (Spotify 429, Apple outage, either side returned empty due
        // to a network error) we ABSTAIN: cache the Apple ID, log, and move
        // on. Blocking cache writes on transient errors would make a single
        // Spotify rate-limit storm poison every scan for weeks. Verified on
        // April 17 2026 when Spotify dev quota was 429ing every call.
        if (cached?.spotify_artist_id) {
          let verifyOk: boolean | null = null;            // true=accept, false=reject, null=abstain
          let rejectionReason: AppleRejection['reason'] | null = null;
          let abstainReason: string | null = null;
          try {
            if (!spotifyTokenCache) spotifyTokenCache = await getSpotifyClientToken();
            const v = await verifyAppleIdByIsrc(
              cached.spotify_artist_id,
              artistId,
              spotifyTokenCache,
              token,
              budget,
            );
            if (v.verified) {
              verifyOk = true;
            } else if (v.reason === 'no_isrc_overlap') {
              verifyOk = false;
              rejectionReason = 'no_isrc_overlap';
            } else {
              // spotify_no_tracks / apple_no_tracks / spotify_api_error /
              // apple_api_error — could be transient. Don't block caching.
              verifyOk = null;
              abstainReason = v.reason || 'unknown';
            }
          } catch (e) {
            console.warn('[search-apple] ISRC verify threw for', trimmed, e);
            verifyOk = null;
            abstainReason = 'verify_threw';
          }
          if (verifyOk === false) {
            appleRejections.push({
              nashville_name: trimmed,
              spotify_artist_id: cached.spotify_artist_id,
              apple_artist_id_rejected: artistId,
              apple_display_name_rejected: artistName,
              reason: rejectionReason!,
            });
            // Cache MISS so the next scan re-attempts. The rejection is the
            // durable signal flowing via intelligence to Thread A.
            saveCacheResult({
              platform: 'apple',
              artistName: trimmed,
              id: null,
              error: `isrc_verify_rejected:${rejectionReason}`,
            }).catch(() => {});
            return [];
          }
          if (verifyOk === true) {
            appleVerifiedCount += 1;
          } else {
            console.warn(`[search-apple] ISRC verify abstain for ${trimmed} reason=${abstainReason} — caching Apple ID without verification`);
          }
        }

        // Write-through: cache the resolved ID so the next scan is fast
        saveCacheResult({ platform: 'apple', artistName: trimmed, id: artistId, displayName: artistName }).catch(() => {});
      }

      // CRITICAL: Apple's default sort for /artists/{id}/albums is NOT chronological.
      // Without `sort=-releaseDate`, a brand-new single from a prolific artist
      // (Kacey Musgraves, Lainey Wilson, etc — decades of catalog) sits at
      // position 50+ and is invisible to any reasonable `limit`. This was the
      // root cause of "why is Kacey's April 17 release missing" on April 17 2026.
      // Also bump limit 10 -> 25 so catalog-heavy artists don't truncate newer
      // singles during a prolific release window.
      const albumRes = await fetchWith429Retry(
        `${APPLE_API}/artists/${artistId}/albums?limit=25&sort=-releaseDate`,
        { headers },
        budget,
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
      } catch { /* batch fetch failed — fall back to album-level entry only */ }

      const out: any[] = [];
      for (const album of matchingAlbums) {
        const releaseDate = album.attributes.releaseDate;
        const artUrl = album.attributes.artwork?.url
          ?.replace('{w}', '640').replace('{h}', '640') || '';
        const art300 = album.attributes.artwork?.url
          ?.replace('{w}', '300').replace('{h}', '300') || '';

        const trackInfo = albumTrackMap.get(album.id);
        const composerName = trackInfo?.composerName || null;
        const albumTracks = trackInfo?.tracks || [];
        const albumType = album.attributes.isSingle ? 'single' : 'album';
        // Grouping key the UI can use to cluster rows from the same album.
        // Prefix with apple_album_ so it doesn't collide with Spotify album IDs.
        const albumGroupId = `apple_album_${album.id}`;

        // Emit one row per track when we have the track list. Falls back to a
        // single album-level row if the track fetch failed. Brooke Lee's EP
        // should appear as N rows under the same album card, not one.
        if (albumTracks.length > 0) {
          for (const track of albumTracks) {
            const ta = track.attributes || {};
            out.push({
              track_name: ta.name || album.attributes.name,
              track_number: ta.trackNumber || 1,
              track_uri: '',
              track_spotify_url: '',
              // track_id: prefer the ISRC (stable across platforms) then the
              // Apple catalog id, falling back to a synthesized key.
              track_id: ta.isrc ? `apple_isrc_${ta.isrc}` : `apple_track_${track.id}`,
              duration_ms: ta.durationInMillis || 0,
              explicit: false,
              album_name: album.attributes.name,
              artist_names: artistName,
              artist_id: artistId,
              artist_spotify_url: '',
              artist_genres: [],
              artist_followers: 0,
              album_type: albumType,
              album_spotify_url: '',
              album_spotify_id: albumGroupId,
              release_date: releaseDate,
              total_tracks: album.attributes.trackCount,
              cover_art_640: artUrl,
              cover_art_300: art300,
              cover_art_64: art300,
              apple_music_url: ta.url || album.attributes.url,
              composer_name: ta.composerName || composerName,
            });
          }
        } else {
          // Fallback when Apple's track batch fetch failed — preserve prior
          // album-level behavior so we don't lose the release entirely.
          out.push({
            track_name: album.attributes.name,
            track_number: 1,
            track_uri: '',
            track_spotify_url: '',
            track_id: `apple_${album.id}`,
            duration_ms: 0,
            explicit: false,
            album_name: album.attributes.name,
            artist_names: artistName,
            artist_id: artistId,
            artist_spotify_url: '',
            artist_genres: [],
            artist_followers: 0,
            album_type: albumType,
            album_spotify_url: '',
            album_spotify_id: albumGroupId,
            release_date: releaseDate,
            total_tracks: album.attributes.trackCount,
            cover_art_640: artUrl,
            cover_art_300: art300,
            cover_art_64: art300,
            apple_music_url: album.attributes.url,
            composer_name: composerName,
          });
        }
      }
      return out;
    }

    // Run up to 10 artist lookups concurrently (trusted callers only — frontend
    // keeps the same 100-artist cap so parallelism stays bounded regardless).
    const concurrency = isScanSecretAuth(req) ? 10 : 5;
    const gathered = await runPool(artistNames, concurrency, processArtist);

    // Dedupe by track_id after the pool — preserves first-seen ordering.
    // Then a second pass dedupes by (artist_id, normalizedName) to collapse
    // "Jolene" with "Jolene - Single" etc. (M-Z11).
    const seenIds = new Set<string>();
    const seenNameKeys = new Set<string>();
    const allTracks: any[] = [];
    for (const t of gathered) {
      if (seenIds.has(t.track_id)) continue;
      seenIds.add(t.track_id);
      const nameKey = `${t.artist_id}:${normalizeTrackName(t.track_name)}`;
      if (seenNameKeys.has(nameKey)) continue;
      seenNameKeys.add(nameKey);
      allTracks.push(t);
    }

    res.setHeader('Cache-Control', 's-maxage=300');
    return res.status(200).json({
      tracks: allTracks,
      artists_searched: artistNames.length,
      source: 'apple_music_catalog',
      apple_rejections: appleRejections,
      apple_verified_count: appleVerifiedCount,
    });
  } catch (e) {
    console.error('[search-apple] Error:', e);
    return res.status(500).json({ error: 'Search failed' });
  }
}
