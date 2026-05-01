import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { getClientIp, isRateLimited } from './_rateLimit.js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const APIFY_TOKEN = process.env.APIFY_TOKEN || '';

/**
 * Real-time Instagram handle resolution.
 * 1. Check Supabase cache by artist name
 * 2. If miss: Apify Google Search for "artist name instagram"
 * 3. Parse top result for Instagram handle
 * 4. Apify Instagram Profile to validate
 * 5. Save to Supabase cache with source="apify:likely"
 * 6. Return immediately
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
  // Same-origin check (exact-match allowlist)
  const ALLOWED_ORIGINS = new Set([
    'https://newmusicfriday.app',
    'https://maxmeetsmusiccity.com',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5199',
  ]);
  const origin = req.headers.origin || '';
  let originAllowed = origin ? ALLOWED_ORIGINS.has(origin) : false;
  if (!originAllowed) {
    const referer = req.headers.referer || '';
    if (referer) {
      try { originAllowed = ALLOWED_ORIGINS.has(new URL(referer).origin); } catch {}
    }
  }
  if (!originAllowed) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (await isRateLimited(getClientIp(req), 20, 60_000)) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }

  let body: any;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
  } catch {
    body = {};
  }
  const { artist_name, spotify_id } = body;
  if (!artist_name) return res.status(400).json({ error: 'artist_name required' });

  // Step 1: Check cache
  if (SUPABASE_URL && SUPABASE_KEY) {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // Try by Spotify ID first (with name guard)
    if (spotify_id) {
      const { data } = await supabase
        .from('instagram_handles')
        .select('*')
        .eq('spotify_artist_id', spotify_id)
        .limit(1);
      const row = data?.[0];
      if (row?.instagram_handle && row.artist_name?.toLowerCase() === artist_name.toLowerCase()) {
        return res.json({ handle: row.instagram_handle, source: row.source || 'cache', cached: true });
      }
    }

    // Try by name
    const { data: nameData } = await supabase
      .from('instagram_handles')
      .select('*')
      .ilike('artist_name', artist_name)
      .limit(1);
    const nameRow = nameData?.[0];
    if (nameRow?.instagram_handle) {
      return res.json({ handle: nameRow.instagram_handle, source: nameRow.source || 'cache', cached: true });
    }
  }

  // Step 2: Apify Google Search
  if (!APIFY_TOKEN) {
    return res.json({ handle: null, source: 'no_apify', cached: false });
  }

  let candidateHandle: string | null = null;
  try {
    const searchRes = await fetch(
      `https://api.apify.com/v2/acts/apify~google-search-scraper/run-sync-get-dataset-items?token=${APIFY_TOKEN}&timeout=25`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          queries: `"${artist_name}" instagram site:instagram.com`,
          maxPagesPerQuery: 1,
          resultsPerPage: 3,
        }),
      },
    );
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      const results = searchData?.[0]?.organicResults || [];
      for (const r of results) {
        const match = (r.url || '').match(/instagram\.com\/([a-zA-Z0-9_.]+)\/?$/);
        if (match && !['p', 'reel', 'explore', 'stories', 'accounts'].includes(match[1])) {
          candidateHandle = `@${match[1]}`;
          break;
        }
      }
    }
  } catch { /* Apify search failed */ }

  if (!candidateHandle) {
    return res.json({ handle: null, source: 'not_found', cached: false });
  }

  // Step 3: Apify Instagram Profile validation
  let profileValid = false;
  try {
    const profileRes = await fetch(
      `https://api.apify.com/v2/acts/apify~instagram-profile-scraper/run-sync-get-dataset-items?token=${APIFY_TOKEN}&timeout=20`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernames: [candidateHandle.replace('@', '')] }),
      },
    );
    if (profileRes.ok) {
      const profileData = await profileRes.json();
      profileValid = Array.isArray(profileData) && profileData.length > 0 && !!profileData[0]?.username;
    }
  } catch { /* Profile validation failed */ }

  if (!profileValid) {
    return res.json({ handle: null, source: 'invalid_profile', cached: false });
  }

  // Step 4: Save to cache
  if (SUPABASE_URL && SUPABASE_KEY) {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    try {
      await supabase.from('instagram_handles').upsert({
        spotify_artist_id: spotify_id || `resolved:${artist_name}`,
        artist_name,
        instagram_handle: candidateHandle,
        source: 'apify:likely',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'spotify_artist_id' });
    } catch { /* cache write failed — non-critical */ }
  }

  return res.json({ handle: candidateHandle, source: 'apify:likely', cached: false });
  } catch (e) {
    console.error('[resolve-handle] Unhandled error:', e);
    return res.status(500).json({ handle: null, source: 'error', cached: false });
  }
}
