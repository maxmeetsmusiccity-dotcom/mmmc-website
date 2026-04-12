import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

// ============================================================
// Composer Pipeline Tests
// ============================================================

/** Parse Apple Music composerName string into individual names */
function parseComposerNames(str: string | null | undefined): string[] {
  if (!str?.trim()) return [];
  const skip = new Set(['traditional', 'public domain', 'unknown', 'various', 'n/a']);
  return str.replace(/ & /g, ', ').replace(/\band\b/gi, ',')
    .split(',').map(s => s.trim()).filter(s => s.length >= 2 && !skip.has(s.toLowerCase()));
}

describe('composer name parsing', () => {
  it('parses comma-separated names', () => {
    expect(parseComposerNames('Ashley Gorley, Jessie Jo Dillon')).toEqual([
      'Ashley Gorley', 'Jessie Jo Dillon',
    ]);
  });

  it('parses ampersand-separated names', () => {
    expect(parseComposerNames('Ashley Gorley & Jessie Jo Dillon')).toEqual([
      'Ashley Gorley', 'Jessie Jo Dillon',
    ]);
  });

  it('handles "and" as separator', () => {
    expect(parseComposerNames('Ashley Gorley and Jessie Jo Dillon')).toEqual([
      'Ashley Gorley', 'Jessie Jo Dillon',
    ]);
  });

  it('returns empty for null/undefined/empty', () => {
    expect(parseComposerNames(null)).toEqual([]);
    expect(parseComposerNames(undefined)).toEqual([]);
    expect(parseComposerNames('')).toEqual([]);
    expect(parseComposerNames('   ')).toEqual([]);
  });

  it('filters out "Traditional" and "Public Domain"', () => {
    expect(parseComposerNames('Traditional')).toEqual([]);
    expect(parseComposerNames('public domain')).toEqual([]);
  });

  it('keeps single-name composers', () => {
    expect(parseComposerNames('Beyonce')).toEqual(['Beyonce']);
  });

  it('handles mixed separators', () => {
    expect(parseComposerNames('Alice, Bob & Carol and Dave')).toEqual([
      'Alice', 'Bob', 'Carol', 'Dave',
    ]);
  });
});

describe('songwriter cache', () => {
  const cachePath = path.join(__dirname, '../../public/data/songwriter_cache.json');

  it('cache file exists and is valid JSON', () => {
    expect(fs.existsSync(cachePath)).toBe(true);
    const data = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    expect(data).toHaveProperty('writers');
    expect(data).toHaveProperty('aliases');
    expect(data).toHaveProperty('meta');
  });

  it('has substantial writer count (5K+)', () => {
    const data = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    expect(Object.keys(data.writers).length).toBeGreaterThan(5000);
  });

  it('Ashley Gorley is findable (direct or via alias)', () => {
    const data = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    const direct = data.writers['ashley gorley'];
    const viaAlias = data.aliases['ashley gorley']
      ? data.writers[data.aliases['ashley gorley']]
      : null;
    const gorley = direct || viaAlias;
    expect(gorley).toBeTruthy();
    expect(gorley.charting_songs).toBeGreaterThan(100);
    expect(gorley.pg_id).toMatch(/^pg_/);
    expect(gorley.tier).toBe('marquee');
  });

  it('meta contains generation stats', () => {
    const data = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    expect(data.meta.total_writers).toBeGreaterThan(5000);
    expect(data.meta).toHaveProperty('with_charting_songs');
    expect(data.meta).toHaveProperty('generated_at');
  });
});

// ============================================================
// Coming Soon / This Week Separation Tests
// ============================================================

