import { describe, it, expect } from 'vitest';

// Test the font size extraction regex used in neonText
function extractPxSize(font: string): number {
  const pxMatch = font.match(/(\d+(?:\.\d+)?)px/);
  return pxMatch ? parseFloat(pxMatch[1]) : 48;
}

describe('neonText font size extraction', () => {
  it('extracts px from "700 48px Helvetica"', () => {
    expect(extractPxSize('700 48px Helvetica')).toBe(48);
  });

  it('extracts px from "italic 600 28px DM Sans"', () => {
    expect(extractPxSize('italic 600 28px DM Sans')).toBe(28);
  });

  it('extracts px from "700 56px Source Serif 4, Georgia, serif"', () => {
    expect(extractPxSize('700 56px "Source Serif 4", Georgia, serif')).toBe(56);
  });

  it('extracts decimal px from "400 12.5px sans-serif"', () => {
    expect(extractPxSize('400 12.5px sans-serif')).toBe(12.5);
  });

  it('falls back to 48 for malformed font string', () => {
    expect(extractPxSize('bold large Helvetica')).toBe(48);
  });

  it('does NOT extract weight as size', () => {
    // The old parseInt would have grabbed 700 from this string
    const result = extractPxSize('700 52px DM Sans');
    expect(result).toBe(52);
    expect(result).not.toBe(700);
  });
});
