import { useState, memo, useEffect } from 'react';
import type { ReleaseCluster, TrackItem } from '../lib/spotify';
import type { SelectionSlot } from '../lib/selection';
import { formatDuration } from '../lib/utils';

// Wave 7 Block 9 — desktop artist-grouped tile. Mirrors ClusterCard's
// interaction contract (click, modal, cover-feature star, rubber-band
// attribute) but represents one PRIMARY ARTIST with one or more releases
// instead of one album/release cluster. Features (comma / feat. / ft.)
// are bucketed under the first-listed artist upstream in NewMusicFriday,
// so every instance of this component represents one act and all their
// current-week releases.

export interface ArtistGroup {
  name: string;
  cover: string;
  releases: ReleaseCluster[];
  tracks: TrackItem[];
  /** Unique key for rubber-band + shift-click iteration (lowercased name). */
  key: string;
  /** Primary release (first in the group) — used for hover / quick look
      and for the "title track" default when rubber-banding. */
  primary: ReleaseCluster;
  /** Title track of the primary release — the default track added when
      the user rubber-bands or shift-clicks this tile in bulk. */
  primaryTrack: TrackItem;
}

interface Props {
  artist: ArtistGroup;
  /** All selection slots whose track belongs to any of this artist's
      releases. Empty when no selection from this artist. */
  selectedSlots: SelectionSlot[];
  /** Max global selection ordinal among the selectedSlots — rendered as
      the "#X" badge top-right. Null when no selection. */
  maxOrdinal: number | null;
  hasSelections: boolean;
  onSelectRelease: (cluster: ReleaseCluster, trackId?: string) => void;
  onDeselect: (albumId: string, trackId?: string) => void;
  onSetCoverFeature: (trackId: string) => void;
  featureCount?: number;
  onHover?: (cluster: ReleaseCluster | null) => void;
}