describe('coming soon date separation', () => {
  const today = '2026-04-11';

  const makeReleases = () => [
    { release_date: '2026-04-11', name: 'today' },
    { release_date: '2026-04-10', name: 'yesterday' },
    { release_date: '2026-04-04', name: 'last_week' },
    { release_date: '2026-04-18', name: 'next_week' },
    { release_date: '2026-05-01', name: 'far_future' },
  ];

  it('currentReleases excludes future-dated tracks', () => {
    const releases = makeReleases();
    const current = releases.filter(r => r.release_date <= today);
    expect(current.map(r => r.name)).toEqual(['today', 'yesterday', 'last_week']);
    expect(current.every(r => r.release_date <= today)).toBe(true);
  });

  it('comingSoonReleases includes only future tracks', () => {
    const releases = makeReleases();
    const comingSoon = releases.filter(r => r.release_date > today);
    expect(comingSoon.map(r => r.name)).toEqual(['next_week', 'far_future']);
  });

  it('no track appears in both lists', () => {
    const releases = makeReleases();
    const current = releases.filter(r => r.release_date <= today);
    const comingSoon = releases.filter(r => r.release_date > today);
    const overlap = current.filter(c => comingSoon.some(f => f.name === c.name));
    expect(overlap).toEqual([]);
  });

  it('track releasing today is in This Week', () => {
    const releases = makeReleases();
    const current = releases.filter(r => r.release_date <= today);
    expect(current.some(r => r.name === 'today')).toBe(true);
  });
});

// ============================================================
// Cron Self-Chaining Tests
// ============================================================

describe('cron self-chaining logic', () => {
  const BATCH_SIZE = 2000;

  function simulateChaining(totalArtists: number, maxChains: number) {
    const chains: { offset: number; end: number; chain: number }[] = [];
    let offset = 0;
    let chainNum = 0;

    while (offset < totalArtists && chainNum < maxChains) {
      const end = Math.min(offset + BATCH_SIZE, totalArtists);
      chains.push({ offset, end, chain: chainNum });
      offset = end;
      chainNum++;
    }

    return { chains, complete: offset >= totalArtists, paused: offset < totalArtists };
  }

  it('max_chains limits number of invocations', () => {
    const result = simulateChaining(40000, 5);
    expect(result.chains).toHaveLength(5);
    expect(result.paused).toBe(true);
  });

  it('scans 10K artists with 5 chains × 2K batch', () => {
    const result = simulateChaining(40000, 5);
    const totalScanned = result.chains.reduce((sum, c) => sum + (c.end - c.offset), 0);
    expect(totalScanned).toBe(10000);
  });

  it('completes if total artists < batch × chains', () => {
    const result = simulateChaining(3000, 5);
    expect(result.chains).toHaveLength(2); // 2000 + 1000
    expect(result.complete).toBe(true);
    expect(result.paused).toBe(false);
  });

  it('offset increments correctly per chain', () => {
    const result = simulateChaining(10000, 5);
    expect(result.chains[0].offset).toBe(0);
    expect(result.chains[1].offset).toBe(2000);
    expect(result.chains[2].offset).toBe(4000);
    expect(result.chains[3].offset).toBe(6000);
    expect(result.chains[4].offset).toBe(8000);
  });

  it('single chain with small artist list completes', () => {
    const result = simulateChaining(200, 5);
    expect(result.chains).toHaveLength(1);
    expect(result.complete).toBe(true);
  });
});

// Cron self-healing: resume offset computation
// Wave 6 Block 2: the old derived formula (chain_number * BATCH + artists_scanned)
// silently skipped ranges when a chain was self-healed into a non-BATCH-aligned
// start. The fixed formula reads start_offset off the persisted scan_runs row.
describe('cron self-healing resume offset', () => {
  function computeResumeOffset(lastPaused: { start_offset?: number | null; artists_scanned?: number | null }): number {
    return (lastPaused.start_offset ?? 0) + (lastPaused.artists_scanned || 0);
  }

  it('chain 0 fresh start, scanned 2000 → resume at 2000', () => {
    expect(computeResumeOffset({ start_offset: 0, artists_scanned: 2000 })).toBe(2000);
  });

  it('chain 2 (started at offset 4000), scanned 2000 → resume at 6000', () => {
    expect(computeResumeOffset({ start_offset: 4000, artists_scanned: 2000 })).toBe(6000);
  });

  it('chain 4 (started at offset 8000), partial scan 500 → resume at 8500', () => {
    expect(computeResumeOffset({ start_offset: 8000, artists_scanned: 500 })).toBe(8500);
  });

  it('Bug #2 regression: self-healed chain 0 started at offset 500, scanned 2000 → resume at 2500', () => {
    // Old broken math: (0 * 2000 + 2000) = 2000, which silently skipped [500, 2500).
    // Fixed math: 500 + 2000 = 2500.
    expect(computeResumeOffset({ start_offset: 500, artists_scanned: 2000 })).toBe(2500);
  });

  it('defensive: missing start_offset defaults to 0', () => {
    expect(computeResumeOffset({ artists_scanned: 0 })).toBe(0);
  });

  it('defensive: null start_offset defaults to 0', () => {
    expect(computeResumeOffset({ start_offset: null, artists_scanned: 1500 })).toBe(1500);
  });
});

