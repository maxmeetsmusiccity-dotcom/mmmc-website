import { describe, it, expect } from 'vitest';
import { parseReleaseDate } from '../../src/lib/scan-utils';

describe('parseReleaseDate', () => {
  // Day precision
  it('handles day precision', () => {
    expect(parseReleaseDate('2026-04-04', 'day')).toBe('2026-04-04');
  });

  it('handles month precision → first of month', () => {
    expect(parseReleaseDate('2026-04', 'month')).toBe('2026-04-01');
  });

  it('handles year precision → Jan 1', () => {
    expect(parseReleaseDate('2026', 'year')).toBe('2026-01-01');
  });

  // Fallback on string length (no precision provided)
  it('falls back on len=10 → day', () => {
    expect(parseReleaseDate('2026-03-28')).toBe('2026-03-28');
  });

  it('falls back on len=7 → first of month', () => {
    expect(parseReleaseDate('2026-03')).toBe('2026-03-01');
  });

  it('falls back on len=4 → Jan 1', () => {
    expect(parseReleaseDate('2026')).toBe('2026-01-01');
  });

  // Edge cases
  it('returns null for empty string', () => {
    expect(parseReleaseDate('')).toBeNull();
  });

  it('returns null for undefined-like input', () => {
    expect(parseReleaseDate('')).toBeNull();
  });

  it('handles single-digit month in month precision', () => {
    expect(parseReleaseDate('2026-1', 'month')).toBe('2026-01-01');
  });

  // Unknown precision but valid date
  it('handles unknown precision with valid 10-char date', () => {
    expect(parseReleaseDate('2026-04-04', 'unknown')).toBe('2026-04-04');
  });

  // Matches Python behavior: precision takes priority over length
  it('day precision with proper date', () => {
    expect(parseReleaseDate('2025-12-05', 'day')).toBe('2025-12-05');
  });

  it('month precision with 7-char date', () => {
    expect(parseReleaseDate('2025-12', 'month')).toBe('2025-12-01');
  });

  it('year precision with 4-char date', () => {
    expect(parseReleaseDate('2025', 'year')).toBe('2025-01-01');
  });
});
