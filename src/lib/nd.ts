/** Nashville Decoder API client — calls through /api/nd-proxy */

interface NDSearchResult {
  pg_id: string;
  name: string;
  tier?: string;
  credits?: number;
}

export type HandleSource = 'nd' | 'spotify' | 'manual' | 'unknown';

export interface HandleResult {
  artist_name: string;
  handle: string | null;
  source: HandleSource;
  pg_id: string | null;
  loading: boolean;
  confirmed: boolean;
}

/** Search ND for an artist. Returns pg_id if found. */
export async function searchND(query: string): Promise<NDSearchResult | null> {
  try {
    const res = await fetch(`/api/nd-proxy?path=${encodeURIComponent(`/api/search?q=${encodeURIComponent(query)}`)}`);
    console.log(`[ND SEARCH] query="${query}" status=${res.status}`);
    if (!res.ok) return null;
    const data = await res.json();
    const results = data.results as NDSearchResult[] | undefined;
    if (results && results.length > 0) {
      console.log(`[ND SEARCH] found: ${results[0].name} (${results[0].pg_id})`);
      return results[0];
    }
    console.log(`[ND SEARCH] no results for "${query}"`);
    return null;
  } catch (e) {
    console.warn(`[ND SEARCH] error:`, e);
    return null;
  }
}

/**
 * Resolve an Instagram handle for an artist.
 *
 * DATA INTEGRITY RULE: Never return an unvalidated guess.
 * Only Tier 1 (ND verified), Tier 2 (Spotify-linked), or manual entries are confirmed.
 * If we can't confirm the handle, return source='unknown' — Max enters it manually.
 *
 * Current state:
 * - ND Workers API does NOT expose dim_intelligence_instagram_v1 (no instagram endpoint)
 * - ND search DOES find entities (returns pg_id, name, tier)
 * - Instagram handle resolution requires manual entry or future ND API expansion
 */
export async function resolveInstagramHandle(artistName: string): Promise<HandleResult> {
  const base = { artist_name: artistName, loading: false };

  // Tier 1: ND database search — find the entity but can't get IG handle yet
  // (The ND Workers API doesn't expose the instagram intelligence table)
  let pgId: string | null = null;
  try {
    const ndResult = await searchND(artistName);
    if (ndResult) {
      pgId = ndResult.pg_id;
      // ND found the artist but can't provide IG handle through current API
      // In the future, when ND exposes dim_intelligence_instagram_v1,
      // we'll query it here and return source='nd' with confirmed=true
    }
  } catch {
    // ND unavailable
  }

  // Tier 2, 3 skipped — no Spotify token available in this context,
  // and multi-source validation requires web scraping infrastructure

  // Tier 4: Unresolved — Max enters manually
  return {
    ...base,
    handle: null,
    source: 'unknown',
    pg_id: pgId,
    confirmed: false,
  };
}
