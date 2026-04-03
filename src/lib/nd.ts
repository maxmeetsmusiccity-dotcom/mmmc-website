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
  const res = await fetch(`/api/nd-proxy?path=${encodeURIComponent(`/api/search?q=${encodeURIComponent(query)}`)}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.results || [];
}

export async function getProfileIG(pgId: string): Promise<string | null> {
  const res = await fetch(`/api/nd-proxy?path=${encodeURIComponent(`/api/profile/${pgId}`)}`);
  if (!res.ok) return null;
  const data: NDProfile = await res.json();
  return data.social?.instagram || null;
}

export interface HandleResult {
  artist_name: string;
  handle: string | null;
  source: 'nd_database' | 'nmf_auto_discover' | 'nmf_manual' | 'unknown';
  confidence: 'high' | 'medium' | 'low';
  pg_id: string | null;
  loading: boolean;
}

/** Resolve an Instagram handle for an artist. Tries ND first, falls back to auto-discovery. */
export async function resolveInstagramHandle(artistName: string): Promise<HandleResult> {
  // Step 1: Search ND for the artist
  const results = await searchND(artistName);
  if (results.length > 0) {
    const best = results[0];
    // Step 2: Check if profile has Instagram handle
    const handle = await getProfileIG(best.id);
    if (handle) {
      return {
        artist_name: artistName,
        handle: `@${handle.replace(/^@/, '')}`,
        source: 'nd_database',
        confidence: 'high',
        pg_id: best.id,
        loading: false,
      };
    }

    // Step 3: Auto-discover
    const discoverRes = await fetch('/api/discover-instagram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artist_name: artistName }),
    });
    if (discoverRes.ok) {
      const data = await discoverRes.json();
      if (data.handle) {
        return {
          artist_name: artistName,
          handle: `@${data.handle}`,
          source: 'nmf_auto_discover',
          confidence: data.confidence,
          pg_id: best.id,
          loading: false,
        };
      }
    }
  }

  return {
    artist_name: artistName,
    handle: null,
    source: 'unknown',
    confidence: 'low',
    pg_id: null,
    loading: false,
  };
}
