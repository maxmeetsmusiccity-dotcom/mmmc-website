import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Server-side songwriter lookup API.
 * POST { composer_names: ["Ashley Gorley, Luke Laird"] }
 * Returns { matches: [{ pg_id, display_name, charting_songs, no1_songs, publisher, tier }] }
 *
 * This is the canonical songwriter identity API — callable from NMF UI, future
 * email digests, Thread D analytics, any surface. Replaces client-side cache
 * loading when scale demands it.
 *
 * Cache strategy:
 *   - Cache fetched from CDN (static public asset) on cold start
 *   - Module-scoped in-memory cache for hot function reuse
 *   - Response cached at edge for 24h via s-maxage
 */

interface SongwriterInfo {
  pg_id: string;
  display_name: string;
  charting_songs: number;
  no1_songs: number;
  total_credits: number;
  publisher: string | null;
  tier: string;
  ig_handle?: string | null;
}

interface CacheShape {
  writers: Record<string, SongwriterInfo>;
  aliases: Record<string, string>;
  meta: Record<string, unknown>;
}

let cachedData: CacheShape | null = null;
let cachePromise: Promise<CacheShape | null> | null = null;

async function loadCache(req: VercelRequest): Promise<CacheShape | null> {
  if (cachedData) return cachedData;
  if (cachePromise) return cachePromise;

  // Build the CDN URL for the static asset
  // Prefer the public production domain; fall back to VERCEL_URL (current deployment)
  const host = process.env.VERCEL_URL || req.headers.host || 'maxmeetsmusiccity.com';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const baseHost = host.replace(/^https?:\/\//, '');
  const url = `${protocol}://${baseHost}/data/songwriter_cache.json`;

  cachePromise = (async () => {
    try {
      const res = await fetch(url, { headers: { 'Accept-Encoding': 'br, gzip' } });
      if (!res.ok) return null;
      const data = await res.json() as CacheShape;
      cachedData = data;
      return data;
    } catch (e) {
      console.error('[songwriter-match] Failed to load cache:', e);
      return null;
    } finally {
      cachePromise = null;
    }
  })();

  return cachePromise;
}

function parseComposerNames(str: string): string[] {
  if (!str?.trim()) return [];
  const skip = new Set(['traditional', 'public domain', 'unknown', 'various', 'n/a']);
  return str.replace(/ & /g, ', ').replace(/\band\b/gi, ',')
    .split(',').map(s => s.trim()).filter(s => s.length >= 2 && !skip.has(s.toLowerCase()));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'POST or GET only' });
  }

  const cache = await loadCache(req);
  if (!cache) {
    return res.status(503).json({ error: 'Songwriter cache not available' });
  }

  // Accept names via POST body or GET query
  let rawNames: string[] = [];
  if (req.method === 'POST') {
    const body = req.body as { composer_names?: string[] | string } | undefined;
    if (body?.composer_names) {
      rawNames = Array.isArray(body.composer_names)
        ? body.composer_names
        : [body.composer_names];
    }
  } else {
    const q = req.query.names;
    if (typeof q === 'string') rawNames = [q];
    else if (Array.isArray(q)) rawNames = q as string[];
  }

  if (rawNames.length === 0) {
    return res.status(400).json({ error: 'composer_names (array or string) required' });
  }

  // Parse each input through the same splitter ComingSoon uses
  const parsedNames = new Set<string>();
  for (const raw of rawNames) {
    for (const name of parseComposerNames(raw)) {
      parsedNames.add(name.toLowerCase().trim());
    }
  }

  // Resolve each name through alias chain → writer
  const matches: SongwriterInfo[] = [];
  const seen = new Set<string>();
  const unmatched: string[] = [];
  for (const key of parsedNames) {
    const target = cache.aliases[key] || key;
    const info = cache.writers[target];
    if (info) {
      if (!seen.has(info.pg_id)) {
        seen.add(info.pg_id);
        matches.push(info);
      }
    } else {
      unmatched.push(key);
    }
  }

  // Edge cache for 24h — cache is updated weekly at most
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=3600');
  res.setHeader('Access-Control-Allow-Origin', '*');
  return res.status(200).json({
    matches,
    unmatched,
    total_input: parsedNames.size,
    total_matched: matches.length,
  });
}
