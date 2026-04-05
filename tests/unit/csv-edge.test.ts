import { describe, it, expect } from 'vitest';
import { parseManifestCSV } from '../../src/lib/sources/manual';

describe('CSV import edge cases', () => {
  it('handles header-only CSV', () => {
    expect(parseManifestCSV('artist_name,track_name\n')).toEqual([]);
  });

  it('handles empty string', () => {
    expect(parseManifestCSV('')).toEqual([]);
  });

  it('handles Unicode artist names', () => {
    const csv = 'artist_name,track_name\nBjörk,Army of Me\nSigur Rós,Hoppípolla';
    const result = parseManifestCSV(csv);
    expect(result.length).toBe(2);
    expect(result[0].artist_names).toBe('Björk');
    expect(result[1].artist_names).toBe('Sigur Rós');
  });

  it('handles quoted fields with commas', () => {
    const csv = 'artist_name,track_name\n"Wilson, Luke",Beer\n"Bryan, Zach",Highway';
    const result = parseManifestCSV(csv);
    expect(result.length).toBe(2);
    expect(result[0].artist_names).toBe('Wilson, Luke');
  });

  it('skips empty rows', () => {
    const csv = 'artist_name,track_name\nArtist1,Track1\n\n\nArtist2,Track2\n';
    const result = parseManifestCSV(csv);
    expect(result.length).toBe(2);
  });

  it('deduplicates by track_id', () => {
    const csv = 'artist_name,track_name,track_id\nA,T,id1\nB,U,id1\nC,V,id2';
    const result = parseManifestCSV(csv);
    expect(result.length).toBe(2);
  });

  it('throws on missing required columns', () => {
    expect(() => parseManifestCSV('foo,bar\n1,2')).toThrow();
  });

  it('handles full manifest format', () => {
    const csv = 'select,artist_name,artist_id,release_name,release_id,release_type,release_date,track_name,track_id,track_uri,cover_url,cover_path\n1,Lainey Wilson,abc,Bell Bottom Country,def,album,2024-10-18,Heart Like a Truck,ghi,spotify:track:ghi,https://example.com/art.jpg,/local/path';
    const result = parseManifestCSV(csv);
    expect(result.length).toBe(1);
    expect(result[0].artist_names).toBe('Lainey Wilson');
    expect(result[0].track_name).toBe('Heart Like a Truck');
    expect(result[0].cover_art_640).toBe('https://example.com/art.jpg');
  });
});
