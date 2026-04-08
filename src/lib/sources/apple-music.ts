/**
 * Apple Music source adapter.
 * Uses MusicKit JS v3 for user library scanning.
 * Rate limit: ~20 req/s documented, we target 2-3 req/s (conservative).
 *
 * Flow: load SDK → configure → authorize (popup) → fetch library → scan albums
 */

import type { TrackItem } from '../spotify';
import { parseReleaseDate } from '../scan-utils';
import { getDeveloperToken } from '../apple-music';

const MIN_GAP_MS = 400; // 2.5 req/s — conservative for Apple Music
let lastCallTime = 0;

async function enforceGap(): Promise<void> {
  const elapsed = Date.now() - lastCallTime;
  if (elapsed < MIN_GAP_MS) {
    await new Promise(r => setTimeout(r, MIN_GAP_MS - elapsed));
  }
}

/** Check if MusicKit JS is loaded */
export function isMusicKitLoaded(): boolean {
  return typeof window !== 'undefined' && 'MusicKit' in window;
}

/** Load MusicKit JS v3 from Apple CDN */
export function loadMusicKit(): Promise<void> {
  if (isMusicKitLoaded()) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://js-cdn.music.apple.com/musickit/v3/musickit.js';
    script.async = true;
    script.onload = () => {
      document.addEventListener('musickitloaded', () => resolve(), { once: true });
      // If already loaded by the time listener fires
      if (isMusicKitLoaded()) resolve();
    };
    script.onerror = () => reject(new Error('Failed to load MusicKit JS'));
    document.head.appendChild(script);
    // Timeout after 10s
    setTimeout(() => reject(new Error('MusicKit JS load timeout')), 10000);
  });
}

/** Configure and authorize MusicKit. Must be called from a user click. */
export async function configureMusicKit(): Promise<typeof MusicKit.getInstance> {
  await loadMusicKit();
  const token = await getDeveloperToken();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const MK = (window as any).MusicKit;
  await MK.configure({
    developerToken: token,
    app: { name: 'New Music Friday', build: '1.0' },
  });

  return MK.getInstance();
}

/** Authorize the user (opens Apple ID popup). Must be triggered by user click. */
export async function authorizeAppleMusic(): Promise<string> {
  const music = await configureMusicKit();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userToken = await (music as any).authorize();
  return userToken;
}

export interface AppleMusicScanOptions {
  cutoffDate: string;
  onProgress?: (current: number, total: number, releasesFound: number) => void;
  onReleasesFound?: (tracks: TrackItem[]) => void;
}

/**
 * Scan Apple Music library for new releases.
 * Sequential at ~2.5 req/s. Returns TrackItem[] compatible with the pipeline.
 */
