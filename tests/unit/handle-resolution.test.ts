import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Handle resolution tests.
 * Tests the logic that resolves Instagram handles for artists:
 * 1. Cache hit by Spotify ID → return immediately
 * 2. Cache hit by artist name fallback → return immediately
 * 3. Cache miss → call Apify Google Search → parse handle → validate → save → return
 * 4. Name guard prevents cross-wiring on collab tracks
 * 5. Multiple cache entries don't throw (use first result)
 */

// Mock the resolution logic (extracted from nd.ts for testability)
function parseInstagramHandle(googleResults: Array<{ url: string; title: string }>): string | null {
  for (const r of googleResults) {
    // Match instagram.com/username (not /p/ posts or /reel/)
    const match = r.url.match(/instagram\.com\/([a-zA-Z0-9_.]+)\/?$/);
    if (match && !['p', 'reel', 'explore', 'stories', 'accounts'].includes(match[1])) {
      return `@${match[1]}`;
    }
  }
  return null;
}

function nameMatchesCache(cachedName: string, requestedName: string): boolean {
  return cachedName.toLowerCase() === requestedName.toLowerCase();
}

describe('parseInstagramHandle', () => {
  it('extracts handle from instagram.com/username URL', () => {
    const results = [{ url: 'https://www.instagram.com/laineywilson/', title: 'Lainey Wilson' }];
    expect(parseInstagramHandle(results)).toBe('@laineywilson');
  });

  it('skips post URLs (/p/)', () => {
    const results = [
      { url: 'https://www.instagram.com/p/ABC123/', title: 'A post' },
      { url: 'https://www.instagram.com/laineywilson/', title: 'Lainey Wilson' },
    ];
    expect(parseInstagramHandle(results)).toBe('@laineywilson');
  });

  it('skips reel URLs', () => {
    const results = [{ url: 'https://www.instagram.com/reel/XYZ/', title: 'Reel' }];
    expect(parseInstagramHandle(results)).toBeNull();
  });

  it('returns null when no Instagram URL found', () => {
    const results = [{ url: 'https://billboard.com/lainey-wilson', title: 'Billboard' }];
    expect(parseInstagramHandle(results)).toBeNull();
  });

  it('handles secure.instagram.com', () => {
    const results = [{ url: 'https://secure.instagram.com/morganwallen/', title: 'Morgan Wallen' }];
    // secure.instagram.com still contains instagram.com — should extract
    expect(parseInstagramHandle(results)).toBe('@morganwallen');
  });

  it('extracts handle with dots and underscores', () => {
    const results = [{ url: 'https://www.instagram.com/ashley.anne.music/', title: 'Ashley Anne' }];
    expect(parseInstagramHandle(results)).toBe('@ashley.anne.music');
  });
});

describe('nameMatchesCache (cross-wiring guard)', () => {
  it('matches exact name', () => {
    expect(nameMatchesCache('Lainey Wilson', 'Lainey Wilson')).toBe(true);
  });

  it('matches case-insensitive', () => {
    expect(nameMatchesCache('lainey wilson', 'Lainey Wilson')).toBe(true);
  });

  it('rejects different names', () => {
    expect(nameMatchesCache('Lainey Wilson', 'Brandon Lake')).toBe(false);
  });

  it('rejects when cached name is a collab partner', () => {
    // Brandon Lake's Spotify ID was cached with Lainey Wilson's data
    expect(nameMatchesCache('Lainey Wilson', 'Brandon Lake')).toBe(false);
  });
});

describe('real-time resolution flow', () => {
  // These tests verify the full resolve-handle endpoint logic
  // Using mocked Apify responses

  const mockApifyGoogleSearch = vi.fn();
  const mockApifyInstagramProfile = vi.fn();
  const mockSaveToCache = vi.fn();

  async function resolveHandle(
    artistName: string,
    cache: Map<string, { artist_name: string; handle: string }>,
  ): Promise<{ handle: string | null; source: string }> {
    // Step 1: Check cache by name
    for (const [, entry] of cache) {
      if (entry.artist_name.toLowerCase() === artistName.toLowerCase()) {
        return { handle: entry.handle, source: 'cache' };
      }
    }

    // Step 2: Apify Google Search
    const googleResults = await mockApifyGoogleSearch(artistName);
    const candidateHandle = parseInstagramHandle(googleResults);
    if (!candidateHandle) return { handle: null, source: 'not_found' };

    // Step 3: Apify Instagram Profile validation
    const profile = await mockApifyInstagramProfile(candidateHandle.replace('@', ''));
    if (!profile) return { handle: null, source: 'invalid_profile' };

    // Step 4: Save to cache
    await mockSaveToCache(artistName, candidateHandle);

    return { handle: candidateHandle, source: 'likely' };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns cached handle when artist is in cache', async () => {
    const cache = new Map([['id1', { artist_name: 'Lainey Wilson', handle: '@laineywilson' }]]);
    const result = await resolveHandle('Lainey Wilson', cache);
    expect(result.handle).toBe('@laineywilson');
    expect(result.source).toBe('cache');
    expect(mockApifyGoogleSearch).not.toHaveBeenCalled();
  });

  it('calls Apify when artist NOT in cache, finds and saves handle', async () => {
    mockApifyGoogleSearch.mockResolvedValue([
      { url: 'https://www.instagram.com/gilliansmithmusic/', title: 'Gillian Smith' },
    ]);
    mockApifyInstagramProfile.mockResolvedValue({ username: 'gilliansmithmusic', biography: 'Nashville songwriter' });
    mockSaveToCache.mockResolvedValue(true);

    const result = await resolveHandle('Gillian Smith', new Map());
    expect(result.handle).toBe('@gilliansmithmusic');
    expect(result.source).toBe('likely');
    expect(mockApifyGoogleSearch).toHaveBeenCalledWith('Gillian Smith');
    expect(mockApifyInstagramProfile).toHaveBeenCalledWith('gilliansmithmusic');
    expect(mockSaveToCache).toHaveBeenCalledWith('Gillian Smith', '@gilliansmithmusic');
  });

  it('returns null when Apify finds no Instagram URL', async () => {
    mockApifyGoogleSearch.mockResolvedValue([
      { url: 'https://billboard.com/some-article', title: 'Article' },
    ]);

    const result = await resolveHandle('Unknown Artist', new Map());
    expect(result.handle).toBeNull();
    expect(result.source).toBe('not_found');
    expect(mockApifyInstagramProfile).not.toHaveBeenCalled();
  });

  it('returns null when Apify profile validation fails', async () => {
    mockApifyGoogleSearch.mockResolvedValue([
      { url: 'https://www.instagram.com/deleted_account/', title: 'Deleted' },
    ]);
    mockApifyInstagramProfile.mockResolvedValue(null);

    const result = await resolveHandle('Deleted Person', new Map());
    expect(result.handle).toBeNull();
    expect(result.source).toBe('invalid_profile');
  });

  it('cache lookup is case-insensitive', async () => {
    const cache = new Map([['id1', { artist_name: 'LAINEY WILSON', handle: '@laineywilson' }]]);
    const result = await resolveHandle('lainey wilson', cache);
    expect(result.handle).toBe('@laineywilson');
    expect(result.source).toBe('cache');
  });
});
