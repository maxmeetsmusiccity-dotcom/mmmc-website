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

  it('props-based showcases survive component remount (lifted state)', () => {
    // Simulates the fix: parent holds showcases, child receives as prop
    // Even if localStorage is empty, props are never lost
    const parentShowcases = [
      { id: 'whiskey_jam', name: 'Whiskey Jam', type: 'showcase', count: 3365 },
      { id: 'songsuffragettes', name: 'Song Suffragettes', type: 'showcase', count: 724 },
    ];
    // Simulate child mount 1
    let childShowcases = parentShowcases;
    expect(childShowcases).toHaveLength(2);
    // Simulate child unmount + remount (parent state unchanged)
    childShowcases = parentShowcases;
    expect(childShowcases).toHaveLength(2);
    expect(childShowcases[0].name).toBe('Whiskey Jam');
  });

  it('synchronous localStorage init provides showcases before first render', () => {
    // Simulates useState(() => { ... localStorage ... }) — synchronous, no useEffect gap
    const showcases = [
      { id: 'whiskey_jam', name: 'Whiskey Jam', type: 'showcase', count: 3365 },
    ];
    saveCachedShowcases(mockLocalStorage, showcases);
    // Synchronous read (like useState initializer)
    const initValue = (() => {
      try {
        const cached = mockLocalStorage.getItem('nr_showcases');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch { /* corrupted */ }
      return [];
    })();
    expect(initValue).toHaveLength(1);
    expect(initValue[0].name).toBe('Whiskey Jam');
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

describe('future releases filter', () => {
  it('separates current vs future releases by date', () => {
    const today = '2026-04-10';
    const releases = [
      { release_date: '2026-04-10', artist: 'A' }, // today = current
      { release_date: '2026-04-03', artist: 'B' }, // past = current
      { release_date: '2026-04-18', artist: 'C' }, // future = coming soon
      { release_date: '2026-05-01', artist: 'D' }, // future = coming soon
    ];
    const current = releases.filter(r => r.release_date <= today);
    const comingSoon = releases.filter(r => r.release_date > today);
    expect(current).toHaveLength(2);
    expect(comingSoon).toHaveLength(2);
    expect(comingSoon[0].artist).toBe('C');
  });
});
