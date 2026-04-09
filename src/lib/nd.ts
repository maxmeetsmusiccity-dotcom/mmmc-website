/** Nashville Decoder API client — calls through /api/nd-proxy */

import { supabase } from './supabase';

interface NDSearchResult {
  pg_id: string;
  name: string;
  tier?: string;
  credits?: number;
}

interface NDInstagramResult {
  pg_id: string;
  ig_handle: string;
  followers?: number;
  verified?: boolean;
  bio?: string;
  profile_pic_url?: string;
}

export type HandleSource = 'nd' | 'cache' | 'manual' | 'unknown' | string;

export interface HandleResult {
  artist_name: string;
  handle: string | null;
  source: HandleSource;
  pg_id: string | null;
  loading: boolean;
  confirmed: boolean;
  followers?: number;
  verified?: boolean;
}

/** Search ND for an artist. Returns pg_id if found. */
export async function searchND(query: string): Promise<NDSearchResult | null> {
  try {
    const res = await fetch(`/api/nd-proxy?path=${encodeURIComponent(`/api/search?q=${encodeURIComponent(query)}`)}`);
    if (!res.ok) return null;
    const data = await res.json();
    const results = data.results as NDSearchResult[] | undefined;
    if (results && results.length > 0) return results[0];
    return null;
  } catch {
    return null;
  }
}

/** Fetch Instagram handle from ND profile endpoint */
async function fetchNDInstagram(pgId: string): Promise<NDInstagramResult | null> {
  try {
    const res = await fetch(`/api/nd-proxy?path=${encodeURIComponent(`/api/profile/${pgId}/instagram`)}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.ig_handle) return data as NDInstagramResult;
    return null;
  } catch {
    return null;
  }
}

/** Check Supabase cache for a previously resolved handle */
async function getCachedHandle(artistId: string): Promise<HandleResult | null> {
  if (!supabase) return null;
  try {
    const { data } = await supabase
      .from('instagram_handles')
      .select('*')
      .eq('spotify_artist_id', artistId)
      .single();
    if (data?.instagram_handle) {
      return {
        artist_name: data.artist_name,
        handle: data.instagram_handle,
        source: 'cache',
        pg_id: data.nd_pg_id || null,
        loading: false,
        confirmed: true,
      };
    }
  } catch { /* not cached */ }
  return null;
}

/** Save resolved handle to Supabase cache */
async function cacheHandle(
  artistId: string,
  artistName: string,
  handle: string,
  pgId: string | null,
  source: string,
): Promise<void> {
  // Write through server endpoint (RLS restricts direct writes to service_role)
  try {
    const token = supabase ? (await supabase.auth.getSession()).data.session?.access_token : null;
    await fetch('/api/save-handle', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'X-Supabase-Auth': token } : {}),
      },
      body: JSON.stringify({
        spotify_artist_id: artistId,
        artist_name: artistName,
        instagram_handle: handle,
        nd_pg_id: pgId,
        source,
        confidence: 1.0,
      }),
    });
  } catch { /* cache write failure is non-critical */ }
}

/**
 * Resolve an Instagram handle for an artist.
 *
 * Flow:
 * 1. Check Supabase cache first (instant, no API call)
 * 2. Search ND by artist name → get pg_id
 * 3. Fetch /api/profile/:pg_id/instagram → get handle
 * 4. Cache result in Supabase for future use
 * 5. If not found: return null handle with pg_id for manual entry
 */
export async function resolveInstagramHandle(
  artistName: string,
  artistId?: string,
): Promise<HandleResult> {
  const base = { artist_name: artistName, loading: false };

  // Step 1: Check Supabase cache
  if (artistId) {
    const cached = await getCachedHandle(artistId);
    if (cached) return cached;
  }

  // Step 2: Search ND for the artist
  let pgId: string | null = null;
  try {
    const ndResult = await searchND(artistName);
    if (ndResult) {
      pgId = ndResult.pg_id;

      // Step 3: Fetch Instagram handle from ND
      const igResult = await fetchNDInstagram(pgId);
      if (igResult?.ig_handle) {
        const handle = `@${igResult.ig_handle}`;

        // Step 4: Cache in Supabase
        if (artistId) {
          cacheHandle(artistId, artistName, handle, pgId, 'nd');
        }

        return {
          ...base,
          handle,
          source: 'nd',
          pg_id: pgId,
          confirmed: true,
          followers: igResult.followers,
          verified: igResult.verified,
        };
      }
    }
  } catch { /* ND unavailable */ }

  // Step 5: Not found — return pg_id for manual entry link
  return {
    ...base,
    handle: null,
    source: 'unknown',
    pg_id: pgId,
    confirmed: false,
  };
}
