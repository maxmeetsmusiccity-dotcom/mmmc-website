import { describe, it, expect } from 'vitest';
import { parseManifestCSV } from '../../src/lib/sources/manual';

const SAMPLE_CSV = `select,artist_name,artist_id,release_name,release_id,release_type,release_date,track_name,track_id,track_uri,cover_url,cover_path
,Sam Barber,abc123,Straight and Narrow,rel001,album,2026-04-04,Straight and Narrow,t001,spotify:track:t001,https://i.scdn.co/image/abc,/local/path
,Sam Barber,abc123,Straight and Narrow,rel001,album,2026-04-04,Born To Lose,t002,spotify:track:t002,https://i.scdn.co/image/abc,/local/path
,"Luke Grimes, feat. Someone",def456,Bein' Country,rel002,single,2026-04-04,"Bein' Country",t003,spotify:track:t003,https://i.scdn.co/image/def,/local/path`;

describe('parseManifestCSV', () => {
  it('parses valid manifest.csv rows', () => {
    const tracks = parseManifestCSV(SAMPLE_CSV);
    expect(tracks).toHaveLength(3);
  });

  it('maps fields correctly', () => {
    const tracks = parseManifestCSV(SAMPLE_CSV);
    const t = tracks[0];
    expect(t.artist_names).toBe('Sam Barber');
    expect(t.artist_id).toBe('abc123');
    expect(t.album_name).toBe('Straight and Narrow');
    expect(t.album_spotify_id).toBe('rel001');
    expect(t.album_type).toBe('album');
    expect(t.release_date).toBe('2026-04-04');
    expect(t.track_name).toBe('Straight and Narrow');
    expect(t.track_id).toBe('t001');
    expect(t.track_uri).toBe('spotify:track:t001');
    expect(t.cover_art_640).toBe('https://i.scdn.co/image/abc');
  });

  it('handles commas inside quotes', () => {
    const tracks = parseManifestCSV(SAMPLE_CSV);
    const t = tracks[2];
    expect(t.artist_names).toBe('Luke Grimes, feat. Someone');
    expect(t.track_name).toBe("Bein' Country");
  });

  it('deduplicates by track_id', () => {
    const dupeCSV = `artist_name,track_name,track_id
Artist A,Song 1,t001
Artist A,Song 1,t001
Artist B,Song 2,t002`;
    const tracks = parseManifestCSV(dupeCSV);
    expect(tracks).toHaveLength(2);
  });

  it('groups tracks by release_id for album clustering', () => {
    const tracks = parseManifestCSV(SAMPLE_CSV);
    // Two tracks from rel001 (Sam Barber album), one from rel002 (Luke Grimes single)
    const albums = new Set(tracks.map(t => t.album_spotify_id));
    expect(albums.size).toBe(2);
    const samBarberTracks = tracks.filter(t => t.album_spotify_id === 'rel001');
    expect(samBarberTracks).toHaveLength(2);
  });

  it('ignores cover_path (local paths useless for web)', () => {
    const tracks = parseManifestCSV(SAMPLE_CSV);
    // cover_path should NOT appear anywhere in the track data
    expect(JSON.stringify(tracks)).not.toContain('/local/path');
  });

  it('preserves track_uri for playlist push', () => {
    const tracks = parseManifestCSV(SAMPLE_CSV);
    expect(tracks[0].track_uri).toBe('spotify:track:t001');
    expect(tracks[2].track_uri).toBe('spotify:track:t003');
  });

  it('throws on missing required columns', () => {
    expect(() => parseManifestCSV('col_a,col_b\nval1,val2')).toThrow('artist_name');
  });

  it('returns empty for header-only CSV', () => {
    expect(parseManifestCSV('artist_name,track_name')).toEqual([]);
  });
});
