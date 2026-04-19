import { describe, it, expect } from 'vitest';
import { normalizeTrackName } from '../../api/_platform_cache';

describe('normalizeTrackName (M-Z11 track dedup)', () => {
  it('strips " - Single" suffix', () => {
    expect(normalizeTrackName('Jolene - Single')).toBe('jolene');
    expect(normalizeTrackName('Heartbreak Anthem - Single')).toBe('heartbreak anthem');
  });

  it('strips " - EP" suffix', () => {
    expect(normalizeTrackName('Roadmap - EP')).toBe('roadmap');
  });

  it('strips " (Deluxe...)" suffix', () => {
    expect(normalizeTrackName('Jolene (Deluxe Edition)')).toBe('jolene');
    expect(normalizeTrackName('Jolene (Deluxe)')).toBe('jolene');
  });

  it('strips " (Remastered...)" suffix', () => {
    expect(normalizeTrackName('Jolene (Remastered)')).toBe('jolene');
    expect(normalizeTrackName('Jolene (Remastered 2012)')).toBe('jolene');
  });

  it('strips " - Remastered" / " - YYYY Remaster" suffix', () => {
    expect(normalizeTrackName('Jolene - Remastered 2012')).toBe('jolene');
    expect(normalizeTrackName('Jolene - 2012 Remaster')).toBe('jolene');
  });

  it('preserves "Jolene (Live)" as distinct from "Jolene"', () => {
    expect(normalizeTrackName('Jolene (Live)')).toBe('jolene (live)');
    expect(normalizeTrackName('Jolene (Live)')).not.toBe(normalizeTrackName('Jolene'));
  });

  it('preserves "(Acoustic)" / "(Radio Edit)" variants as distinct', () => {
    expect(normalizeTrackName('Jolene (Acoustic)')).toBe('jolene (acoustic)');
    expect(normalizeTrackName('Jolene (Radio Edit)')).toBe('jolene (radio edit)');
  });

  it('is case-insensitive (JOLENE → jolene)', () => {
    expect(normalizeTrackName('JOLENE')).toBe('jolene');
    expect(normalizeTrackName('Jolene')).toBe(normalizeTrackName('JOLENE'));
  });

  it('returns empty string for null/undefined/empty', () => {
    expect(normalizeTrackName(null)).toBe('');
    expect(normalizeTrackName(undefined)).toBe('');
    expect(normalizeTrackName('')).toBe('');
  });

  it('collapses variant suffixes: Jolene family', () => {
    // Canonical dedup target used by downstream (artist_id, nameKey) set.
    const canonical = normalizeTrackName('Jolene');
    expect(normalizeTrackName('Jolene - Single')).toBe(canonical);
    expect(normalizeTrackName('Jolene - EP')).toBe(canonical);
    expect(normalizeTrackName('Jolene (Deluxe Edition)')).toBe(canonical);
    expect(normalizeTrackName('Jolene (Remastered 2020)')).toBe(canonical);
    // And the live cut does NOT collapse into Jolene
    expect(normalizeTrackName('Jolene (Live)')).not.toBe(canonical);
  });

  it('handles whitespace around suffix', () => {
    expect(normalizeTrackName('Jolene   -   Single')).toBe('jolene');
  });

  it('does not over-strip (no false positives)', () => {
    // "Single" appearing elsewhere in the title is not a release variant
    expect(normalizeTrackName('Single Lady')).toBe('single lady');
    expect(normalizeTrackName('Deluxe Memories')).toBe('deluxe memories');
  });
});
