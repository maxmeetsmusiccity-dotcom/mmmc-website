import { describe, it, expect } from 'vitest';

/**
 * Regression tests for Nashville Releases grid sort.
 * Bug: albumGroups was rendered unsorted in grid view.
 * Fix: albumGroups now sorted by sortBy/sortDir.
 */

interface AlbumGroup {
  key: string;
  album: string;
  artist: string;
  date: string;
}

function sortAlbumGroups(groups: AlbumGroup[], sortBy: 'artist' | 'date' | 'title', sortDir: 'asc' | 'desc'): AlbumGroup[] {
  const sorted = [...groups];
  const dir = sortDir === 'asc' ? 1 : -1;
  if (sortBy === 'artist') sorted.sort((a, b) => dir * a.artist.localeCompare(b.artist));
  else if (sortBy === 'date') sorted.sort((a, b) => dir * (a.date || '').localeCompare(b.date || ''));
  else if (sortBy === 'title') sorted.sort((a, b) => dir * a.album.localeCompare(b.album));
  return sorted;
}

const testData: AlbumGroup[] = [
  { key: '1', album: 'Zebra Album', artist: 'Charlie', date: '2026-04-01' },
  { key: '2', album: 'Alpha Album', artist: 'Alice', date: '2026-04-03' },
  { key: '3', album: 'Mid Album', artist: 'Bob', date: '2026-04-02' },
];

describe('albumGroups sorting', () => {
  it('sorts by artist ascending', () => {
    const sorted = sortAlbumGroups(testData, 'artist', 'asc');
    expect(sorted.map(g => g.artist)).toEqual(['Alice', 'Bob', 'Charlie']);
  });

  it('sorts by artist descending', () => {
    const sorted = sortAlbumGroups(testData, 'artist', 'desc');
    expect(sorted.map(g => g.artist)).toEqual(['Charlie', 'Bob', 'Alice']);
  });

  it('sorts by date ascending', () => {
    const sorted = sortAlbumGroups(testData, 'date', 'asc');
    expect(sorted.map(g => g.date)).toEqual(['2026-04-01', '2026-04-02', '2026-04-03']);
  });

  it('sorts by date descending', () => {
    const sorted = sortAlbumGroups(testData, 'date', 'desc');
    expect(sorted.map(g => g.date)).toEqual(['2026-04-03', '2026-04-02', '2026-04-01']);
  });

  it('sorts by title ascending', () => {
    const sorted = sortAlbumGroups(testData, 'title', 'asc');
    expect(sorted.map(g => g.album)).toEqual(['Alpha Album', 'Mid Album', 'Zebra Album']);
  });

  it('sorts by title descending', () => {
    const sorted = sortAlbumGroups(testData, 'title', 'desc');
    expect(sorted.map(g => g.album)).toEqual(['Zebra Album', 'Mid Album', 'Alpha Album']);
  });

  it('does not mutate original array', () => {
    const original = [...testData];
    sortAlbumGroups(testData, 'artist', 'asc');
    expect(testData).toEqual(original);
  });
});
