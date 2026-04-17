// Shared helpers for reading/writing the artist_platform_ids cache.
// Used by scan-artists (Spotify) and search-apple (Apple Music) to skip the
// search phase when we've already resolved an artist's platform ID.
//
// Design principles:
// - Read-through / write-through: every cache miss that resolves writes back
//   immediately so the NEXT scan is faster.
// - Failures are counted separately per platform so a "not on Spotify" artist
//   doesn't consume budget every week.
// - The cache is keyed by artist_name (original casing) AND indexed on
//   artist_name_lower for case-insensitive reuse.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

let cachedClient: SupabaseClient | null = null;
function sb(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  if (!cachedClient) cachedClient = createClient(SUPABASE_URL, SUPABASE_KEY);
  return cachedClient;
}

export interface PlatformIds {
  artist_name: string;
  spotify_artist_id: string | null;
  spotify_display_name: string | null;
  apple_artist_id: string | null;
  apple_display_name: string | null;
  spotify_not_found_count: number;
  apple_not_found_count: number;
}

/**
 * Bulk-fetch cache rows for a set of artist names.
 * Returns a map keyed by lowercase name for case-insensitive lookup.
 */
export async function bulkLookupCache(names: string[]): Promise<Map<string, PlatformIds>> {
  const map = new Map<string, PlatformIds>();
  const client = sb();
  if (!client || names.length === 0) return map;

  const lowers = names.map(n => (n || '').trim().toLowerCase()).filter(Boolean);
  if (lowers.length === 0) return map;

  // Chunk into groups of 100 to avoid oversized IN clauses.
  for (let i = 0; i < lowers.length; i += 100) {
    const chunk = lowers.slice(i, i + 100);
    const { data, error } = await client
      .from('artist_platform_ids')
      .select('artist_name, spotify_artist_id, spotify_display_name, apple_artist_id, apple_display_name, spotify_not_found_count, apple_not_found_count')
      .in('artist_name_lower', chunk);
    if (error) {
      console.warn('[platform_cache] bulkLookupCache error:', error.message);
      continue;
    }
    for (const row of (data || [])) {
      map.set(row.artist_name.toLowerCase(), row as PlatformIds);
    }
  }
  return map;
}

type PlatformUpdate =
  | { platform: 'spotify'; artistName: string; id: string | null; displayName?: string | null; error?: string }
  | { platform: 'apple'; artistName: string; id: string | null; displayName?: string | null; error?: string };

/**
 * Record a search result in the cache.
 * Called once per artist search (hit OR miss). Upserts by artist_name.
 */
export async function saveCacheResult(u: PlatformUpdate): Promise<void> {
  const client = sb();
  if (!client) return;
  const name = (u.artistName || '').trim();
  if (!name) return;
  const now = new Date().toISOString();

  // Read existing row (if any) so we can increment not_found counters without
  // overwriting the other platform's state.
  const { data: existing } = await client
    .from('artist_platform_ids')
    .select('spotify_not_found_count, apple_not_found_count, spotify_artist_id, apple_artist_id, spotify_display_name, apple_display_name, spotify_verified_at, apple_verified_at')
    .eq('artist_name', name)
    .maybeSingle();

  const base: Record<string, any> = {
    artist_name: name,
    artist_name_lower: name.toLowerCase(),
    updated_at: now,
  };

  if (u.platform === 'spotify') {
    if (u.id) {
      base.spotify_artist_id = u.id;
      base.spotify_display_name = u.displayName ?? existing?.spotify_display_name ?? null;
      base.spotify_verified_at = now;
      base.spotify_not_found_count = 0;
      base.spotify_last_error = null;
    } else {
      base.spotify_not_found_count = (existing?.spotify_not_found_count || 0) + 1;
      base.spotify_last_error = u.error ?? null;
      // Preserve any previous successful id — don't clobber on transient miss
      if (existing?.spotify_artist_id) base.spotify_artist_id = existing.spotify_artist_id;
      if (existing?.spotify_display_name) base.spotify_display_name = existing.spotify_display_name;
    }
    // Preserve Apple side
    if (existing?.apple_artist_id) base.apple_artist_id = existing.apple_artist_id;
    if (existing?.apple_display_name) base.apple_display_name = existing.apple_display_name;
  } else {
    if (u.id) {
      base.apple_artist_id = u.id;
      base.apple_display_name = u.displayName ?? existing?.apple_display_name ?? null;
      base.apple_verified_at = now;
      base.apple_not_found_count = 0;
      base.apple_last_error = null;
    } else {
      base.apple_not_found_count = (existing?.apple_not_found_count || 0) + 1;
      base.apple_last_error = u.error ?? null;
      if (existing?.apple_artist_id) base.apple_artist_id = existing.apple_artist_id;
      if (existing?.apple_display_name) base.apple_display_name = existing.apple_display_name;
    }
    if (existing?.spotify_artist_id) base.spotify_artist_id = existing.spotify_artist_id;
    if (existing?.spotify_display_name) base.spotify_display_name = existing.spotify_display_name;
  }

  const { error } = await client.from('artist_platform_ids').upsert(base, { onConflict: 'artist_name' });
  if (error) console.warn('[platform_cache] saveCacheResult error:', error.message);
}

/**
 * fetchWith429Retry — standard wrapper that honors Spotify/Apple Retry-After.
 * Retries up to `maxRetries` times; returns the final Response (never throws).
 */
export async function fetchWith429Retry(url: string, init: RequestInit, maxRetries = 3): Promise<Response> {
  let lastResp: Response | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const resp = await fetch(url, init);
    lastResp = resp;
    if (resp.status !== 429) return resp;
    if (attempt >= maxRetries) return resp;
    const retryAfter = parseInt(resp.headers.get('retry-after') || '', 10);
    // Cap wait at 60s — beyond that, better to give up and let the chain move on.
    const waitMs = Math.min(Math.max(isFinite(retryAfter) ? retryAfter : 5, 1), 60) * 1000;
    console.warn(`[platform_cache] 429 on ${url.slice(0, 80)} — sleeping ${waitMs}ms (attempt ${attempt + 1}/${maxRetries})`);
    await new Promise(r => setTimeout(r, waitMs));
  }
  return lastResp as Response;
}
