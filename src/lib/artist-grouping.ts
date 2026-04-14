import type { ReleaseCluster } from './spotify';

/**
 * Shared artist-grouping types and logic.
 *
 * Both mobile (MobileResultsView) and desktop (NewMusicFriday + ArtistClusterCard)
 * group releases by primary artist using the same regex and bucketing rules.
 * This module is the single source of truth — features (comma / feat. / ft.)
 * are bucketed under the first-listed artist.
 */

export interface ArtistGroup {
  name: string;
  cover: string;
  releases: ReleaseCluster[];
  tracks: import('./spotify').TrackItem[];
  /** Unique key for rubber-band + shift-click iteration (lowercased name). */
  key: string;
  /** Primary release (first in the group) — used for hover / quick look. */
  primary: ReleaseCluster;
  /** Title track of the primary release — default track for bulk operations. */
  primaryTrack: import('./spotify').TrackItem;
}

/** Extract the primary (first-listed) artist from a credit string.
 *  Features (comma / feat. / ft.) stay under the first-listed artist. */
export function primaryArtistOf(s: string): string {
  return (s || '').split(/,|feat\.|ft\./i)[0].trim() || 'Unknown';
}

/** Group releases by primary artist. Preserves insertion order (first-seen). */
export function groupByPrimaryArtist(releases: ReleaseCluster[]): ArtistGroup[] {
  const map = new Map<string, ArtistGroup>();
  for (const r of releases) {
    const name = primaryArtistOf(r.artist_names);
    const key = name.toLowerCase();
    const existing = map.get(key);
    if (existing) {
      existing.releases.push(r);
      existing.tracks.push(...r.tracks);
    } else {
      const primaryTrack = r.tracks.find(t => t.track_id === r.titleTrackId) || r.tracks[0];
      map.set(key, {
        name,
        key,
        cover: r.cover_art_300 || r.cover_art_640 || '',
        releases: [r],
        tracks: [...r.tracks],
        primary: r,
        primaryTrack,
      });
    }
  }
  return [...map.values()];
}
