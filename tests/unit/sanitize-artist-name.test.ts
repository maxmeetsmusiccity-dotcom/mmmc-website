import { describe, it, expect } from 'vitest';
import { sanitizeArtistName } from '../../api/_platform_cache';

describe('sanitizeArtistName (M-Z17 upstream prevention)', () => {
  it('auto-fixes wrapping quote+comma (CSV-paste artifact)', () => {
    expect(sanitizeArtistName('"Sheyna Gee",')).toBe('Sheyna Gee');
    expect(sanitizeArtistName('"Miley Cyrus",')).toBe('Miley Cyrus');
  });

  it('rejects empty and whitespace-only', () => {
    expect(sanitizeArtistName('')).toBeNull();
    expect(sanitizeArtistName('   ')).toBeNull();
    expect(sanitizeArtistName('\t\n')).toBeNull();
  });

  it('rejects null/undefined', () => {
    expect(sanitizeArtistName(null)).toBeNull();
    expect(sanitizeArtistName(undefined)).toBeNull();
  });

  it('rejects length > 200 (multi-artist concat)', () => {
    expect(sanitizeArtistName('A'.repeat(201))).toBeNull();
    expect(sanitizeArtistName('A'.repeat(300))).toBeNull();
  });

  it('accepts length exactly 200', () => {
    expect(sanitizeArtistName('A'.repeat(200))).toBe('A'.repeat(200));
  });

  it('preserves legitimate punctuation: quoted stage names', () => {
    expect(sanitizeArtistName('"Weird Al" Yankovic')).toBe('"Weird Al" Yankovic');
    expect(sanitizeArtistName('John "JoJo" Hermann')).toBe('John "JoJo" Hermann');
  });

  it('preserves legitimate punctuation: commas in band names (Goodnight, Texas)', () => {
    expect(sanitizeArtistName('Goodnight, Texas')).toBe('Goodnight, Texas');
    expect(sanitizeArtistName('Earth, Wind & Fire')).toBe('Earth, Wind & Fire');
  });

  it('trims whitespace', () => {
    expect(sanitizeArtistName('  Morgan Wallen  ')).toBe('Morgan Wallen');
  });

  it('rejects auto-fix result that would be empty', () => {
    expect(sanitizeArtistName('"",')).toBeNull();
  });

  it('rejects auto-fix result that would exceed 200 chars', () => {
    const inner = 'A'.repeat(201);
    expect(sanitizeArtistName(`"${inner}",`)).toBeNull();
  });

  it('leaves partial quote+comma untouched (no auto-fix when pattern does not match fully)', () => {
    // Starts with quote but does not end with `",`
    expect(sanitizeArtistName('"foo",bar')).toBe('"foo",bar');
  });
});
