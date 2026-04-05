/**
 * Nashville Releases source — zero-login experience.
 * Fetches this week's Nashville releases from ND Workers API.
 * Converts to TrackItem[] for the standard selection pipeline.
 */

import type { TrackItem } from '../spotify';

const ND_API = 'https://nd-api.nd-api.workers.dev';

export interface NashvilleRelease {
  pg_id: string;
  artist_name: string;
  track_name: string;
  album_name: string;
  release_type: string;
  release_date: string;
  spotify_track_id: string;
  spotify_track_uri?: string;
  spotify_album_id?: string;
  cover_art_url: string;
  cover_art_300: string;
  track_number: number;
  duration_ms: number;
  explicit: boolean;
  total_tracks: number;
  is_charting: boolean;
  chart_name?: string;
  current_position?: number;
  peak_position?: number;
  weeks_on_chart?: number;
  label?: string;
}

export interface WeeklyReleasesResponse {
  week: string;
  releases: NashvilleRelease[];
  total: number;
  generated_at: string | null;
  source: string;
  message?: string;
}

export async function fetchNashvilleReleases(week?: string): Promise<WeeklyReleasesResponse> {
  const params = week ? `?week=${week}` : '';
  const resp = await fetch(`${ND_API}/api/nmf/releases${params}`);
  if (!resp.ok) throw new Error(`Failed to fetch releases: ${resp.status}`);
  return resp.json();
}

/** Convert Nashville releases to TrackItem[] for the standard pipeline */
export function releasesToTrackItems(releases: NashvilleRelease[]): TrackItem[] {
  return releases.map(r => ({
    track_name: r.track_name,
    track_number: r.track_number || 1,
    track_uri: r.spotify_track_uri || `spotify:track:${r.spotify_track_id}`,
    track_spotify_url: r.spotify_track_id ? `https://open.spotify.com/track/${r.spotify_track_id}` : '',
    track_id: r.spotify_track_id || `nd_${r.pg_id}_${r.track_name.replace(/\W/g, '_').slice(0, 30)}`,
    duration_ms: r.duration_ms || 0,
    explicit: r.explicit || false,
    album_name: r.album_name || '',
    artist_names: r.artist_name,
    artist_id: r.pg_id,
    artist_spotify_url: '',
    artist_genres: [],
    artist_followers: 0,
    album_type: r.release_type || 'single',
    release_date: r.release_date || '',
    total_tracks: r.total_tracks || 1,
    album_spotify_url: r.spotify_album_id ? `https://open.spotify.com/album/${r.spotify_album_id}` : '',
    album_spotify_id: r.spotify_album_id || '',
    cover_art_640: r.cover_art_url || '',
    cover_art_300: r.cover_art_300 || r.cover_art_url || '',
    cover_art_64: r.cover_art_300 || r.cover_art_url || '',
  }));
}
