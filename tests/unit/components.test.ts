import { describe, it, expect } from 'vitest';
import type { SelectionSlot } from '../../src/lib/selection';
import type { ReleaseCluster, TrackItem } from '../../src/lib/spotify';

/**
 * Tests for component logic from TrackSuggestions.tsx.
 * Since TrackSuggestions is a React component, we extract and test its
 * core suggestion-scoring algorithm here without rendering.
 */

// ---------- Re-implement the suggestion logic from TrackSuggestions.tsx ----------

function computeSuggestions(
  releases: ReleaseCluster[],
  selections: SelectionSlot[],
): ReleaseCluster[] {
  if (selections.length < 3) return [];

  const selectedArtists = new Set(
    selections.map(s => (s.track.artist_names || '').split(/,/)[0].trim().toLowerCase())
  );
  const selectedTrackIds = new Set(selections.map(s => s.track.track_id));

  const scored = releases
    .filter(r => !r.tracks.every(t => selectedTrackIds.has(t.track_id)))
    .map(r => {
      const primaryArtist = r.artist_names.split(/,/)[0].trim().toLowerCase();
      let score = 0;
      if (!selectedArtists.has(primaryArtist)) score += 10;
      if (r.isSingle) score += 2;
      if (r.tracks[0]?.release_date) score += 1;
      return { release: r, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return scored.map(s => s.release);
}

// ---------- Helpers ----------

function makeTrack(overrides: Partial<TrackItem> = {}): TrackItem {
  return {
    track_name: 'Test Track',
    track_number: 1,
    track_uri: '',
    track_spotify_url: '',
    track_id: `tid-${Math.random().toString(36).slice(2, 8)}`,
    duration_ms: 200000,
    explicit: false,
    album_name: 'Test Album',
    artist_names: 'Test Artist',
    artist_id: 'aid1',
    artist_spotify_url: '',
    artist_genres: [],
    artist_followers: 0,
    album_type: 'single',
    release_date: '2026-04-04',
    total_tracks: 1,
    album_spotify_url: '',
    album_spotify_id: 'alb1',
    cover_art_640: '',
    cover_art_300: '',
    cover_art_64: '',
    ...overrides,
  };
}

function makeRelease(
  artistNames: string,
  trackId: string,
  isSingle = true,
): ReleaseCluster {
  const track = makeTrack({ track_id: trackId, artist_names: artistNames });
  return {
    album_spotify_id: `alb-${trackId}`,
    album_name: `Album for ${trackId}`,
    album_type: isSingle ? 'single' : 'album',
    release_date: '2026-04-04',
    artist_names: artistNames,
    total_tracks: 1,
    cover_art_640: '',
    cover_art_300: '',
    cover_art_64: '',
    album_spotify_url: '',
    isSingle,
    tracks: [track],
    titleTrackId: trackId,
  };
}

function makeSlot(trackId: string, artistNames: string): SelectionSlot {
  return {
    track: makeTrack({ track_id: trackId, artist_names: artistNames }),
    albumId: `alb-${trackId}`,
    selectionNumber: 1,
    slideGroup: 1,
    positionInSlide: 1,
    isCoverFeature: false,
  };
}

// ---------- Tests ----------

describe('TrackSuggestions — returns null / empty when selections < 3', () => {
  it('returns empty array when selections is empty', () => {
    const releases = [makeRelease('Artist A', 'r1')];
    expect(computeSuggestions(releases, [])).toEqual([]);
  });

  it('returns empty array when selections has 1 item', () => {
    const releases = [makeRelease('Artist A', 'r1')];
    const selections = [makeSlot('sel1', 'Artist X')];
    expect(computeSuggestions(releases, selections)).toEqual([]);
  });

  it('returns empty array when selections has 2 items', () => {
    const releases = [makeRelease('Artist A', 'r1')];
    const selections = [
      makeSlot('sel1', 'Artist X'),
      makeSlot('sel2', 'Artist Y'),
    ];
    expect(computeSuggestions(releases, selections)).toEqual([]);
  });

  it('returns suggestions when selections has exactly 3 items', () => {
    const releases = [makeRelease('Artist New', 'r1')];
    const selections = [
      makeSlot('sel1', 'Artist X'),
      makeSlot('sel2', 'Artist Y'),
      makeSlot('sel3', 'Artist Z'),
    ];
    const result = computeSuggestions(releases, selections);
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns suggestions when selections has many items', () => {
    const releases = [makeRelease('Fresh Artist', 'r1')];
    const selections = Array.from({ length: 10 }, (_, i) =>
      makeSlot(`sel${i}`, `Artist ${i}`)
    );
    const result = computeSuggestions(releases, selections);
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('TrackSuggestions — scoring and prioritization', () => {
  it('prioritizes artists not already selected (diversity boost)', () => {
    const selections = [
      makeSlot('sel1', 'Selected Artist'),
      makeSlot('sel2', 'Another Selected'),
      makeSlot('sel3', 'Third Selected'),
    ];
    const releases = [
      makeRelease('Selected Artist', 'r1', true),   // already selected artist
      makeRelease('Brand New Artist', 'r2', false),  // new artist, album (not single)
    ];
    const result = computeSuggestions(releases, selections);
    // New artist should come first despite not being a single
    expect(result[0].artist_names).toBe('Brand New Artist');
  });

  it('gives slight boost to singles over albums', () => {
    const selections = [
      makeSlot('sel1', 'A'),
      makeSlot('sel2', 'B'),
      makeSlot('sel3', 'C'),
    ];
    // Both new artists, but one is a single and one is an album
    const releases = [
      makeRelease('New Artist Album', 'r1', false),
      makeRelease('New Artist Single', 'r2', true),
    ];
    const result = computeSuggestions(releases, selections);
    // Single should rank higher
    expect(result[0].artist_names).toBe('New Artist Single');
  });

  it('filters out releases where all tracks are already selected', () => {
    const selections = [
      makeSlot('already-selected', 'Artist A'),
      makeSlot('sel2', 'Artist B'),
      makeSlot('sel3', 'Artist C'),
    ];
    const releases = [
      makeRelease('Artist A', 'already-selected'),  // all tracks selected
      makeRelease('Artist D', 'not-selected'),       // has unselected tracks
    ];
    const result = computeSuggestions(releases, selections);
    expect(result.every(r => r.tracks.some(t => t.track_id !== 'already-selected'))).toBe(true);
  });

  it('returns at most 5 suggestions', () => {
    const selections = [
      makeSlot('sel1', 'A'),
      makeSlot('sel2', 'B'),
      makeSlot('sel3', 'C'),
    ];
    const releases = Array.from({ length: 20 }, (_, i) =>
      makeRelease(`Artist ${i}`, `r${i}`)
    );
    const result = computeSuggestions(releases, selections);
    expect(result.length).toBeLessThanOrEqual(5);
  });

  it('returns fewer than 5 when fewer unselected releases exist', () => {
    const selections = [
      makeSlot('sel1', 'A'),
      makeSlot('sel2', 'B'),
      makeSlot('sel3', 'C'),
    ];
    const releases = [
      makeRelease('New Artist', 'r1'),
      makeRelease('Another New', 'r2'),
    ];
    const result = computeSuggestions(releases, selections);
    expect(result).toHaveLength(2);
  });

  it('returns empty when all releases are fully selected', () => {
    const selections = [
      makeSlot('r1', 'A'),
      makeSlot('r2', 'B'),
      makeSlot('r3', 'C'),
    ];
    const releases = [
      makeRelease('A', 'r1'),
      makeRelease('B', 'r2'),
      makeRelease('C', 'r3'),
    ];
    const result = computeSuggestions(releases, selections);
    expect(result).toEqual([]);
  });
});

describe('TrackSuggestions — artist name matching', () => {
  it('matches artists case-insensitively', () => {
    const selections = [
      makeSlot('sel1', 'Morgan Wallen'),
      makeSlot('sel2', 'B'),
      makeSlot('sel3', 'C'),
    ];
    const releases = [
      makeRelease('morgan wallen', 'r1'),  // lowercase, same artist
      makeRelease('Fresh Artist', 'r2'),
    ];
    const result = computeSuggestions(releases, selections);
    // Fresh Artist should rank higher (diversity boost)
    expect(result[0].artist_names).toBe('Fresh Artist');
  });

  it('uses only the primary artist (before comma) for matching', () => {
    const selections = [
      makeSlot('sel1', 'Main Artist, Featured Guest'),
      makeSlot('sel2', 'B'),
      makeSlot('sel3', 'C'),
    ];
    const releases = [
      makeRelease('Main Artist', 'r1'),     // same primary artist
      makeRelease('Featured Guest', 'r2'),   // only a featured guest in selections
    ];
    const result = computeSuggestions(releases, selections);
    // "Featured Guest" as a primary artist in releases should be treated as new
    expect(result[0].artist_names).toBe('Featured Guest');
  });
});
