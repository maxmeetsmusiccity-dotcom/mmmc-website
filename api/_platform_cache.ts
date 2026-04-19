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
import { alertSlack } from './_alert.js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

let cachedClient: SupabaseClient | null = null;
function sb(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  if (!cachedClient) cachedClient = createClient(SUPABASE_URL, SUPABASE_KEY);
  return cachedClient;
}

/**
 * Sanitize an artist name before it enters artist_platform_ids.
 * Prevents recurrence of the 2026-04 `"Name",` CSV-paste corruption class
 * (M-Z5 scrubbed 537 rows; M-Z17 rules it out at the ingest boundary).
 *
 * Auto-fix: wrapping quote+comma pattern `^"...",$` → strips wrap
 * Reject:   empty after trim, or length > 200 (multi-artist concat)
 * Preserve: legitimate punctuation (`"Weird Al" Yankovic`, `Goodnight, Texas`)
 *
 * Returns null for rejection; caller must skip the write.
 */
export function sanitizeArtistName(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  if (trimmed.length > 200) return null;
  const wrapMatch = trimmed.match(/^"(.*)",$/);
  if (wrapMatch) {
    const inner = wrapMatch[1].trim();
    return inner.length > 0 && inner.length <= 200 ? inner : null;
  }
  return trimmed;
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
  const raw = u.artistName || '';
  const sanitized = sanitizeArtistName(raw);
  if (sanitized == null) {
    console.warn(`[platform_cache] sanitizeArtistName rejected: ${JSON.stringify(raw)}`);
    alertSlack('artist_platform_ids: sanitizer rejected name', {
      platform: u.platform,
      raw,
      raw_length: raw.length,
    }).catch(() => {});
    return;
  }
  if (sanitized !== raw.trim()) {
    console.warn(`[platform_cache] sanitizeArtistName auto-fixed: ${JSON.stringify(raw)} -> ${JSON.stringify(sanitized)}`);
    alertSlack('artist_platform_ids: sanitizer auto-fixed name', {
      platform: u.platform,
      original: raw,
      sanitized,
    }).catch(() => {});
  }
  const name = sanitized;
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
 * RateBudget — tracks cumulative retry-sleep across all calls in one request
 * handler. Vercel functions have a 300s timeout; per-call 429 retries with up
 * to 60s sleep can cascade into thousands of seconds of backoff on a rate-
 * limit storm. A shared budget caps the damage: once exhausted, `fetchWith429`
 * stops retrying and returns the 429 immediately so the caller can skip the
 * artist and move on (partial results + cache writes beat a timeout).
 */
export class RateBudget {
  spent = 0;
  readonly maxMs: number;
  constructor(maxMs = 30_000) { this.maxMs = maxMs; }
  /** Remaining sleep allowance in ms; 0 means exhausted. */
  remainingMs(): number { return Math.max(0, this.maxMs - this.spent); }
  async sleep(ms: number): Promise<void> {
    const actual = Math.min(ms, this.remainingMs());
    if (actual <= 0) return;
    this.spent += actual;
    await new Promise(r => setTimeout(r, actual));
  }
}

/**
 * fetchWith429Retry — honors Spotify/Apple Retry-After headers, but bounded
 * by a shared budget so cumulative sleep cannot exhaust the function timeout.
 *
 * @param budget shared RateBudget across all fetches in this handler
 * @param maxRetries per-call retry ceiling; default 2 (so ≤3 total attempts)
 */
export async function fetchWith429Retry(
  url: string,
  init: RequestInit,
  budget: RateBudget,
  maxRetries = 2,
): Promise<Response> {
  let lastResp: Response | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const resp = await fetch(url, init);
    lastResp = resp;
    if (resp.status !== 429) return resp;
    if (attempt >= maxRetries) return resp;
    if (budget.remainingMs() <= 0) {
      // Budget exhausted — caller will treat the 429 as a hard miss and move on
      console.warn(`[platform_cache] 429 on ${url.slice(0, 80)} — budget exhausted, giving up`);
      return resp;
    }
    const retryAfter = parseInt(resp.headers.get('retry-after') || '', 10);
    // Cap per-retry at 10s and by remaining budget. Retry-After values
    // higher than our budget simply abort.
    const proposed = Math.min(Math.max(isFinite(retryAfter) ? retryAfter : 2, 1), 10) * 1000;
    const waitMs = Math.min(proposed, budget.remainingMs());
    if (waitMs <= 0) return resp;
    console.warn(`[platform_cache] 429 on ${url.slice(0, 80)} — sleep ${waitMs}ms (attempt ${attempt + 1}/${maxRetries}, budget ${budget.remainingMs()}ms left)`);
    await budget.sleep(waitMs);
  }
  return lastResp as Response;
}
