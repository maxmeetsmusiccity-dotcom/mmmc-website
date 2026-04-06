import { describe, it, expect } from 'vitest';

// Test the artist name splitting regex used in TagBlocks
const ARTIST_SPLIT = /,\s*|\s+feat\.?\s+|\s+ft\.?\s+|\s+x\s+|\s+&\s+/i;

function splitArtistNames(raw: string): string[] {
  return raw.split(ARTIST_SPLIT).map(n => n.trim()).filter(n => n.length > 0);
}

describe('artist name splitting', () => {
  it('splits comma-separated artists', () => {
    expect(splitArtistNames('Brandon Lake, Lainey Wilson')).toEqual(['Brandon Lake', 'Lainey Wilson']);
  });

  it('splits feat. artists', () => {
    expect(splitArtistNames('Drake feat. Future')).toEqual(['Drake', 'Future']);
    expect(splitArtistNames('Drake feat Future')).toEqual(['Drake', 'Future']);
  });

  it('splits ft. artists', () => {
    expect(splitArtistNames('Post Malone ft. Morgan Wallen')).toEqual(['Post Malone', 'Morgan Wallen']);
    expect(splitArtistNames('Post Malone ft Morgan Wallen')).toEqual(['Post Malone', 'Morgan Wallen']);
  });

  it('splits x collaboration', () => {
    expect(splitArtistNames('Marshmello x Kane Brown')).toEqual(['Marshmello', 'Kane Brown']);
  });

  it('splits & collaboration', () => {
    expect(splitArtistNames('Brooks & Dunn')).toEqual(['Brooks', 'Dunn']);
    expect(splitArtistNames('Thelma & James')).toEqual(['Thelma', 'James']);
  });

  it('handles single artist', () => {
    expect(splitArtistNames('Lainey Wilson')).toEqual(['Lainey Wilson']);
  });

  it('handles complex multi-separator', () => {
    expect(splitArtistNames('Artist A, Artist B feat. Artist C')).toEqual(['Artist A', 'Artist B', 'Artist C']);
  });

  it('trims whitespace', () => {
    expect(splitArtistNames('  Artist A ,  Artist B  ')).toEqual(['Artist A', 'Artist B']);
  });

  it('filters empty strings', () => {
    expect(splitArtistNames('')).toEqual([]);
  });
});
