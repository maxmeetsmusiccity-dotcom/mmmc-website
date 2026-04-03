/** Nashville Decoder API client — calls through /api/nd-proxy */

interface NDSearchResult {
  id: string;
  name: string;
  tier?: string;
  credits?: number;
}

interface NDProfile {
  profile: {
    pg_id: string;
    display_name: string;
    [key: string]: unknown;
  };
  social?: {
    instagram?: string;
    twitter?: string;
    facebook?: string;
  } | null;
}

export async function searchND(query: string): Promise<NDSearchResult[]> {
  try {
    const res = await fetch(`/api/nd-proxy?path=${encodeURIComponent(`/api/search?q=${encodeURIComponent(query)}`)}`);
    console.log(`[ND SEARCH] query="${query}" status=${res.status}`);
    if (!res.ok) {
      const body = await res.text();
      console.warn(`[ND SEARCH] FAILED: ${body.slice(0, 200)}`);
      return [];
    }
    const data = await res.json();
    console.log(`[ND SEARCH] results: ${data.results?.length ?? 0}`);
    return data.results || [];
  } catch (e) {
    console.warn(`[ND SEARCH] error:`, e);
    return [];
  }
}

export async function getProfileIG(pgId: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/nd-proxy?path=${encodeURIComponent(`/api/profile/${pgId}`)}`);
    console.log(`[ND PROFILE] pgId="${pgId}" status=${res.status}`);
    if (!res.ok) return null;
    const data: NDProfile = await res.json();
    const handle = data.social?.instagram || null;
    console.log(`[ND PROFILE] instagram=${handle}`);
    return handle;
  } catch {
    return null;
  }
}

export type HandleSource = 'nd' | 'guessed' | 'manual' | 'unknown';

export interface HandleResult {
  artist_name: string;
  handle: string | null;
  source: HandleSource;
  confidence: 'high' | 'medium' | 'low';
  pg_id: string | null;
  loading: boolean;
  confirmed: boolean; // only nd + manual are confirmed
}

/** Resolve an Instagram handle for an artist. Tries ND first, falls back to pattern guess. */
export async function resolveInstagramHandle(artistName: string): Promise<HandleResult> {
  const base = { artist_name: artistName, loading: false };

  // Tier 1: ND database
  try {
    const results = await searchND(artistName);
    if (results.length > 0) {
      const best = results[0];
      const handle = await getProfileIG(best.id);
      if (handle) {
        return {
          ...base,
          handle: `@${handle.replace(/^@/, '')}`,
          source: 'nd',
          confidence: 'high',
          pg_id: best.id,
          confirmed: true,
        };
      }
    }
  } catch {
    // ND unavailable, continue to tier 2
  }

  // Tier 2: Pattern guess (NOT confirmed)
  try {
    const res = await fetch('/api/discover-instagram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artist_name: artistName }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.handle) {
        return {
          ...base,
          handle: `@${data.handle}`,
          source: 'guessed',
          confidence: 'low',
          pg_id: null,
          confirmed: false,
        };
      }
    }
  } catch { /* discovery unavailable */ }

  // Tier 3: Unknown
  return {
    ...base,
    handle: null,
    source: 'unknown',
    confidence: 'low',
    pg_id: null,
    confirmed: false,
  };
}
