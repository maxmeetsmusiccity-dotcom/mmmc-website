/**
 * Nashville Releases source — zero-login experience.
 * Fetches this week's Nashville releases from ND Workers API.
 * Converts to TrackItem[] for the standard selection pipeline.
 */

import type { TrackItem } from '../spotify';

const ND_API = import.meta.env.VITE_ND_API_URL || 'https://nd-api.nd-api.workers.dev';

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
  composer_name?: string | null;
}

export interface WeeklyReleasesResponse {
  week: string;
  releases: NashvilleRelease[];
  total: number;
  generated_at: string | null;
  source: string;
  message?: string;
}

/** Seed list of Nashville-relevant artists — scanned via Spotify catalog each week */
export const NASHVILLE_SEED_ARTISTS = [
  // Nashville marquee
  'Lainey Wilson', 'Morgan Wallen', 'Luke Combs', 'Chris Stapleton', 'Zach Bryan',
  'Jelly Roll', 'Bailey Zimmerman', 'Cody Johnson', 'Kane Brown', 'Megan Moroney',
  'Parker McCollum', 'Jordan Davis', 'Riley Green', 'Thomas Rhett', 'Keith Urban',
  'Carrie Underwood', 'Miranda Lambert', 'Luke Bryan', 'Jason Aldean', 'Dierks Bentley',
  'Sam Hunt', 'Brett Young', 'Dustin Lynch', 'Jon Pardi', 'Cole Swindell',
  // Rising
  'Ella Langley', 'Tucker Wetmore', 'Nate Smith', 'Shaboozey', 'Dasha',
  'Hailey Whitters', 'Muscadine Bloodline', 'Ian Munsick', 'Dalton Dover', 'Corey Kent',
  'Ashley McBryde', 'Kameron Marlowe', 'Chayce Beckham', 'Dylan Gossett', 'Niko Moon',
  'Conner Smith', 'Jackson Dean', 'Tyler Hubbard', 'Chase Rice', 'Jameson Rodgers',
  'Russell Dickerson', 'Scotty McCreery', 'Lauren Alaina', 'Kelsea Ballerini', 'Gabby Barrett',
  // Nashville active
  'Chloe Collins', 'Ella Boh', 'Kaylee Rose', 'Jordyn Shellhart', 'Madison Parks',
  'Callie Prince', 'Cassidy Daniels', 'Ashley Anne', 'Mackenzie Carpenter', 'Kirstie Kraus',
  'Tiera Kennedy', 'Danielle Bradbery', 'Sam Williams', 'Mason Ramsey', 'Sam Barber',
  'Bonnie Stewart', 'Clever', 'Jake Puliti', 'Brooks Huntley', 'Lockwood Barr',
  'Kylie Morgan', 'Alexandra Kay', 'Priscilla Block', 'Travis Denning', 'Matt Stell',
  'Tyler Rich', 'Michael Ray', 'Drew Parker', 'Ryan Griffin', 'Sean Stemaly',
  'Josh Ross', 'Callista Clark', 'MacKenzie Porter', 'Mickey Guyton', 'Brittney Spencer',
  'Kassi Ashton', 'Caylee Hammack', 'Elvie Shane', 'Frank Ray', 'Restless Road',
  'Tenille Arts', 'Tenille Townes', 'Hannah Ellis', 'Lily Rose', 'Cooper Alan',
  'Breland', 'Blanco Brown', 'ERNEST', 'HARDY', 'Jessie Murph',
  // Song Suffragettes / Nashville Underground
  'Alana Springsteen', 'Payton Smith', 'Tanner Adell', 'Sacha', 'Karley Scott Collins',
  'Renee Blair', 'Tigirlily Gold', 'Madeline Edwards', 'Pillbox Patti', 'Kat Luna',
  'Camille Parker', 'Angie K', 'Tré Burt', 'Nikita Karmen', 'Carter Faith',
  'Reyna Roberts', 'Dee White', 'Early James', 'Fancy Hagood', 'Devon Gilfillian',
  // Whiskey Jam / Writer-Artists
  'Jordan Fletcher', 'Tyler Booth', 'Josh Mirenda', 'Ernest Keith Smith', 'Adam Doleac',
  'Ryan Hurd', 'Canaan Smith', 'Walker Hayes', 'Mitchell Tenpenny', 'Chris Lane',
  'Dylan Scott', 'Michael Hardy', 'Morgan Evans', 'Filmore', 'Brandon Ratcliff',
  // CMA / ACM Circuit
  'Old Dominion', 'Brothers Osborne', 'Midland', 'Flatland Cavalry', 'Turnpike Troubadours',
  'Whiskey Myers', 'Caamp', 'Charley Crockett', 'Tyler Childers', 'Sierra Ferrell',
  'Colter Wall', 'Vincent Neil Emerson', 'Drayton Farley', 'Zach Top', 'Josh Meloy',
];

export async function fetchNashvilleReleases(week?: string): Promise<WeeklyReleasesResponse> {
  // Try ND Workers API first
  try {
    const params = week ? `?week=${week}` : '';
    const resp = await fetch(`${ND_API}/api/nmf/releases${params}`);
    if (resp.ok) {
      const data = await resp.json();
      if (data.releases && data.releases.length > 0) return data;
    }
  } catch { /* ND API not available */ }

  // Fallback: scan seed artists via Spotify catalog
  const batchSize = 50;
  const allReleases: NashvilleRelease[] = [];
  for (let i = 0; i < NASHVILLE_SEED_ARTISTS.length; i += batchSize) {
    const batch = NASHVILLE_SEED_ARTISTS.slice(i, i + batchSize);
    try {
      const resp = await fetch('/api/scan-artists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artistNames: batch }),
      });
      if (resp.ok) {
        const data = await resp.json();
        for (const t of (data.tracks || [])) {
          allReleases.push({
            pg_id: t.artist_id || '',
            artist_name: t.artist_names,
            track_name: t.track_name,
            album_name: t.album_name,
            release_type: t.album_type || 'single',
            release_date: t.release_date,
            spotify_track_id: t.track_id,
            spotify_track_uri: t.track_uri,
            spotify_album_id: t.album_spotify_id,
            cover_art_url: t.cover_art_640,
            cover_art_300: t.cover_art_300,
            track_number: t.track_number || 1,
            duration_ms: t.duration_ms || 0,
            explicit: t.explicit || false,
            total_tracks: t.total_tracks || 1,
            is_charting: false,
          });
        }
      }
    } catch { /* batch failed, continue */ }
  }

  return {
    week: new Date().toISOString().split('T')[0],
    releases: allReleases,
    total: allReleases.length,
    generated_at: new Date().toISOString(),
    source: 'spotify_catalog_scan',
    message: allReleases.length === 0 ? 'No new releases found this week from Nashville artists.' : undefined,
  };
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
    composer_name: r.composer_name || null,
  }));
}
