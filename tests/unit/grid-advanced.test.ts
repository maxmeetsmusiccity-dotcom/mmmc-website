import { describe, it, expect } from 'vitest';
import { getGridsForCount, autoSplit, suggestBetterCounts, getGridById, countGridOptions } from '../../src/lib/grid-layouts';

describe('grid layouts advanced', () => {
  it('count 1 has exact 1x1', () => {
    const opts = getGridsForCount(1);
    expect(opts.exact.length).toBe(1);
    expect(opts.exact[0].id).toBe('1x1');
  });
  it('count 2 has exact grids', () => {
    const opts = getGridsForCount(2);
    expect(opts.exact.length).toBeGreaterThan(0);
  });
  it('count 7 (prime) has no exact grids besides 1xN/Nx1', () => {
    const opts = getGridsForCount(7);
    const multiDim = opts.exact.filter(g => g.columns > 1 && g.rows > 1);
    expect(multiDim.length).toBe(0);
  });
  it('count 8 has logo variant (3x3-1)', () => {
    const opts = getGridsForCount(8);
    expect(opts.logo.length).toBeGreaterThan(0);
  });
  it('count 9 has exact 3x3', () => {
    const opts = getGridsForCount(9);
    const g = opts.exact.find(g => g.id === '3x3');
    expect(g).toBeTruthy();
  });
  it('count 50 has options', () => {
    expect(countGridOptions(50)).toBeGreaterThan(0);
  });
  it('autoSplit divides 16 by 8 into 2 groups', () => {
    const splits = autoSplit(16, 8);
    expect(splits.length).toBe(2);
    expect(splits[0]).toEqual({ start: 0, end: 8 });
    expect(splits[1]).toEqual({ start: 8, end: 16 });
  });
  it('autoSplit handles remainder', () => {
    const splits = autoSplit(10, 8);
    expect(splits.length).toBe(2);
    expect(splits[1]).toEqual({ start: 8, end: 10 });
  });
  it('suggestBetterCounts returns suggestions for prime 11', () => {
    const suggestions = suggestBetterCounts(11);
    expect(suggestions.length).toBeGreaterThan(0);
  });
  it('getGridById finds existing grid', () => {
    const grid = getGridById(9, '3x3');
    expect(grid).toBeTruthy();
    expect(grid?.columns).toBe(3);
  });
  it('getGridById returns null for nonexistent', () => {
    expect(getGridById(9, 'nonexistent')).toBeNull();
  });
  it('count 13 (prime) still has close-fit options', () => {
    const opts = getGridsForCount(13);
    expect(opts.close.length).toBeGreaterThan(0);
  });
});