export default memo(function ArtistClusterCard({
  artist,
  selectedSlots,
  maxOrdinal,
  hasSelections,
  onSelectRelease,
  onDeselect,
  onSetCoverFeature,
  featureCount,
  onHover,
}: Props) {
  const [showModal, setShowModal] = useState(false);

  const selectedCount = selectedSlots.length;
  const isSelected = selectedCount > 0;
  const selectedTrackIds = new Set(selectedSlots.map(s => s.track.track_id));
  // The slot we treat as "primary" for the cover-feature star: the
  // most-recently-picked slot from this artist. Falls back to the first
  // slot so the star has something to anchor to.
  const primarySlot = selectedSlots.length > 0
    ? selectedSlots.reduce((max, s) => s.selectionNumber > max.selectionNumber ? s : max, selectedSlots[0])
    : null;

  const isSingleTrackArtist = artist.tracks.length === 1 && artist.releases.length === 1;

  const handleCardClick = () => {
    if (isSingleTrackArtist) {
      const t = artist.tracks[0];
      if (selectedTrackIds.has(t.track_id)) {
        onDeselect(artist.releases[0].album_spotify_id, t.track_id);
      } else {
        onSelectRelease(artist.releases[0], t.track_id);
      }
      return;
    }
    // Multi-release OR multi-track artist: open the modal.
    setShowModal(true);
  };

  const handleTrackClick = (e: React.MouseEvent, cluster: ReleaseCluster, track: TrackItem) => {
    e.stopPropagation();
    if (selectedTrackIds.has(track.track_id)) {
      onDeselect(cluster.album_spotify_id, track.track_id);
    } else {
      onSelectRelease(cluster, track.track_id);
    }
  };

  // Close modal on Escape
  useEffect(() => {
    if (!showModal) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowModal(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showModal]);

  // featureCount is informational on the tile caption.
  void featureCount;

  return (
    <>
      <div
        className={`card selectable ${isSelected ? 'selected' : ''} ${hasSelections && !isSelected ? 'has-selections' : ''}`}
        style={{ padding: 0, overflow: 'hidden', position: 'relative' }}
        data-artist-key={artist.key}
        data-primary-album-id={artist.primary.album_spotify_id}
        onMouseEnter={() => onHover?.(artist.primary)}
        onMouseLeave={() => onHover?.(null)}
      >
        {/* Split selection badges — matches mobile + ClusterCard pattern.
            Top-left: K/M count. Top-right: #X ordinal. */}
        {isSelected && (
          <>
            <div
              data-testid="artist-card-badge-count"
              style={{
                position: 'absolute', top: 6, left: 6, zIndex: 2,
                background: 'var(--gold)', color: 'var(--midnight)',
                fontSize: 'var(--fs-3xs)', fontWeight: 700,
                padding: '2px 8px', borderRadius: 999, lineHeight: 1.2,
                boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
                fontFamily: 'var(--font-mono)',
              }}>
              {selectedCount}/{artist.tracks.length}
            </div>
            {maxOrdinal !== null && (
              <div
                data-testid="artist-card-badge-ordinal"
                style={{
                  position: 'absolute', top: 6, right: 6, zIndex: 2,
                  background: 'var(--midnight)', color: 'var(--gold)',
                  border: '1px solid var(--gold)',
                  fontSize: 'var(--fs-3xs)', fontWeight: 700,
                  padding: '2px 8px', borderRadius: 999, lineHeight: 1.2,
                  boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
                  fontFamily: 'var(--font-mono)',
                }}>
                #{maxOrdinal}
              </div>
            )}
          </>
        )}

        {/* Cover art */}
        <div
          onClick={handleCardClick}
          style={{ position: 'relative', paddingBottom: '100%', background: 'var(--midnight)', cursor: 'pointer' }}
        >
          <img
            src={artist.cover || '/placeholder-album.svg'}
            alt={`${artist.name} cover`}
            loading="lazy"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => {
              e.currentTarget.src = '/placeholder-album.svg';
              e.currentTarget.onerror = null;
            }}
          />
          {/* Cover feature star — bottom-right of the cover art, inside
              the square image so it doesn't collide with any badges. */}
          {isSelected && primarySlot && (
            <button
              onClick={(e) => { e.stopPropagation(); onSetCoverFeature(primarySlot.track.track_id); }}
              style={{
                position: 'absolute', bottom: 6, right: 6, zIndex: 10,
                background: primarySlot.isCoverFeature ? 'var(--gold)' : 'rgba(0,0,0,0.6)',
                border: `2px solid ${primarySlot.isCoverFeature ? 'var(--gold)' : 'rgba(255,255,255,0.3)'}`,
                borderRadius: '50%', width: 32, height: 32,
                color: primarySlot.isCoverFeature ? 'var(--midnight)' : 'white',
                fontSize: 16, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
              }}
              title={primarySlot.isCoverFeature ? 'Cover feature — click to unset' : 'Set as cover feature image for title slide'}
            >★</button>
          )}
          {/* Release count chip when not selected — shows ">N releases"
              so the user knows this artist dropped multiple things. */}
          {!isSelected && artist.releases.length > 1 && (
            <span style={{
              position: 'absolute', top: 6, right: 6,
              background: 'var(--gold)', color: 'var(--midnight)',
              fontSize: 'var(--fs-3xs)', fontWeight: 700,
              padding: '1px 6px', borderRadius: 10,
            }}>
              {artist.releases.length} releases
            </span>
          )}
        </div>

        {/* Caption: artist name + track/release count */}
        <div style={{ padding: '8px 10px' }}>
          <p style={{
            fontSize: 'var(--fs-sm)', fontWeight: 600, lineHeight: 1.2,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            color: isSelected ? 'var(--gold)' : 'var(--text-primary)',
          }}>
            {artist.name}
          </p>
          <p style={{
            fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', lineHeight: 1.3,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {isSelected
              ? `${selectedCount} of ${artist.tracks.length} selected`
              : `${artist.releases.length > 1 ? `${artist.releases.length} releases · ` : ''}${artist.tracks.length} ${artist.tracks.length === 1 ? 'track' : 'tracks'}`}
          </p>
          {/* Action row — Pick tracks (opens modal) + Spotify link for the
              primary release. Credits → ND uses the primary artist name. */}
          <div className="card-actions" style={{ display: 'flex', gap: 6, marginTop: 4, alignItems: 'center', flexWrap: 'wrap' }}>
            {!isSingleTrackArtist && (
              <button
                onClick={(e) => { e.stopPropagation(); setShowModal(true); }}
                style={{ fontSize: 'var(--fs-3xs)', color: 'var(--gold)', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
                title={`Pick tracks from ${artist.name}`}
              >
                Pick tracks ({artist.tracks.length})
              </button>
            )}
            <a
              href={artist.primary.album_spotify_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="spotify-link"
              style={{
                fontSize: 'var(--fs-3xs)', color: 'var(--spotify-green)',
                padding: '1px 6px', border: '1px solid rgba(29,185,84,0.3)', borderRadius: 4,
                whiteSpace: 'nowrap',
              }}
            >
              Spotify
            </a>
            <a
              href={`https://nashvilledecoder.com/search?q=${encodeURIComponent(artist.name)}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              style={{
                fontSize: 'var(--fs-3xs)', color: 'var(--text-muted)',
                padding: '1px 6px', border: '1px solid var(--midnight-border)', borderRadius: 4,
                whiteSpace: 'nowrap',
              }}
              title="See full credits on Nashville Decoder"
            >
              Credits &rarr; ND
            </a>
          </div>
        </div>
      </div>

      {/* Artist-scoped track picker modal — shows every release for this
          artist and every track inside, grouped by release. Replaces
          ClusterCard's single-album modal for the artist-grouped view. */}
      {showModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowModal(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
          <div
            className="modal"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: 560, width: '100%', maxHeight: '85vh', overflow: 'auto', padding: 0 }}
          >
            {/* Header — artist name, cover, release + track counts */}
            <div style={{ display: 'flex', gap: 16, padding: 20, borderBottom: '1px solid var(--midnight-border)' }}>
              <img src={artist.cover} alt="" style={{ width: 80, height: 80, borderRadius: 8, flexShrink: 0, objectFit: 'cover' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ fontSize: 'var(--fs-xl)', fontWeight: 600, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {artist.name}
                </h3>
                <p style={{ fontSize: 'var(--fs-md)', color: 'var(--text-secondary)' }}>
                  {artist.releases.length} {artist.releases.length === 1 ? 'release' : 'releases'} · {artist.tracks.length} tracks
                  {selectedCount > 0 && ` · ${selectedCount} selected`}
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                aria-label="Close"
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 24, lineHeight: 1, padding: '0 4px', flexShrink: 0 }}
              >&times;</button>
            </div>

            {/* Release list with tracks grouped under each release */}
            <div style={{ padding: '8px 0' }}>
              {artist.releases.map(release => (
                <div key={release.album_spotify_id}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px 6px', borderTop: '1px solid var(--midnight-border)' }}>
                    <img src={release.cover_art_300} alt="" style={{ width: 40, height: 40, borderRadius: 6, flexShrink: 0, objectFit: 'cover' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {release.album_name}
                      </div>
                      <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
                        {release.album_type} · {release.release_date} · {release.total_tracks} {release.total_tracks === 1 ? 'track' : 'tracks'}
                      </div>
                    </div>
                  </div>
                  {release.tracks
                    .slice()
                    .sort((a, b) => ((a.track_number as number) || 0) - ((b.track_number as number) || 0))
                    .map(track => {
                      const isThisSelected = selectedTrackIds.has(track.track_id);
                      const trackSlot = selectedSlots.find(s => s.track.track_id === track.track_id);
                      return (
                        <div
                          key={track.track_id}
                          onClick={(e) => handleTrackClick(e, release, track)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '8px 20px 8px 76px', cursor: 'pointer',
                            background: isThisSelected ? 'rgba(212,168,67,0.1)' : 'transparent',
                            transition: 'background 0.1s',
                          }}
                        >
                          <div style={{
                            width: 22, height: 22, borderRadius: 4, flexShrink: 0,
                            border: isThisSelected ? '2px solid var(--gold)' : '2px solid var(--midnight-border)',
                            background: isThisSelected ? 'var(--gold)' : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'var(--midnight)', fontSize: 'var(--fs-3xs)', fontWeight: 700,
                          }}>
                            {isThisSelected && trackSlot ? trackSlot.selectionNumber : ''}
                          </div>
                          <span className="mono" style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', width: 22, textAlign: 'right' }}>
                            {track.track_number}
                          </span>
                          <span style={{
                            flex: 1, fontSize: 'var(--fs-md)',
                            color: isThisSelected ? 'var(--gold)' : 'var(--text-primary)',
                            fontWeight: isThisSelected ? 600 : 400,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {track.track_name}
                          </span>
                          {track.explicit && <span className="badge badge-explicit">E</span>}
                          <span className="mono" style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
                            {formatDuration(track.duration_ms)}
                          </span>
                        </div>
                      );
                    })}
                </div>
              ))}
            </div>

            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--midnight-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
                {selectedCount} of {artist.tracks.length} selected
              </span>
              <button
                className="btn btn-gold btn-sm"
                onClick={() => setShowModal(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
});
