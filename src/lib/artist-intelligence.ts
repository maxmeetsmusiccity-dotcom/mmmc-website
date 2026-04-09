/**
 * Artist intelligence queries.
 * Infrastructure for publicist tier — data pipeline for:
 * - Release frequency per artist
 * - Collaboration patterns
 * - Showcase appearances
 */

import { supabase } from './supabase';

export interface ArtistIntelligence {
  name: string;
  releaseCount: number;
  recentReleases: string[];
  collaborators: string[];
  showcases: string[];
  releaseFrequency: 'prolific' | 'active' | 'occasional' | 'quiet';
  instagramHandle: string | null;
}

export function computeReleaseFrequency(count: number): ArtistIntelligence['releaseFrequency'] {
  if (count >= 5) return 'prolific';
  if (count >= 3) return 'active';
  if (count >= 1) return 'occasional';
  return 'quiet';
}

export function extractCollaborators(artistName: string, artistNames: string[]): string[] {
  const collabs = new Set<string>();
  for (const names of artistNames) {
    const parts = names.split(/,\s*|\s+feat\.?\s+|\s+ft\.?\s+|\s+x\s+|\s+&\s+/i).map(n => n.trim());
    for (const name of parts) {
      if (name.toLowerCase() !== artistName.toLowerCase() && name.length > 0) {
        collabs.add(name);
      }
    }
  }
  return [...collabs].sort();
}

/**
 * Get intelligence for an artist from the weekly Nashville releases.
 */
export async function getArtistIntelligence(artistName: string): Promise<ArtistIntelligence | null> {
  if (!supabase) return null;

  // Get releases for this artist
  const { data: releases } = await supabase
    .from('weekly_nashville_releases')
    .select('artist_name, track_name, album_name, release_date')
    .ilike('artist_name', `%${artistName}%`)
    .order('release_date', { ascending: false })
    .limit(50);

  if (!releases || releases.length === 0) return null;

  // Get handle
  const { data: handleData } = await supabase
    .from('instagram_handles')
    .select('instagram_handle')
    .ilike('artist_name', artistName)
    .limit(1);

  const uniqueAlbums = [...new Set(releases.map(r => r.album_name))];
  const artistNamesList = releases.map(r => r.artist_name);

  return {
    name: artistName,
    releaseCount: releases.length,
    recentReleases: uniqueAlbums.slice(0, 5),
    collaborators: extractCollaborators(artistName, artistNamesList),
    showcases: [], // Populated from ND data when available
    releaseFrequency: computeReleaseFrequency(uniqueAlbums.length),
    instagramHandle: handleData?.[0]?.instagram_handle || null,
  };
}

/**
 * Get intelligence summary for a list of artists (batch query).
 * Used by the carousel builder to show intel alongside selections.
 */
export async function getBatchIntelligence(artistNames: string[]): Promise<Map<string, ArtistIntelligence>> {
  const results = new Map<string, ArtistIntelligence>();
  if (!supabase || artistNames.length === 0) return results;

  // Batch query all releases mentioning any of these artists
  const { data: releases } = await supabase
    .from('weekly_nashville_releases')
    .select('artist_name, track_name, album_name, release_date')
    .order('release_date', { ascending: false })
    .limit(1000);

  if (!releases) return results;

  // Batch query handles
  const { data: handles } = await supabase
    .from('instagram_handles')
    .select('artist_name, instagram_handle')
    .in('artist_name', artistNames.slice(0, 100));

  const handleMap = new Map((handles || []).map(h => [h.artist_name?.toLowerCase(), h.instagram_handle]));

  for (const name of artistNames) {
    const artistReleases = releases.filter(r =>
      r.artist_name.toLowerCase().includes(name.toLowerCase())
    );
    if (artistReleases.length === 0) continue;

    const uniqueAlbums = [...new Set(artistReleases.map(r => r.album_name))];
    results.set(name, {
      name,
      releaseCount: artistReleases.length,
      recentReleases: uniqueAlbums.slice(0, 5),
      collaborators: extractCollaborators(name, artistReleases.map(r => r.artist_name)),
      showcases: [],
      releaseFrequency: computeReleaseFrequency(uniqueAlbums.length),
      instagramHandle: handleMap.get(name.toLowerCase()) || null,
    });
  }

  return results;
}
