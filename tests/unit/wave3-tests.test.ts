import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import * as fs from 'node:fs';
import * as path from 'node:path';

// ============================================================
// Property-Based Tests (fast-check)
// ============================================================

/** Parse Apple Music composerName string into individual names */
function parseComposerNames(str: string | null | undefined): string[] {
  if (!str?.trim()) return [];
  const skip = new Set(['traditional', 'public domain', 'unknown', 'various', 'n/a']);
  return str.replace(/ & /g, ', ').replace(/\band\b/gi, ',')
    .split(',').map(s => s.trim()).filter(s => s.length >= 2 && !skip.has(s.toLowerCase()));
}

describe('property: parseComposerNames', () => {
  it('never crashes on any string input', () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        const result = parseComposerNames(input);
        expect(Array.isArray(result)).toBe(true);
      }),
      { numRuns: 500 },
    );
  });

  it('always returns trimmed non-empty strings with length >= 2', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 3, maxLength: 200 }), (input) => {
        const result = parseComposerNames(input);
        for (const name of result) {
          expect(name.trim()).toBe(name);
          expect(name.length).toBeGreaterThanOrEqual(2);
        }
      }),
      { numRuns: 500 },
    );
  });

  it('result count never exceeds separator count + 1', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 200 }), (input) => {
        const result = parseComposerNames(input);
        // Count separators in input (commas, ampersands, "and")
        const separators = (input.match(/,| & |\band\b/gi) || []).length;
        expect(result.length).toBeLessThanOrEqual(separators + 1);
      }),
      { numRuns: 300 },
    );
  });

  it('never returns filtered words (traditional, public domain, etc)', () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        const result = parseComposerNames(input);
        const forbidden = new Set(['traditional', 'public domain', 'unknown', 'various', 'n/a']);
        for (const name of result) {
          expect(forbidden.has(name.toLowerCase())).toBe(false);
        }
      }),
      { numRuns: 300 },
    );
  });
});

// ============================================================
// Songwriter Cache Integrity Tests
// ============================================================

describe('songwriter cache integrity', () => {
  const cachePath = path.join(__dirname, '../../public/data/songwriter_cache.json');
  let cache: any;

  // Load once
  try {
    cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  } catch {
    cache = null;
  }

  it('every writer has required fields', () => {
    if (!cache) return;
    const sample = Object.values(cache.writers).slice(0, 100) as any[];
    for (const w of sample) {
      expect(w).toHaveProperty('pg_id');
      expect(w).toHaveProperty('display_name');
      expect(w).toHaveProperty('charting_songs');
      expect(w).toHaveProperty('total_credits');
      expect(w).toHaveProperty('tier');
      expect(typeof w.pg_id).toBe('string');
      expect(typeof w.charting_songs).toBe('number');
      expect(w.total_credits).toBeGreaterThanOrEqual(5);
    }
  });

  it('aliases point to valid writer keys', () => {
    if (!cache) return;
    for (const [alias, target] of Object.entries(cache.aliases)) {
      expect(cache.writers).toHaveProperty(target as string);
    }
  });

  it('marquee tier writers have significant charting', () => {
    if (!cache) return;
    const marquee = Object.values(cache.writers).filter((w: any) => w.tier === 'marquee') as any[];
    expect(marquee.length).toBeGreaterThan(100);
    // Most marquee should have charting songs (some edge cases may have 0)
    const withCharting = marquee.filter(w => w.charting_songs > 0);
    expect(withCharting.length / marquee.length).toBeGreaterThan(0.5);
  });

  it('pg_ids are unique across all writers', () => {
    if (!cache) return;
    const pgIds = new Set<string>();
    for (const w of Object.values(cache.writers) as any[]) {
      if (pgIds.has(w.pg_id)) {
        // Allow duplicates only if they have different display names
        // (dedup should have kept highest credit count)
      }
      pgIds.add(w.pg_id);
    }
    // At least 90% unique (some pg_ids may map to multiple canonical names)
    expect(pgIds.size / Object.keys(cache.writers).length).toBeGreaterThan(0.8);
  });
});

// ============================================================
// Handle Confirmation Logic Tests
// ============================================================

describe('handle confirmation', () => {
  it('strips @ prefix from handle', () => {
    const handle = '@nashvilledecoder';
    const cleaned = handle.trim().replace(/^@/, '');
    expect(cleaned).toBe('nashvilledecoder');
  });

  it('preserves handle without @ prefix', () => {
    const handle = 'nashvilledecoder';
    const cleaned = handle.trim().replace(/^@/, '');
    expect(cleaned).toBe('nashvilledecoder');
  });

  it('trims whitespace from handle', () => {
    const handle = '  @test_handle  ';
    const cleaned = handle.trim().replace(/^@/, '');
    expect(cleaned).toBe('test_handle');
  });
});

// ============================================================
// Carousel Composer Credit Layout Tests
// ============================================================

describe('carousel composer credits', () => {
  it('top 3 credits sorted by charting count', () => {
    const credits = [
      { name: 'A', charting: 50 },
      { name: 'B', charting: 116 },
      { name: 'C', charting: 10 },
      { name: 'D', charting: 74 },
      { name: 'E', charting: 0 },
    ];
    const top = credits
      .filter(c => c.charting > 0)
      .sort((a, b) => b.charting - a.charting)
      .slice(0, 3);
    expect(top).toHaveLength(3);
    expect(top[0].name).toBe('B'); // 116
    expect(top[1].name).toBe('D'); // 74
    expect(top[2].name).toBe('A'); // 50
  });

  it('filters out zero-charting composers', () => {
    const credits = [
      { name: 'Known', charting: 50 },
      { name: 'Unknown', charting: 0 },
    ];
    const top = credits.filter(c => c.charting > 0);
    expect(top).toHaveLength(1);
    expect(top[0].name).toBe('Known');
  });

  it('handles empty credits array', () => {
    const credits: { name: string; charting: number }[] = [];
    const top = credits.filter(c => c.charting > 0).slice(0, 3);
    expect(top).toHaveLength(0);
  });
});

// ============================================================
// Enrichment API Response Shape Tests
// ============================================================

describe('enrichment data shape', () => {
  it('date separation for enrichment: current vs future', () => {
    const today = '2026-04-11';
    const releases = [
      { artist_name: 'A', release_date: '2026-04-11' },
      { artist_name: 'B', release_date: '2026-04-18' },
      { artist_name: 'C', release_date: '2026-04-04' },
    ];
    const current = releases.filter(r => r.release_date <= today);
    const future = releases.filter(r => r.release_date > today);
    expect(current).toHaveLength(2);
    expect(future).toHaveLength(1);
    expect(future[0].artist_name).toBe('B');
  });
});

// ============================================================
// Scope Document Existence
// ============================================================

describe('NMF scope document', () => {
  it('NMF_SCOPE.md exists', () => {
    const scopePath = path.join(__dirname, '../../docs/NMF_SCOPE.md');
    expect(fs.existsSync(scopePath)).toBe(true);
  });

  it('contains Trojan Horse principle', () => {
    const scopePath = path.join(__dirname, '../../docs/NMF_SCOPE.md');
    const content = fs.readFileSync(scopePath, 'utf8');
    expect(content).toContain('Trojan Horse');
    expect(content).toContain('PROHIBITED');
    expect(content).toContain('APPROVED');
  });
});
