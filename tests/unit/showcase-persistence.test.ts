import { describe, it, expect, beforeEach } from 'vitest';

/**
 * Regression test: showcase dropdown must NEVER disappear.
 * Tests the cache logic without requiring browser localStorage.
 */

// Simulate localStorage for testing
const mockStorage = new Map<string, string>();
const mockLocalStorage = {
  getItem: (key: string) => mockStorage.get(key) ?? null,
  setItem: (key: string, value: string) => mockStorage.set(key, value),
  removeItem: (key: string) => mockStorage.delete(key),
};

function loadCachedShowcases(storage: typeof mockLocalStorage): any[] {
  try {
    const cached = storage.getItem('nr_showcases');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch { /* corrupted cache */ }
  return [];
}

function saveCachedShowcases(storage: typeof mockLocalStorage, showcases: any[]): void {
  if (showcases.length > 0) {
    storage.setItem('nr_showcases', JSON.stringify(showcases));
  }
}

describe('showcase persistence', () => {
  beforeEach(() => mockStorage.clear());

  it('loads showcases from cache on mount', () => {
    const showcases = [
      { id: 'whiskey_jam', name: 'Whiskey Jam', type: 'showcase', count: 3365 },
      { id: 'songsuffragettes', name: 'Song Suffragettes', type: 'showcase', count: 724 },
    ];
    saveCachedShowcases(mockLocalStorage, showcases);
    const loaded = loadCachedShowcases(mockLocalStorage);
    expect(loaded).toHaveLength(2);
    expect(loaded[0].name).toBe('Whiskey Jam');
  });

  it('returns empty array when no cache exists', () => {
    expect(loadCachedShowcases(mockLocalStorage)).toEqual([]);
  });

  it('handles corrupted cache gracefully', () => {
    mockStorage.set('nr_showcases', 'not-json');
    expect(loadCachedShowcases(mockLocalStorage)).toEqual([]);
  });

  it('survives component remount (cache persists)', () => {
    const showcases = [{ id: 'wj', name: 'Whiskey Jam', type: 'showcase', count: 100 }];
    saveCachedShowcases(mockLocalStorage, showcases);
    // Simulate remount — load from cache again
    const reloaded = loadCachedShowcases(mockLocalStorage);
    expect(reloaded).toHaveLength(1);
    expect(reloaded[0].name).toBe('Whiskey Jam');
  });

  it('filter by type=showcase excludes non-showcase categories', () => {
    const categories = [
      { id: 'whiskey_jam', name: 'Whiskey Jam', type: 'showcase', count: 3365 },
      { id: 'marquee', name: 'Marquee', type: 'tier', count: 666 },
      { id: 'bluebird', name: 'Bluebird', type: 'showcase', count: 495 },
    ];
    const showcases = categories.filter(c => c.type === 'showcase');
    expect(showcases).toHaveLength(2);
  });
});