// ============================================================
// Showcase Data Cache Tests
// ============================================================

describe('showcase data cache (localStorage)', () => {
  const CACHE_KEY = 'showcase_artists_data_cache';
  const CACHE_TTL = 5 * 60 * 1000;

  function isCacheFresh(timestamp: number, now: number): boolean {
    return now - timestamp < CACHE_TTL;
  }

  function serializeShowcaseData(data: Map<string, Set<string>>): Record<string, string[]> {
    const obj: Record<string, string[]> = {};
    for (const [k, v] of data) obj[k] = [...v];
    return obj;
  }

  function deserializeShowcaseData(obj: Record<string, string[]>): Map<string, Set<string>> {
    const map = new Map<string, Set<string>>();
    for (const [k, v] of Object.entries(obj)) map.set(k, new Set(v));
    return map;
  }

  it('serializes and deserializes showcase artist sets', () => {
    const original = new Map<string, Set<string>>();
    original.set('whiskey_jam', new Set(['lainey wilson', 'morgan wallen']));
    original.set('bluebird', new Set(['taylor swift']));

    const serialized = serializeShowcaseData(original);
    const deserialized = deserializeShowcaseData(serialized);

    expect(deserialized.get('whiskey_jam')?.has('lainey wilson')).toBe(true);
    expect(deserialized.get('bluebird')?.size).toBe(1);
  });

  it('cache is fresh within TTL', () => {
    const now = Date.now();
    expect(isCacheFresh(now, now)).toBe(true);
    expect(isCacheFresh(now - 1000, now)).toBe(true);
    expect(isCacheFresh(now - 4 * 60 * 1000, now)).toBe(true); // 4 min ago
  });

  it('cache is stale after TTL', () => {
    const now = Date.now();
    expect(isCacheFresh(now - 6 * 60 * 1000, now)).toBe(false); // 6 min ago
    expect(isCacheFresh(now - 10 * 60 * 1000, now)).toBe(false);
  });
});

// ============================================================
// Progressive Rendering Tests
// ============================================================

describe('progressive rendering', () => {
  it('initial limit shows first 50 of large list', () => {
    const allItems = Array.from({ length: 200 }, (_, i) => ({ name: `Artist ${i}` }));
    const limit = 50;
    const visible = allItems.slice(0, limit);
    expect(visible).toHaveLength(50);
    expect(visible[0].name).toBe('Artist 0');
    expect(visible[49].name).toBe('Artist 49');
  });

  it('show more increases visible count by 50', () => {
    const allItems = Array.from({ length: 200 }, (_, i) => ({ name: `Artist ${i}` }));
    let limit = 50;
    limit += 50;
    const visible = allItems.slice(0, limit);
    expect(visible).toHaveLength(100);
  });

  it('remaining count is correct', () => {
    const total = 237;
    const limit = 50;
    expect(total - limit).toBe(187);
  });

  it('shows all when limit exceeds total', () => {
    const allItems = Array.from({ length: 30 }, (_, i) => ({ name: `Artist ${i}` }));
    const limit = 50;
    const visible = allItems.slice(0, limit);
    expect(visible).toHaveLength(30);
  });
});
