import { describe, it, expect } from 'vitest';

/**
 * Tests for post-scan handle enrichment pipeline.
 * After the Thursday scan, every new artist should have their handle resolved.
 */

interface ScanTrack {
  artist_names: string;
  artist_id: string;
}

/** Extract unique primary artists from scan results */
function extractArtists(tracks: ScanTrack[]): Array<{ name: string; spotifyId: string }> {
  const seen = new Map<string, string>();
  for (const t of tracks) {
    const primary = (t.artist_names || '').split(/,/)[0].trim();
    if (primary && !seen.has(primary.toLowerCase())) {
      seen.set(primary.toLowerCase(), t.artist_id || '');
    }
  }
  return [...seen.entries()].map(([name, id]) => ({ name, spotifyId: id }));
}

/** Filter to artists not in the handle cache */
function filterUncached(
  artists: Array<{ name: string; spotifyId: string }>,
  cache: Set<string>,
): Array<{ name: string; spotifyId: string }> {
  return artists.filter(a => !cache.has(a.name.toLowerCase()));
}

describe('post-scan artist extraction', () => {
  it('extracts unique primary artists from tracks', () => {
    const tracks: ScanTrack[] = [
      { artist_names: 'Lainey Wilson', artist_id: 'id1' },
      { artist_names: 'Lainey Wilson', artist_id: 'id1' },
      { artist_names: 'Morgan Wallen, Post Malone', artist_id: 'id2' },
      { artist_names: 'Ashley Cooke', artist_id: 'id3' },
    ];
    const artists = extractArtists(tracks);
    expect(artists).toHaveLength(3);
    expect(artists.map(a => a.name)).toEqual(['lainey wilson', 'morgan wallen', 'ashley cooke']);
  });

  it('handles empty tracks', () => {
    expect(extractArtists([])).toEqual([]);
  });

  it('deduplicates case-insensitive', () => {
    const tracks: ScanTrack[] = [
      { artist_names: 'LAINEY WILSON', artist_id: 'id1' },
      { artist_names: 'Lainey Wilson', artist_id: 'id1' },
    ];
    expect(extractArtists(tracks)).toHaveLength(1);
  });
});

describe('filter uncached artists', () => {
  it('filters out artists already in cache', () => {
    const artists = [
      { name: 'lainey wilson', spotifyId: 'id1' },
      { name: 'gillian smith', spotifyId: 'id2' },
      { name: 'ashley cooke', spotifyId: 'id3' },
    ];
    const cache = new Set(['lainey wilson', 'ashley cooke']);
    const uncached = filterUncached(artists, cache);
    expect(uncached).toHaveLength(1);
    expect(uncached[0].name).toBe('gillian smith');
  });

  it('returns all when cache is empty', () => {
    const artists = [
      { name: 'artist1', spotifyId: 'id1' },
      { name: 'artist2', spotifyId: 'id2' },
    ];
    expect(filterUncached(artists, new Set())).toHaveLength(2);
  });

  it('returns empty when all cached', () => {
    const artists = [{ name: 'artist1', spotifyId: 'id1' }];
    expect(filterUncached(artists, new Set(['artist1']))).toHaveLength(0);
  });
});
