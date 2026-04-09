/**
 * Enrichment integration — queues new artists for Research Agent enrichment
 * and reads results from the Research Agent's R2 output.
 */

import type { TrackItem } from './spotify';
import { supabase } from './supabase';

/**
 * After a scan, check which artists don't have confirmed handles
 * and queue them for Research Agent enrichment via ND proxy.
 */
export async function queueNewArtistsForEnrichment(tracks: TrackItem[]): Promise<{
  queued: number;
  alreadyCached: number;
  total: number;
}> {
  // Extract unique artist IDs
  const artistMap = new Map<string, { name: string; spotifyId: string }>();
  for (const t of tracks) {
    const primaryName = (t.artist_names || '').split(/,/)[0].trim();
    const id = t.artist_id || primaryName;
    if (id && !artistMap.has(id)) {
      artistMap.set(id, { name: primaryName, spotifyId: t.artist_id || '' });
    }
  }

  const total = artistMap.size;
  if (total === 0 || !supabase) return { queued: 0, alreadyCached: 0, total: 0 };

  // Check which artists already have confirmed handles in cache
  const ids = [...artistMap.keys()];
  const { data: cached } = await supabase
    .from('instagram_handles')
    .select('spotify_artist_id, source')
    .in('spotify_artist_id', ids);

  const confirmedIds = new Set(
    (cached || [])
      .filter(h => h.source?.includes(':confirmed') || h.source === 'manual:confirmed')
      .map(h => h.spotify_artist_id)
  );

  // Filter to artists needing enrichment
  const needsEnrichment = [...artistMap.entries()]
    .filter(([id]) => !confirmedIds.has(id))
    .map(([id, data]) => ({
      pg_id: id,
      display_name: data.name,
      spotify_id: data.spotifyId,
      priority: 'normal',
    }));

  if (needsEnrichment.length === 0) {
    return { queued: 0, alreadyCached: confirmedIds.size, total };
  }

  // Queue via ND proxy → Research Agent batch endpoint
  try {
    const res = await fetch(`/api/nd-proxy?path=${encodeURIComponent('/api/research/batch')}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entities: needsEnrichment.slice(0, 100), // Max 100 per batch
        requested_by: 'nmf_friday_scan',
      }),
    });

    if (res.ok) {
      const data = await res.json();
      return {
        queued: data.added || needsEnrichment.length,
        alreadyCached: confirmedIds.size,
        total,
      };
    }
  } catch {
    // Queue failed — non-critical, handles still resolve from cache
  }

  return { queued: 0, alreadyCached: confirmedIds.size, total };
}

/**
 * Fetch research results from the Research Agent.
 * Returns enrichment data for artists that have been processed.
 */
export async function fetchResearchResults(): Promise<Array<{
  pg_id: string;
  display_name: string;
  instagram?: { handle: string; confidence_label: string; evidence: string };
  intelligence?: { recent_news: Array<{ headline: string; url: string; category: string }> };
}>> {
  try {
    const res = await fetch(`/api/nd-proxy?path=${encodeURIComponent('/api/research/results')}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.results || [];
  } catch {
    return [];
  }
}

/**
 * Check Research Agent status — queue depth, last completed, etc.
 */
export async function getResearchStatus(): Promise<{
  queue_depth: number;
  total_results: number;
  last_completed: string | null;
} | null> {
  try {
    const res = await fetch(`/api/nd-proxy?path=${encodeURIComponent('/api/research/status')}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
