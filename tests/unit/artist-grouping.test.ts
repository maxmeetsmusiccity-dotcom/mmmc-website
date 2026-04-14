import { describe, it, expect } from 'vitest';
import { primaryArtistOf, groupByPrimaryArtist } from '../../src/lib/artist-grouping';
import type { ReleaseCluster, TrackItem } from '../../src/lib/spotify';

// Minimal track/release factories for testing
const makeTrack = (id: string, artist: string, overrides?: Partial<TrackItem>): TrackItem => ({
  track_id: id,
  track_name: `Track ${id}`,
  artist_names: artist,
  album_spotify_id: `album_${id}`,
  album_name: `Album ${id}`,
  album_type: 'single',
  track_number: 1,
  duration_ms: 200000,
  explicit: false,
  cover_art_640: 'https://img/640.jpg',
  cover_art_300: 'https://img/300.jpg',
  cover_art_64: 'https://img/64.jpg',
  release_date: '2026-04-11',
  total_tracks: 1,
  artist_id: `artist_${id}`,
  ...overrides,
} as TrackItem);

const makeRelease = (id: string, artist: string, tracks?: TrackItem[]): ReleaseCluster => {
  const t = tracks ?? [makeTrack(id, artist)];
  return {
    album_spotify_id: `album_${id}`,
    album_name: `Album ${id}`,
    album_type: 'single',
    release_date: '2026-04-11',
    artist_names: artist,
    total_tracks: t.length,
    cover_art_640: 'https://img/640.jpg',
    cover_art_300: 'https://img/300.jpg',
    cover_art_64: 'https://img/64.jpg',
    album_spotify_url: `https://open.spotify.com/album/${id}`,
    isSingle: true,
    tracks: t,
    titleTrackId: t[0].track_id,
  };
};

describe('primaryArtistOf', () => {
  it('extracts the first-listed artist before comma', () => {
    expect(primaryArtistOf('Luke Combs, Morgan Wallen')).toBe('Luke Combs');
  });

  it('extracts the first-listed artist before feat.', () => {
    expect(primaryArtistOf('Jelly Roll feat. Lainey Wilson')).toBe('Jelly Roll');
  });

  it('extracts the first-listed artist before ft.', () => {
    expect(primaryArtistOf('Post Malone ft. Morgan Wallen')).toBe('Post Malone');
  });

  it('handles case-insensitive Feat.', () => {
    expect(primaryArtistOf('Hardy FEAT. Lainey Wilson')).toBe('Hardy');
  });

  it('returns the full name when no features', () => {
    expect(primaryArtistOf('Chris Stapleton')).toBe('Chris Stapleton');
  });

  it('returns Unknown for empty string', () => {
    expect(primaryArtistOf('')).toBe('Unknown');
  });

  it('handles null-ish input', () => {
    expect(primaryArtistOf(null as any)).toBe('Unknown');
    expect(primaryArtistOf(undefined as any)).toBe('Unknown');
  });
});

describe('groupByPrimaryArtist', () => {
  it('groups releases by primary artist name', () => {
    const releases = [
      makeRelease('1', 'Luke Combs'),
      makeRelease('2', 'Luke Combs, Morgan Wallen'),
      makeRelease('3', 'Jelly Roll'),
    ];
    const groups = groupByPrimaryArtist(releases);
    expect(groups).toHaveLength(2);
    expect(groups[0].name).toBe('Luke Combs');
    expect(groups[0].releases).toHaveLength(2);
    expect(groups[1].name).toBe('Jelly Roll');
    expect(groups[1].releases).toHaveLength(1);
  });

  it('is case-insensitive on keys but preserves original-case name', () => {
    const releases = [
      makeRelease('1', 'HARDY'),
      makeRelease('2', 'Hardy feat. Lainey Wilson'),
    ];
    const groups = groupByPrimaryArtist(releases);
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe('hardy');
    expect(groups[0].name).toBe('HARDY'); // preserves first-seen casing
    expect(groups[0].releases).toHaveLength(2);
  });

  it('sets primary and primaryTrack from first release', () => {
    const track = makeTrack('t1', 'Ava', { track_id: 'title_track' });
    const release = makeRelease('r1', 'Ava', [track]);
    release.titleTrackId = 'title_track';
    const groups = groupByPrimaryArtist([release]);
    expect(groups[0].primary).toBe(release);
    expect(groups[0].primaryTrack.track_id).toBe('title_track');
  });

  it('accumulates tracks across multiple releases', () => {
    const t1 = makeTrack('t1', 'Maren Morris');
    const t2 = makeTrack('t2', 'Maren Morris');
    const t3 = makeTrack('t3', 'Maren Morris');
    const releases = [
      makeRelease('r1', 'Maren Morris', [t1]),
      makeRelease('r2', 'Maren Morris', [t2, t3]),
    ];
    const groups = groupByPrimaryArtist(releases);
    expect(groups[0].tracks).toHaveLength(3);
    expect(groups[0].tracks.map(t => t.track_id)).toEqual(['t1', 't2', 't3']);
  });

  it('preserves insertion order', () => {
    const releases = [
      makeRelease('1', 'Zach Bryan'),
      makeRelease('2', 'Ashley McBryde'),
      makeRelease('3', 'Kacey Musgraves'),
    ];
    const groups = groupByPrimaryArtist(releases);
    expect(groups.map(g => g.name)).toEqual(['Zach Bryan', 'Ashley McBryde', 'Kacey Musgraves']);
  });

  it('returns empty array for empty input', () => {
    expect(groupByPrimaryArtist([])).toEqual([]);
  });

  it('uses release cover_art over track cover_art', () => {
    const track = makeTrack('t1', 'Test', { cover_art_300: 'track_300.jpg' });
    const release = makeRelease('r1', 'Test', [track]);
    release.cover_art_300 = 'release_300.jpg';
    const groups = groupByPrimaryArtist([release]);
    expect(groups[0].cover).toBe('release_300.jpg');
  });
});
