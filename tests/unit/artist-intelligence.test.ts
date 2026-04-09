import { describe, it, expect } from 'vitest';

/**
 * Tests for artist intelligence data queries.
 * Infrastructure for the paid publicist tier — data pipeline starts now.
 */

interface ArtistRelease {
  artist_name: string;
  track_name: string;
  album_name: string;
  release_date: string;
}

interface ArtistIntelligence {
  name: string;
  releaseCount: number;
  recentReleases: string[];
  collaborators: string[];
  showcases: string[];
  releaseFrequency: 'prolific' | 'active' | 'occasional' | 'quiet';
}

/** Compute release frequency label from release count in last 90 days */
function computeReleaseFrequency(releasesLast90Days: number): ArtistIntelligence['releaseFrequency'] {
  if (releasesLast90Days >= 5) return 'prolific';
  if (releasesLast90Days >= 3) return 'active';
  if (releasesLast90Days >= 1) return 'occasional';
  return 'quiet';
}

/** Extract unique collaborators from multi-artist tracks */
function extractCollaborators(artistName: string, releases: ArtistRelease[]): string[] {
  const collabs = new Set<string>();
  for (const r of releases) {
    const names = r.artist_name.split(/,\s*|\s+feat\.?\s+|\s+ft\.?\s+|\s+x\s+|\s+&\s+/i).map(n => n.trim());
    for (const name of names) {
      if (name.toLowerCase() !== artistName.toLowerCase() && name.length > 0) {
        collabs.add(name);
      }
    }
  }
  return [...collabs].sort();
}

/** Build intelligence summary for an artist */
function buildIntelligence(
  artistName: string,
  releases: ArtistRelease[],
  showcases: string[],
): ArtistIntelligence {
  const artistReleases = releases.filter(r =>
    r.artist_name.toLowerCase().includes(artistName.toLowerCase())
  );
  return {
    name: artistName,
    releaseCount: artistReleases.length,
    recentReleases: [...new Set(artistReleases.map(r => r.album_name))],
    collaborators: extractCollaborators(artistName, artistReleases),
    showcases,
    releaseFrequency: computeReleaseFrequency(artistReleases.length),
  };
}

describe('computeReleaseFrequency', () => {
  it('prolific: 5+ releases', () => expect(computeReleaseFrequency(5)).toBe('prolific'));
  it('active: 3-4 releases', () => expect(computeReleaseFrequency(3)).toBe('active'));
  it('occasional: 1-2 releases', () => expect(computeReleaseFrequency(1)).toBe('occasional'));
  it('quiet: 0 releases', () => expect(computeReleaseFrequency(0)).toBe('quiet'));
});

describe('extractCollaborators', () => {
  it('extracts collaborators from comma-separated names', () => {
    const releases: ArtistRelease[] = [
      { artist_name: 'Brandon Lake, Lainey Wilson', track_name: 'Song', album_name: 'Album', release_date: '2026-04-01' },
    ];
    expect(extractCollaborators('Brandon Lake', releases)).toEqual(['Lainey Wilson']);
  });

  it('extracts from feat. syntax', () => {
    const releases: ArtistRelease[] = [
      { artist_name: 'Morgan Wallen feat. Post Malone', track_name: 'Song', album_name: 'Album', release_date: '2026-04-01' },
    ];
    expect(extractCollaborators('Morgan Wallen', releases)).toEqual(['Post Malone']);
  });

  it('handles multiple collaborators across tracks', () => {
    const releases: ArtistRelease[] = [
      { artist_name: 'Artist A, Artist B', track_name: 'S1', album_name: 'A1', release_date: '2026-04-01' },
      { artist_name: 'Artist A, Artist C', track_name: 'S2', album_name: 'A2', release_date: '2026-04-01' },
    ];
    expect(extractCollaborators('Artist A', releases)).toEqual(['Artist B', 'Artist C']);
  });

  it('returns empty for solo tracks', () => {
    const releases: ArtistRelease[] = [
      { artist_name: 'Solo Artist', track_name: 'Song', album_name: 'Album', release_date: '2026-04-01' },
    ];
    expect(extractCollaborators('Solo Artist', releases)).toEqual([]);
  });

  it('deduplicates collaborators', () => {
    const releases: ArtistRelease[] = [
      { artist_name: 'A, B', track_name: 'S1', album_name: 'A1', release_date: '2026-04-01' },
      { artist_name: 'A, B', track_name: 'S2', album_name: 'A2', release_date: '2026-04-01' },
    ];
    expect(extractCollaborators('A', releases)).toEqual(['B']);
  });
});

describe('buildIntelligence', () => {
  const releases: ArtistRelease[] = [
    { artist_name: 'Lainey Wilson', track_name: 'Hang Tight Honey', album_name: 'Whirlwind', release_date: '2026-04-01' },
    { artist_name: 'Lainey Wilson', track_name: 'Countrys Cool Again', album_name: 'Whirlwind', release_date: '2026-04-01' },
    { artist_name: 'Lainey Wilson, Brandon Lake', track_name: 'The Jesus I Know Now', album_name: 'Single', release_date: '2026-03-28' },
    { artist_name: 'Other Artist', track_name: 'Other Song', album_name: 'Other', release_date: '2026-04-01' },
  ];

  it('counts releases for the target artist', () => {
    const intel = buildIntelligence('Lainey Wilson', releases, ['Song Suffragettes']);
    expect(intel.releaseCount).toBe(3);
  });

  it('extracts unique album names', () => {
    const intel = buildIntelligence('Lainey Wilson', releases, []);
    expect(intel.recentReleases).toEqual(['Whirlwind', 'Single']);
  });

  it('finds collaborators', () => {
    const intel = buildIntelligence('Lainey Wilson', releases, []);
    expect(intel.collaborators).toEqual(['Brandon Lake']);
  });

  it('includes showcases', () => {
    const intel = buildIntelligence('Lainey Wilson', releases, ['Song Suffragettes', 'Whiskey Jam']);
    expect(intel.showcases).toEqual(['Song Suffragettes', 'Whiskey Jam']);
  });

  it('computes release frequency', () => {
    const intel = buildIntelligence('Lainey Wilson', releases, []);
    expect(intel.releaseFrequency).toBe('active'); // 3 releases
  });
});
