/**
 * Manual source: paste artist names, import CSV, or paste URLs.
 * Priority: Python manifest.csv import (zero API calls).
 */

import type { TrackItem } from '../spotify';

/**
 * Parse Max's Python manifest.csv format.
 * Columns: select, artist_name, artist_id, release_name, release_id,
 *          release_type, release_date, track_name, track_id, track_uri,
 *          cover_url, cover_path
 *
 * Groups by release_id to deduplicate album-level entries.
 * Returns TrackItem[] ready for the selection pipeline.
 */
export function parseManifestCSV(csvText: string): TrackItem[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];

  const header = parseCSVRow(lines[0]);
  const colIdx = (name: string) => header.indexOf(name);

  const iArtistName = colIdx('artist_name');
  const iArtistId = colIdx('artist_id');
  const iReleaseName = colIdx('release_name');
  const iReleaseId = colIdx('release_id');
  const iReleaseType = colIdx('release_type');
  const iReleaseDate = colIdx('release_date');
  const iTrackName = colIdx('track_name');
  const iTrackId = colIdx('track_id');
  const iTrackUri = colIdx('track_uri');
  const iCoverUrl = colIdx('cover_url');

  // Validate required columns exist
  if (iArtistName < 0 || iTrackName < 0) {
    throw new Error('CSV must have at least artist_name and track_name columns');
  }

  const tracks: TrackItem[] = [];
  const seenTrackIds = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVRow(lines[i]);
    if (row.length < 2) continue;

    const trackId = (iTrackId >= 0 ? row[iTrackId] : '') || `manual_${i}`;
    if (seenTrackIds.has(trackId)) continue;
    seenTrackIds.add(trackId);

    const artistName = row[iArtistName] || '';
    const trackName = (iTrackName >= 0 ? row[iTrackName] : '') || artistName;
    const albumName = (iReleaseName >= 0 ? row[iReleaseName] : '') || trackName;
    const albumId = (iReleaseId >= 0 ? row[iReleaseId] : '') || `album_${i}`;
    const coverUrl = (iCoverUrl >= 0 ? row[iCoverUrl] : '') || '';

    tracks.push({
      track_name: trackName,
      track_number: 1,
      track_uri: (iTrackUri >= 0 ? row[iTrackUri] : '') || '',
      track_spotify_url: '',
      track_id: trackId,
      duration_ms: 0,
      explicit: false,
      album_name: albumName,
      artist_names: artistName,
      artist_id: (iArtistId >= 0 ? row[iArtistId] : '') || '',
      artist_spotify_url: '',
      artist_genres: [],
      artist_followers: 0,
      album_type: (iReleaseType >= 0 ? row[iReleaseType] : '') || 'single',
      release_date: (iReleaseDate >= 0 ? row[iReleaseDate] : '') || '',
      total_tracks: 1,
      album_spotify_url: '',
      album_spotify_id: albumId,
      cover_art_640: coverUrl,
      cover_art_300: coverUrl,
      cover_art_64: coverUrl,
    });
  }

  return tracks;
}

/**
 * Parse artist names (one per line) into placeholder TrackItem[].
 * These are display-only — no real track data, just artist/name for manual curation.
 */
export function parseArtistNames(text: string): string[] {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
}

/**
 * Parse a CSV row handling quoted fields with commas.
 */
function parseCSVRow(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}
