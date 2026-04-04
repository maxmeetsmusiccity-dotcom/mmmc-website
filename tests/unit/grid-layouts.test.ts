import { describe, it, expect } from 'vitest';
import { getGridsForCount, countGridOptions, suggestBetterCounts, autoSplit } from '../../src/lib/grid-layouts';

describe('getGridsForCount', () => {
  it('generates exact grids for 4 (2x2)', () => {
    const opts = getGridsForCount(4);
    const ids = opts.exact.map(g => g.id);
    expect(ids).toContain('2x2');
    expect(ids).toContain('4x1');
    expect(ids).toContain('1x4');
    opts.exact.forEach(g => expect(g.emptyCount).toBe(0));
  });

  it('generates exact grids for 12 (2x6, 3x4, 4x3, 6x2)', () => {
    const opts = getGridsForCount(12);
    const ids = opts.exact.map(g => g.id);
    expect(ids).toContain('2x6');
    expect(ids).toContain('3x4');
    expect(ids).toContain('4x3');
    expect(ids).toContain('6x2');
  });

  it('generates logo variants for 8 (3x3_logo)', () => {
    const opts = getGridsForCount(8);
    const logoIds = opts.logo.map(g => g.id);
    expect(logoIds).toContain('3x3_logo');
    opts.logo.forEach(g => {
      expect(g.hasLogo).toBe(true);
      expect(g.logoIndex).toBeGreaterThanOrEqual(0);
      expect(g.trackSlots).toBe(8);
    });
  });

  it('generates close-fit grids for 7 (2x4 with 1 empty)', () => {
    const opts = getGridsForCount(7);
    const closeIds = opts.close.map(g => g.id);
    expect(closeIds.some(id => id.includes('2x4') || id.includes('4x2'))).toBe(true);
    opts.close.forEach(g => expect(g.emptyCount).toBeGreaterThan(0));
  });

  it('generates mosaic for 6 (mosaic_3x3)', () => {
    const opts = getGridsForCount(6);
    expect(opts.mosaic.length).toBeGreaterThan(0);
    opts.mosaic.forEach(g => expect(g.category).toBe('mosaic'));
  });

  it('generates options for prime number 11', () => {
    const opts = getGridsForCount(11);
    // Exact: 1x11 and 11x1 are >10 cols/rows so likely empty or just 1
    // But close-fit should have options
    const total = countGridOptions(11);
    expect(total).toBeGreaterThan(0);
    expect(opts.close.length).toBeGreaterThan(0);
  });

  it('handles count=1', () => {
    const opts = getGridsForCount(1);
    expect(opts.exact.length).toBe(1);
    expect(opts.exact[0].name).toContain('Feature');
  });

  it('handles count=50', () => {
    const total = countGridOptions(50);
    expect(total).toBeGreaterThan(0);
  });
});

describe('suggestBetterCounts', () => {
  it('suggests counts near 7 with better options', () => {
    const suggestions = suggestBetterCounts(7);
    expect(suggestions).toContain(8); // 8 has 2x4, 4x2, etc
    expect(suggestions).toContain(6); // 6 has 2x3, 3x2
  });

  it('suggestions are within 1-50 range', () => {
    const suggestions = suggestBetterCounts(1);
    suggestions.forEach(s => expect(s).toBeGreaterThanOrEqual(1));
  });
});

describe('autoSplit', () => {
  it('splits 16 tracks into 2 groups of 8', () => {
    const splits = autoSplit(16, 8);
    expect(splits).toEqual([
      { start: 0, end: 8 },
      { start: 8, end: 16 },
    ]);
  });

  it('handles uneven split (10 tracks, 4 per slide)', () => {
    const splits = autoSplit(10, 4);
    expect(splits).toEqual([
      { start: 0, end: 4 },
      { start: 4, end: 8 },
      { start: 8, end: 10 },
    ]);
  });

  it('single slide for small count', () => {
    const splits = autoSplit(3, 4);
    expect(splits).toEqual([{ start: 0, end: 3 }]);
  });
});