export async function scanAppleMusicLibrary(options: AppleMusicScanOptions): Promise<TrackItem[]> {
  const { cutoffDate, onProgress, onReleasesFound } = options;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const MK = (window as any).MusicKit;
  if (!MK) throw new Error('MusicKit not loaded');
  const music = MK.getInstance();

  const allTracks: TrackItem[] = [];
  const seenAlbumIds = new Set<string>();

  // Fetch library artists — paginate with limit 100
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let artists: any[] = [];
  let offset = 0;
  const limit = 100;

  // Verify authorization before scanning
  if (!music.isAuthorized) {
    console.error('[AM SCAN] Not authorized — attempting authorization...');
    try {
      await music.authorize();
    } catch (authErr) {
      throw new Error('Apple Music authorization was declined or failed. Please try again and approve the popup.');
    }
    if (!music.isAuthorized) {
      throw new Error('Apple Music authorization failed. Make sure you have an active Apple Music subscription and approved library access.');
    }
  }
  console.log(`[AM SCAN START] Authorized. musicUserToken length: ${(music.musicUserToken || '').length}. Fetching library artists...`);

  while (true) {
    await enforceGap();
    try {
      // MusicKit v3: music.api.music() returns { data: { data: [...] } }
      // Some versions use music.api.library.artists() instead
      let items: any[] = [];
      try {
        const res = await music.api.music(`/v1/me/library/artists`, { limit, offset });
        lastCallTime = Date.now();
        items = res?.data?.data || res?.data || [];
        console.log(`[AM SCAN] API response at offset ${offset}: ${items.length} items, keys: ${Object.keys(res?.data || {}).join(',')}`);
      } catch (apiErr: any) {
        // Fallback: try the catalog-style fetch
        console.warn(`[AM SCAN] Primary API failed at offset ${offset}:`, apiErr?.message || apiErr);
        try {
          const fallback = await fetch(`https://api.music.apple.com/v1/me/library/artists?limit=${limit}&offset=${offset}`, {
            headers: { 'Authorization': `Bearer ${await getDeveloperToken()}`, 'Music-User-Token': music.musicUserToken },
          });
          if (fallback.ok) {
            const fbData = await fallback.json();
            items = fbData?.data || [];
            console.log(`[AM SCAN] Fallback fetch worked: ${items.length} items`);
          } else {
            console.warn(`[AM SCAN] Fallback fetch failed: ${fallback.status} ${fallback.statusText}`);
          }
        } catch (fbErr) {
          console.warn(`[AM SCAN] Both methods failed at offset ${offset}`);
        }
      }
      if (items.length === 0) break;
      artists = artists.concat(items);
      offset += items.length;
      if (items.length < limit) break;
    } catch (e) {
      console.warn(`[AM SCAN] Error fetching artists at offset ${offset}:`, e);
      break;
    }
  }

  console.log(`[AM SCAN] Found ${artists.length} library artists`);

  // For each library artist, look up their CATALOG ID, then check catalog for new releases
  for (let i = 0; i < artists.length; i++) {
    const artist = artists[i];
    const artistName = artist.attributes?.name || 'Unknown';

    try {
      // Step 1: Get the catalog ID for this library artist
      // Library artists have a different ID than catalog artists
      let catalogArtistId: string | null = null;
      await enforceGap();
      try {
        const catalogLookup = await music.api.music(
          `/v1/me/library/artists/${artist.id}`,
          { include: 'catalog' }
        );
        lastCallTime = Date.now();
        const relationships = catalogLookup?.data?.data?.[0]?.relationships?.catalog?.data;
        if (relationships && relationships.length > 0) {
          catalogArtistId = relationships[0].id;
        }
      } catch {
        // Fallback: search catalog by name
        await enforceGap();
        try {
          const searchRes = await music.api.music(
            `/v1/catalog/us/search`,
            { term: artistName, types: 'artists', limit: 1 }
          );
          lastCallTime = Date.now();
          catalogArtistId = searchRes?.data?.results?.artists?.data?.[0]?.id || null;
        } catch { /* skip this artist */ }
      }

      if (!catalogArtistId) {
        // Can't find catalog entry — skip
        continue;
      }

      // Step 2: Fetch CATALOG albums (all releases, not just what's in user's library)
      await enforceGap();
      const albumRes = await music.api.music(
        `/v1/catalog/us/artists/${catalogArtistId}/albums`,
        { limit: 20 }
      );
      lastCallTime = Date.now();

      const albums = albumRes?.data?.data || [];

      for (const album of albums) {
        const albumId = album.id;
        if (seenAlbumIds.has(albumId)) continue;

        const attrs = album.attributes || {};
        const releaseDate = parseReleaseDate(attrs.releaseDate || '', attrs.releaseDatePrecision);
        if (!releaseDate || releaseDate < cutoffDate) continue;

        seenAlbumIds.add(albumId);
        const artwork = attrs.artwork;
        const coverUrl = artwork
          ? artwork.url.replace('{w}', '640').replace('{h}', '640')
          : '';
        const cover300 = artwork
          ? artwork.url.replace('{w}', '300').replace('{h}', '300')
          : '';

        allTracks.push({
          track_name: attrs.name || albumId,
          track_number: 1,
          track_uri: '',
          track_spotify_url: '',
          track_id: `am_${albumId}`,
          duration_ms: 0,
          explicit: false,
          album_name: attrs.name || '',
          artist_names: artistName,
          artist_id: `am_${artist.id}`,
          artist_spotify_url: '',
          artist_genres: [],
          artist_followers: 0,
          album_type: (attrs.trackCount || 1) === 1 ? 'single' : 'album',
          release_date: releaseDate,
          total_tracks: attrs.trackCount || 1,
          album_spotify_url: '',
          album_spotify_id: `am_${albumId}`,
          cover_art_640: coverUrl,
          cover_art_300: cover300,
          cover_art_64: cover300,
          apple_music_url: attrs.url || '',
        });

        if (onReleasesFound) onReleasesFound([...allTracks]);
      }
    } catch (e) {
      console.warn(`[AM SCAN] Error scanning ${artistName}:`, e);
    }

    onProgress?.(i + 1, artists.length, seenAlbumIds.size);
    if ((i + 1) % 50 === 0) {
      console.log(`[AM SCAN] Processed ${i + 1}/${artists.length} artists, releases=${seenAlbumIds.size}`);
    }
  }

  console.log(`[AM SCAN COMPLETE] ${artists.length} artists, ${allTracks.length} tracks`);
  return allTracks;
}

// MusicKit global type declarations
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace MusicKit {
    function getInstance(): unknown;
    function configure(config: unknown): Promise<void>;
  }
}
