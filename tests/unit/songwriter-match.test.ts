import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

// Inline the parseComposerNames helper (same logic as api/songwriter-match.ts)
function parseComposerNames(str: string): string[] {
  if (!str?.trim()) return [];
  const skip = new Set(['traditional', 'public domain', 'unknown', 'various', 'n/a']);
  return str.replace(/ & /g, ', ').replace(/\band\b/gi, ',')
    .split(',').map(s => s.trim()).filter(s => s.length >= 2 && !skip.has(s.toLowerCase()));
}

const cachePath = path.join(__dirname, '../../public/data/songwriter_cache.json');
const cache: any = fs.existsSync(cachePath)
  ? JSON.parse(fs.readFileSync(cachePath, 'utf8'))
  : null;

function matchComposers(input: string[]): { matches: any[]; unmatched: string[] } {
  if (!cache) return { matches: [], unmatched: [] };
  const parsedNames = new Set<string>();
  for (const raw of input) {
    for (const name of parseComposerNames(raw)) {
      parsedNames.add(name.toLowerCase().trim());
    }
  }
  const matches: any[] = [];
  const seen = new Set<string>();
  const unmatched: string[] = [];
  for (const key of parsedNames) {
    const target = cache.aliases[key] || key;
    const info = cache.writers[target];
    if (info) {
      if (!seen.has(info.pg_id)) {
        seen.add(info.pg_id);
        matches.push(info);
      }
    } else {
      unmatched.push(key);
    }
  }
  return { matches, unmatched };
}

describe('songwriter-match API logic', () => {
  it('matches Ashley Gorley via alias chain', () => {
    const { matches } = matchComposers(['Ashley Gorley']);
    expect(matches.length).toBeGreaterThan(0);
    const gorley = matches.find(m => m.display_name.toLowerCase().includes('gorley'));
    expect(gorley).toBeTruthy();
    expect(gorley.charting_songs).toBeGreaterThan(100);
    expect(gorley.pg_id).toBe('pg_df752e8c5e64');
  });

  it('parses comma-separated composerName string', () => {
    const { matches } = matchComposers(['Brandon Lake, Lainey Wilson, Emily Weisband & Luke Laird']);
    // At least Lainey Wilson and Luke Laird should match (both in cache with charting > 0)
    const names = matches.map(m => m.display_name);
    expect(names.some((n: string) => n.toLowerCase().includes('luke laird'))).toBe(true);
    expect(names.some((n: string) => n.toLowerCase().includes('lainey'))).toBe(true);
  });

  it('returns unmatched for unknown names', () => {
    const { matches, unmatched } = matchComposers(['Totally Unknown Person 9999']);
    expect(matches).toHaveLength(0);
    expect(unmatched).toContain('totally unknown person 9999');
  });

  it('dedupes by pg_id across multiple inputs', () => {
    const { matches } = matchComposers(['Ashley Gorley', 'Ashley Gorley']);
    const gorleyMatches = matches.filter(m => m.display_name.toLowerCase().includes('gorley'));
    expect(gorleyMatches.length).toBe(1);
  });

  it('filters Traditional / Public Domain', () => {
    const parsed = parseComposerNames('Traditional');
    expect(parsed).toEqual([]);
    const parsed2 = parseComposerNames('Public Domain');
    expect(parsed2).toEqual([]);
  });

  it('handles ampersand-separated names', () => {
    const parsed = parseComposerNames('Ashley Gorley & Luke Laird');
    expect(parsed).toEqual(['Ashley Gorley', 'Luke Laird']);
  });

  it('handles "and" as separator', () => {
    const parsed = parseComposerNames('Ashley Gorley and Luke Laird');
    expect(parsed).toEqual(['Ashley Gorley', 'Luke Laird']);
  });

  it('empty input returns empty', () => {
    const { matches } = matchComposers([]);
    expect(matches).toEqual([]);
  });
});
