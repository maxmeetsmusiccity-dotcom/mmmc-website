import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type { TrackItem, ReleaseCluster } from '../lib/spotify';
import { getLastFriday } from '../lib/spotify';
import type { SelectionSlot } from '../lib/selection';
import { buildSlots } from '../lib/selection';
import type { CarouselAspect } from '../lib/canvas-grid';
import { generateGridSlide, generateTitleSlide } from '../lib/canvas-grid';
import { getVisibleTemplates } from '../lib/carousel-templates';
import { getVisibleTitleTemplates, getDefaultTitleTemplateId } from '../lib/title-templates';
import { useAuth } from '../lib/auth-context';

interface Props {
  allTracks: TrackItem[];
  releases: ReleaseCluster[];
  selections: SelectionSlot[];
  onSelectionChange: (s: SelectionSlot[]) => void;
  selectionsByAlbum: Map<string, SelectionSlot[]>;
  onSelectRelease: (cluster: ReleaseCluster, trackId?: string) => void;
  onDeselect: (albumId: string, trackId?: string) => void;
  onSetCoverFeature: (trackId: string) => void;
  featureCounts: Map<string, number>;
  generating: boolean;
  onGenerate: () => void;
  allPreviews: string[];
  onDownloadAll: () => void;
  onDownloadSlide: (index: number) => void;
  tracksPerSlide: number;
  onTracksPerSlideChange?: (n: number) => void;
  carouselAspect?: CarouselAspect;
  onAspectChange?: (a: CarouselAspect) => void;
  pushSelectionHistory: (s: SelectionSlot[]) => void;
  gridTemplateId?: string;
  onGridTemplateChange?: (id: string) => void;
  titleTemplateId?: string;
  onTitleTemplateChange?: (id: string) => void;
  logoUrl?: string;
  onLogoChange?: (url: string) => void;
}

type ViewMode = 'grid' | 'list';
type FilterMode = 'all' | 'single' | 'album';
type SortMode = 'artist' | 'date' | 'title';

export default function MobileResultsView({
  allTracks, releases, selections, onSelectionChange,
  selectionsByAlbum: _selectionsByAlbum, onSelectRelease, onDeselect, onSetCoverFeature,
  featureCounts: _featureCounts, generating, onGenerate, allPreviews,
  onDownloadAll, onDownloadSlide,
  tracksPerSlide, onTracksPerSlideChange, carouselAspect = '1:1', onAspectChange,
  pushSelectionHistory,
  gridTemplateId: gridTplProp, onGridTemplateChange,
  titleTemplateId: titleTplProp, onTitleTemplateChange,
  logoUrl: logoProp, onLogoChange,
}: Props) {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [filter, setFilter] = useState<FilterMode>('all');
  const [sortBy, setSortBy] = useState<SortMode>('artist');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [search, setSearch] = useState('');
  const [showSlides, setShowSlides] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  // Wave 7 Block 4: expansion is keyed on primary artist (not album_spotify_id)
  // because the grid now renders one tile per artist, not per release.
  const [expandedArtist, setExpandedArtist] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const slideContainerRef = useRef<HTMLDivElement>(null);

  // Wave 7 Block 5 — live template preview state for the Carousel Builder
  // sheet. Two canvas-backed blob URLs, one for the title slide preview
  // and one for the grid slide preview, regenerated whenever the active
  // template / logo / selections / shape change. Debounced at 120ms so
  // rapid selection toggles don't thrash canvas work.
  const [builderTitlePreview, setBuilderTitlePreview] = useState<string>('');
  const [builderGridPreview, setBuilderGridPreview] = useState<string>('');
  // Guard to suppress rendering + blob-URL leaks while the sheet is closed.
  const builderWeekDate = useMemo(() => getLastFriday(), []);

  // Filter + sort releases
  const filtered = useMemo(() => {
    let list = [...releases];
    if (filter === 'single') list = list.filter(r => r.isSingle);
    if (filter === 'album') list = list.filter(r => !r.isSingle);
    if (search.length >= 2) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        r.album_name.toLowerCase().includes(q) ||
        r.artist_names.toLowerCase().includes(q) ||
        r.tracks.some(t => t.track_name.toLowerCase().includes(q))
      );
    }
    const dir = sortDir === 'asc' ? 1 : -1;
    if (sortBy === 'artist') list.sort((a, b) => dir * a.artist_names.localeCompare(b.artist_names));
    else if (sortBy === 'date') list.sort((a, b) => dir * (a.tracks[0]?.release_date || '').localeCompare(b.tracks[0]?.release_date || ''));
    else if (sortBy === 'title') list.sort((a, b) => dir * a.album_name.localeCompare(b.album_name));
    return list;
  }, [releases, filter, sortBy, sortDir, search]);

  const toggleSort = useCallback((field: SortMode) => {
    if (sortBy === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(field); setSortDir('asc'); }
  }, [sortBy]);

  // Wave 7 Block 5 — selected tracks as an array, needed both for the live
  // grid preview and the selection order used by tile badges in a later
  // commit.
  const selectedTracks = useMemo(
    () => selections.map(s => s.track),
    [selections],
  );
  const coverFeature = useMemo(
    () => selections.find(s => s.isCoverFeature) || null,
    [selections],
  );
  const activeGridTemplate = useMemo(() => {
    if (gridTplProp) return gridTplProp;
    if (typeof window === 'undefined') return 'mmmc_classic';
    return localStorage.getItem('nmf_template') || 'mmmc_classic';
  }, [gridTplProp]);
  const activeTitleTemplate = useMemo(() => {
    if (titleTplProp) return titleTplProp;
    if (typeof window === 'undefined') return getDefaultTitleTemplateId(user?.email || undefined);
    return localStorage.getItem('nmf_title_template') || getDefaultTitleTemplateId(user?.email || undefined);
  }, [titleTplProp, user?.email]);
  const activeLogoUrl = useMemo(() => {
    if (logoProp) return logoProp;
    if (typeof window === 'undefined') return '/mmmc-logo.png';
    return localStorage.getItem('nmf_logo_url') || '/mmmc-logo.png';
  }, [logoProp]);

  // Debounced grid slide preview render. Only runs while the builder
  // sheet is open so we don't waste canvas work in the background, and
  // revokes the prior blob URL on every replacement to avoid leaks.
  useEffect(() => {
    if (!showConfig) return;
    if (selectedTracks.length === 0) {
      setBuilderGridPreview('');
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      const firstSlice = selectedTracks.slice(0, Math.max(1, tracksPerSlide));
      const slots = buildSlots(firstSlice.map((t, i) => ({
        track: t,
        albumId: t.album_spotify_id,
        selectionNumber: i + 1,
        slideGroup: 1,
        positionInSlide: i + 1,
        isCoverFeature: false,
      })));
      generateGridSlide(
        slots,
        builderWeekDate,
        activeGridTemplate,
        activeLogoUrl,
        undefined,
        carouselAspect,
      )
        .then(blob => {
          if (cancelled) return;
          const url = URL.createObjectURL(blob);
          setBuilderGridPreview(prev => {
            if (prev) URL.revokeObjectURL(prev);
            return url;
          });
        })
        .catch(() => { /* swallow — preview is best-effort */ });
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    showConfig,
    selectedTracks,
    tracksPerSlide,
    activeGridTemplate,
    activeLogoUrl,
    carouselAspect,
    builderWeekDate,
  ]);

  // Title slide preview — only renders when a cover feature is set AND
  // the active title template is not 'none'. Same debounce + blob-URL
  // cleanup pattern as the grid preview.
  useEffect(() => {
    if (!showConfig) return;
    if (!coverFeature || activeTitleTemplate === 'none') {
      setBuilderTitlePreview(prev => {
        if (prev) URL.revokeObjectURL(prev);
        return '';
      });
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      generateTitleSlide(coverFeature, builderWeekDate, activeTitleTemplate, carouselAspect)
        .then(blob => {
          if (cancelled) return;
          const url = URL.createObjectURL(blob);
          setBuilderTitlePreview(prev => {
            if (prev) URL.revokeObjectURL(prev);
            return url;
          });
        })
        .catch(() => {});
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    showConfig,
    coverFeature,
    activeTitleTemplate,
    carouselAspect,
    builderWeekDate,
  ]);

  // Revoke any outstanding blob URLs on unmount.
  useEffect(() => () => {
    if (builderTitlePreview) URL.revokeObjectURL(builderTitlePreview);
    if (builderGridPreview) URL.revokeObjectURL(builderGridPreview);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show loading state while generating
  if (showSlides && allPreviews.length === 0) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <div style={{ width: 48, height: 48, border: '3px solid var(--midnight-border)', borderTopColor: 'var(--gold)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-lg)' }}>Generating slides...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Show slides view after generation
  if (showSlides && allPreviews.length > 0) {
    return (
      <div style={{ minHeight: '100vh', paddingBottom: 80 }}>
        {/* Header */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--midnight-border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => setShowSlides(false)}
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 16 }}>
            &larr; Back to tracks
          </button>
          <span style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-xs)', marginLeft: 'auto' }}>
            {allPreviews.length} {allPreviews.length === 1 ? 'slide' : 'slides'}
          </span>
        </div>

        {/* Thumbnail strip */}
        <div style={{ display: 'flex', gap: 8, padding: '12px 16px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {allPreviews.map((url, i) => (
            <img key={i} src={url} alt={`Slide ${i + 1}`}
              onClick={() => setActiveSlide(i)}
              style={{
                width: 60, height: 60, borderRadius: 6, objectFit: 'cover', flexShrink: 0,
                border: activeSlide === i ? '2px solid var(--gold)' : '2px solid transparent',
                opacity: activeSlide === i ? 1 : 0.6,
              }} />
          ))}
        </div>

        {/* Main preview — swipeable */}
        <div ref={slideContainerRef} style={{ padding: '0 16px', textAlign: 'center' }}
          onTouchStart={e => {
            const startX = e.touches[0].clientX;
            const handleEnd = (ev: TouchEvent) => {
              const dx = ev.changedTouches[0].clientX - startX;
              if (Math.abs(dx) > 50) {
                setActiveSlide(prev => dx > 0 ? Math.max(0, prev - 1) : Math.min(allPreviews.length - 1, prev + 1));
              }
              document.removeEventListener('touchend', handleEnd);
            };
            document.addEventListener('touchend', handleEnd, { once: true });
          }}>
          <img src={allPreviews[activeSlide]} alt={`Slide ${activeSlide + 1}`}
            style={{ width: '100%', maxWidth: 400, borderRadius: 8, border: '1px solid var(--midnight-border)' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-xs)', marginTop: 8 }}>
            {activeSlide + 1}/{allPreviews.length} &middot; Swipe to browse
          </p>
        </div>

        {/* Actions */}
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Save to Photos (mobile-optimized) or Download All */}
          <button className="btn btn-gold" onClick={async () => {
            // Try native share (iOS/Android) — saves directly to Photos
            if (navigator.share && navigator.canShare) {
              try {
                const files = await Promise.all(
                  allPreviews.map(async (url, i) => {
                    const res = await fetch(url);
                    const blob = await res.blob();
                    return new File([blob], `nmf-slide-${i + 1}.png`, { type: 'image/png' });
                  })
                );
                if (navigator.canShare({ files })) {
                  await navigator.share({ files, title: 'NMF Carousel' });
                  return;
                }
              } catch { /* share cancelled or failed, fall through to download */ }
            }
            // Fallback: download each slide individually
            for (let i = 0; i < allPreviews.length; i++) {
              onDownloadSlide(i);
              await new Promise(r => setTimeout(r, 300)); // stagger downloads
            }
          }}
            style={{ width: '100%', justifyContent: 'center', fontSize: 'var(--fs-lg)', padding: '14px 0' }}>
            {typeof navigator !== 'undefined' && 'share' in navigator ? 'Save to Photos' : 'Download All'} ({allPreviews.length} slides)
          </button>
          <button className="btn" onClick={onDownloadAll}
            style={{ width: '100%', justifyContent: 'center' }}>
            Download ZIP ({allPreviews.length} slides)
          </button>
          <button className="btn" onClick={() => onDownloadSlide(activeSlide)}
            style={{ width: '100%', justifyContent: 'center', fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
            Download This Slide
          </button>
        </div>
      </div>
    );
  }

  // Track selection view
  return (
    <div style={{ paddingBottom: 80 }}>
      {/* Compact toolbar */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 20,
        background: 'var(--midnight)', borderBottom: '1px solid var(--midnight-border)',
        padding: '8px 12px',
      }}>
        {/* Row 1: count + search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span className="mono" style={{
            fontSize: 'var(--fs-xl)', fontWeight: 700, flexShrink: 0,
            color: selections.length > 0 ? 'var(--gold)' : 'var(--text-muted)',
          }}>
            {selections.length}
            <span style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-sm)', fontWeight: 400 }}>
              /{allTracks.length}
            </span>
          </span>
          <input
            type="text" placeholder="Search..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="search-input"
            style={{ flex: 1, fontSize: 'var(--fs-sm)', padding: '6px 10px', minWidth: 0 }}
          />
          {/* View toggle */}
          <button onClick={() => setViewMode(v => v === 'grid' ? 'list' : 'grid')}
            style={{ background: 'none', border: '1px solid var(--midnight-border)', borderRadius: 6, padding: '4px 8px', color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0 }}
            title={viewMode === 'grid' ? 'Switch to list' : 'Switch to grid'}>
            {viewMode === 'grid' ? '☰' : '⊞'}
          </button>
        </div>

        {/* Row 2: filters + sort */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {(['all', 'single', 'album'] as FilterMode[]).map(f => (
            <button key={f} className={`filter-pill ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
              style={{ fontSize: 11, padding: '3px 8px', minHeight: 28 }}>
              {f === 'all' ? 'All' : f === 'single' ? 'Singles' : 'Albums'}
            </button>
          ))}
          <span style={{ color: 'var(--midnight-border)', margin: '0 2px' }}>|</span>
          {(['artist', 'date', 'title'] as SortMode[]).map(s => (
            <button key={s} className={`filter-pill ${sortBy === s ? 'active' : ''}`}
              onClick={() => toggleSort(s)}
              style={{ fontSize: 11, padding: '3px 8px', minHeight: 28 }}>
              {s.charAt(0).toUpperCase() + s.slice(1)} {sortBy === s ? (sortDir === 'asc' ? '↑' : '↓') : ''}
            </button>
          ))}
        </div>

        {/* Row 3: Select All / Clear */}
        {filtered.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center' }}>
            <button onClick={() => {
              const newSelections: SelectionSlot[] = [];
              for (const cluster of filtered) {
                const track = cluster.tracks.find(t => t.track_id === cluster.titleTrackId) || cluster.tracks[0];
                if (!selections.some(s => s.track.track_id === track.track_id)) {
                  newSelections.push({ track, albumId: cluster.album_spotify_id, selectionNumber: 0, slideGroup: 0, positionInSlide: 0, isCoverFeature: false });
                }
              }
              onSelectionChange(buildSlots([...selections, ...newSelections]));
            }} style={{ fontSize: 11, color: 'var(--steel)', cursor: 'pointer', background: 'none', border: 'none' }}>
              Select All
            </button>
            {selections.length > 0 && (
              <button onClick={() => { pushSelectionHistory(selections); onSelectionChange([]); }}
                style={{ fontSize: 11, color: 'var(--mmmc-red)', cursor: 'pointer', background: 'none', border: 'none' }}>
                Clear ({selections.length})
              </button>
            )}
            <span style={{ color: 'var(--text-muted)', fontSize: 11, marginLeft: 'auto' }}>
              {filtered.length} releases &middot; {allTracks.length} tracks
            </span>
          </div>
        )}
      </div>

      {/* Wave 7 Block 4: track grid regrouped by primary artist. One tile
          per act. Features (comma / feat. / ft.) stay under the first-listed
          artist, matching desktop NashvilleReleases grouping at line 374-393.
          Multi-release or multi-track artists open a fixed modal overlay for
          track picking — see the modal rendered at the component's end. */}
      <div style={{ padding: '12px' }}>
        {(() => {
          type ArtistGroup = {
            name: string;
            cover: string;
            releases: ReleaseCluster[];
            tracks: TrackItem[];
          };

          const primaryArtistOf = (s: string) =>
            (s || '').split(/,|feat\.|ft\./i)[0].trim() || 'Unknown';

          const artistGroups: ArtistGroup[] = (() => {
            const map = new Map<string, ArtistGroup>();
            for (const r of filtered) {
              const key = primaryArtistOf(r.artist_names);
              const existing = map.get(key);
              if (existing) {
                existing.releases.push(r);
                existing.tracks.push(...r.tracks);
              } else {
                map.set(key, {
                  name: key,
                  cover: r.tracks[0]?.cover_art_300 || r.tracks[0]?.cover_art_640 || '',
                  releases: [r],
                  tracks: [...r.tracks],
                });
              }
            }
            const groups = [...map.values()];
            const dir = sortDir === 'asc' ? 1 : -1;
            if (sortBy === 'artist') groups.sort((a, b) => dir * a.name.localeCompare(b.name));
            else if (sortBy === 'date') groups.sort((a, b) =>
              dir * (a.releases[0]?.tracks[0]?.release_date || '').localeCompare(
                b.releases[0]?.tracks[0]?.release_date || '',
              ),
            );
            else if (sortBy === 'title') groups.sort((a, b) =>
              dir * (a.releases[0]?.album_name || '').localeCompare(b.releases[0]?.album_name || ''),
            );
            return groups;
          })();

          // Wave 7 Block 5B — global selection ordinal lookup. For every
          // selected track, record its 1-indexed position in the order Max
          // picked them. Every artist tile with selections can then show
          // the *most recent* (highest) ordinal among that artist's
          // selected tracks, giving Max at-a-glance "this artist was #5"
          // context as he builds toward the target track count.
          const globalOrdinalByTrackId = new Map<string, number>();
          selections.forEach((s, idx) => {
            globalOrdinalByTrackId.set(s.track.track_id, idx + 1);
          });

          const selectedCountOf = (artist: ArtistGroup) => {
            const ids = new Set(artist.tracks.map(t => t.track_id));
            return selections.filter(s => ids.has(s.track.track_id)).length;
          };

          const mostRecentOrdinalOf = (artist: ArtistGroup): number | null => {
            let max = 0;
            for (const t of artist.tracks) {
              const ord = globalOrdinalByTrackId.get(t.track_id);
              if (ord && ord > max) max = ord;
            }
            return max || null;
          };

          const tapArtist = (artist: ArtistGroup) => {
            // Single-track artist (one release, one track): toggle directly.
            if (artist.tracks.length === 1) {
              const t = artist.tracks[0];
              const cluster = artist.releases[0];
              const already = selections.some(s => s.track.track_id === t.track_id);
              if (already) onDeselect(cluster.album_spotify_id, t.track_id);
              else onSelectRelease(cluster, t.track_id);
              // Wave 7 Block 5B — haptic feedback on selection toggle.
              // navigator.vibrate works on Android and the Chromium-based
              // iOS browsers; iOS Safari is a no-op today. If Max's iPhone
              // doesn't feel it we'll iterate to the iOS 17.4+
              // `<input type="checkbox" switch>` trick in a follow-up.
              try { navigator.vibrate?.(10); } catch { /* best-effort */ }
              return;
            }
            setExpandedArtist(artist.name);
          };

          return viewMode === 'grid' ? (
            // minmax(0, 1fr) prevents the min-content blow-out fixed in
            // Wave 7 Block 3. Do not regress this to plain `1fr`.
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
              {artistGroups.map(artist => {
                const selCount = selectedCountOf(artist);
                const hasSelection = selCount > 0;
                const ordinal = hasSelection ? mostRecentOrdinalOf(artist) : null;
                return (
                  <div key={artist.name} style={{ alignSelf: 'start' }}>
                    <div onClick={() => tapArtist(artist)} style={{
                      borderRadius: 8, overflow: 'hidden', cursor: 'pointer',
                      border: hasSelection ? '2px solid var(--gold)' : '2px solid transparent',
                      background: hasSelection ? 'rgba(212,168,67,0.06)' : 'var(--midnight)',
                      position: 'relative',
                    }}>
                      {/* Wave 7 Block 5B — split badge:
                          top-LEFT: K/M (picked from this artist / artist total)
                          top-RIGHT: #X (this artist's most-recent selection in
                          the global pick order, i.e. "this was your 5th pick").
                          Only rendered on selected tiles per Max's decision —
                          no greyed-out placeholders on unselected tiles. */}
                      {hasSelection && (
                        <>
                          <div
                            data-testid="tile-badge-count"
                            style={{
                              position: 'absolute', top: 6, left: 6, zIndex: 2,
                              background: 'var(--gold)', color: 'var(--midnight)',
                              fontSize: 10, fontWeight: 700, borderRadius: 999,
                              padding: '2px 8px', lineHeight: 1.2,
                              boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
                            }}>
                            {selCount}/{artist.tracks.length}
                          </div>
                          {ordinal !== null && (
                            <div
                              data-testid="tile-badge-ordinal"
                              style={{
                                position: 'absolute', top: 6, right: 6, zIndex: 2,
                                background: 'var(--midnight)',
                                color: 'var(--gold)',
                                border: '1px solid var(--gold)',
                                fontSize: 10, fontWeight: 700, borderRadius: 999,
                                padding: '2px 8px', lineHeight: 1.2,
                                boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
                                fontFamily: 'var(--font-mono)',
                              }}>
                              #{ordinal}
                            </div>
                          )}
                        </>
                      )}
                      <img src={artist.cover} alt=""
                        style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
                      <div style={{ padding: '6px 8px' }}>
                        <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          color: hasSelection ? 'var(--gold)' : 'var(--text-primary)' }}>
                          {artist.name}
                        </div>
                        <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {hasSelection
                            ? `${selCount} of ${artist.tracks.length} selected`
                            : `${artist.releases.length > 1 ? `${artist.releases.length} releases · ` : ''}${artist.tracks.length} ${artist.tracks.length === 1 ? 'track' : 'tracks'}`}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {artistGroups.map(artist => {
                const selCount = selectedCountOf(artist);
                const hasSelection = selCount > 0;
                return (
                  <div key={artist.name}
                    onClick={() => tapArtist(artist)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 4px',
                      borderBottom: '1px solid var(--midnight-border)', cursor: 'pointer',
                      background: hasSelection ? 'rgba(212,168,67,0.06)' : 'transparent',
                    }}>
                    <img src={artist.cover}
                      alt="" style={{ width: 52, height: 52, borderRadius: 6, flexShrink: 0, objectFit: 'cover',
                      border: hasSelection ? '2px solid var(--gold)' : '2px solid transparent' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: hasSelection ? 'var(--gold)' : 'var(--text-primary)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {artist.name}
                      </div>
                      <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)' }}>
                        {hasSelection
                          ? `${selCount} of ${artist.tracks.length} selected`
                          : `${artist.releases.length} ${artist.releases.length === 1 ? 'release' : 'releases'} · ${artist.tracks.length} ${artist.tracks.length === 1 ? 'track' : 'tracks'} ▸`}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* Wave 7 Block 4 — multi-track artist modal. Fixed full-screen
          backdrop + centered panel listing every release for this artist
          and every track inside, matching the NashvilleReleases desktop
          pattern. Replaces the Block 3 inline flex expansion that pushed
          every other tile out of view. */}
      {expandedArtist && (() => {
        const primaryArtistOf = (s: string) =>
          (s || '').split(/,|feat\.|ft\./i)[0].trim() || 'Unknown';
        const artistReleases = releases.filter(r => primaryArtistOf(r.artist_names) === expandedArtist);
        if (artistReleases.length === 0) return null;
        const artistCover = artistReleases[0].tracks[0]?.cover_art_300
          || artistReleases[0].tracks[0]?.cover_art_640
          || '';
        const allTracksForArtist = artistReleases.flatMap(r => r.tracks);
        const selectedForArtist = selections.filter(s =>
          allTracksForArtist.some(t => t.track_id === s.track.track_id),
        ).length;
        const close = () => setExpandedArtist(null);
        return (
          <>
            <div onClick={close}
              style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.6)' }} />
            <div style={{
              position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
              zIndex: 101, width: 'min(420px, 92vw)', maxHeight: '80vh',
              background: 'var(--midnight-raised)', borderRadius: 12,
              border: '2px solid var(--gold-dark)',
              display: 'flex', flexDirection: 'column',
              boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--midnight-border)' }}>
                {artistCover && (
                  <img src={artistCover} alt=""
                    style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0, objectFit: 'cover' }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--gold)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {expandedArtist}
                  </div>
                  <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)' }}>
                    {artistReleases.length} {artistReleases.length === 1 ? 'release' : 'releases'} · {allTracksForArtist.length} tracks
                    {selectedForArtist > 0 && ` · ${selectedForArtist} selected`}
                  </div>
                </div>
                <button onClick={close}
                  aria-label="Close"
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 22, lineHeight: 1, padding: '0 4px', flexShrink: 0 }}>
                  &times;
                </button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 8px' }}>
                {artistReleases.map(rel => (
                  <div key={rel.album_spotify_id}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0 6px', borderBottom: '1px solid var(--midnight-border)' }}>
                      <img src={rel.tracks[0]?.cover_art_300 || rel.tracks[0]?.cover_art_640}
                        alt="" style={{ width: 32, height: 32, borderRadius: 4, flexShrink: 0, objectFit: 'cover' }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {rel.album_name}
                        </div>
                        <div style={{ fontSize: 'var(--fs-3xs)', color: 'var(--text-muted)' }}>
                          {rel.tracks.length} {rel.tracks.length === 1 ? 'track' : 'tracks'}
                          {!rel.isSingle && ' · album'}
                        </div>
                      </div>
                    </div>
                    {rel.tracks
                      .slice()
                      .sort((a, b) => (a.track_number || 0) - (b.track_number || 0))
                      .map(track => {
                        const isTrackSelected = selections.some(s => s.track.track_id === track.track_id);
                        const isCover = selections.some(s => s.track.track_id === track.track_id && s.isCoverFeature);
                        return (
                          <div key={track.track_id}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isTrackSelected) onDeselect(rel.album_spotify_id, track.track_id);
                              else onSelectRelease(rel, track.track_id);
                              // Wave 7 Block 5B — haptic feedback. Android +
                              // Chromium iOS: fires a 10ms pulse. iOS Safari:
                              // no-op today, iterate later if needed.
                              try { navigator.vibrate?.(10); } catch { /* best-effort */ }
                            }}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 4px 10px 12px',
                              cursor: 'pointer', fontSize: 'var(--fs-sm)',
                              borderBottom: '1px solid rgba(255,255,255,0.03)',
                              minHeight: 44, // Apple HIG touch target
                            }}>
                            <div style={{
                              width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                              border: isTrackSelected ? '2px solid var(--gold)' : '2px solid var(--midnight-border)',
                              background: isTrackSelected ? 'var(--gold)' : 'transparent',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 11, color: 'var(--midnight)', fontWeight: 700,
                            }}>
                              {isTrackSelected && '\u2713'}
                            </div>
                            <span style={{ color: 'var(--text-muted)', width: 20, textAlign: 'right', flexShrink: 0, fontSize: 'var(--fs-2xs)' }}>
                              {track.track_number}
                            </span>
                            <span style={{ flex: 1, color: isTrackSelected ? 'var(--gold)' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {track.track_name}
                            </span>
                            {isTrackSelected && (
                              <button onClick={e => { e.stopPropagation(); onSetCoverFeature(track.track_id); }}
                                title="Set as cover feature"
                                style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', flexShrink: 0,
                                  color: isCover ? 'var(--gold)' : 'var(--text-muted)', padding: 4 }}>
                                ★
                              </button>
                            )}
                          </div>
                        );
                      })}
                  </div>
                ))}
              </div>
              <div style={{ padding: '12px 16px', borderTop: '1px solid var(--midnight-border)', display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={close}
                  className="btn btn-gold"
                  style={{ padding: '10px 24px', fontSize: 'var(--fs-sm)' }}>
                  Done
                </button>
              </div>
            </div>
          </>
        );
      })()}

      {/* Configure bottom sheet — full carousel settings */}
      {showConfig && (() => {
        const userEmail = user?.email || undefined;
        const gridTemplates = getVisibleTemplates(userEmail);
        const titleTemplates = getVisibleTitleTemplates(userEmail);
        const activeGrid = gridTplProp || localStorage.getItem('nmf_template') || 'mmmc_classic';
        const activeTitle = titleTplProp || localStorage.getItem('nmf_title_template') || getDefaultTitleTemplateId(userEmail);
        const activeLogo = logoProp || localStorage.getItem('nmf_logo_url') || '/mmmc-logo.png';

        return (
        <>
          <div onClick={() => setShowConfig(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(0,0,0,0.5)' }} />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 41,
            background: 'var(--midnight-raised)', borderTop: '2px solid var(--gold-dark)',
            borderRadius: '16px 16px 0 0', padding: '16px',
            paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
            maxHeight: '85vh', overflowY: 'auto',
            animation: 'sheetSlideUp 200ms ease',
          }}>
            <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--midnight-border)', margin: '0 auto 12px' }} />
            <p style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, marginBottom: 16, color: 'var(--gold)' }}>Carousel Builder</p>

            {/* Wave 7 Block 5 — Logo Upload (moved to top: it's a one-time
                setup step that should be out of the way before anyone starts
                picking templates). */}
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 8 }}>Center Logo</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <img src={activeLogo} alt="Logo" style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
              <label className="btn btn-sm" style={{ cursor: 'pointer', fontSize: 'var(--fs-sm)' }}>
                Upload Logo
                <input type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => {
                      const url = reader.result as string;
                      onLogoChange?.(url);
                      localStorage.setItem('nmf_logo_url', url);
                    };
                    reader.readAsDataURL(file);
                  }} />
              </label>
              {activeLogo !== '/mmmc-logo.png' && (
                <button className="btn btn-sm" onClick={() => { onLogoChange?.('/mmmc-logo.png'); localStorage.setItem('nmf_logo_url', '/mmmc-logo.png'); }}
                  style={{ fontSize: 'var(--fs-sm)' }}>Reset</button>
              )}
            </div>

            {/* Wave 7 Block 5 — Title slide live preview. Canvas-rendered
                blob URL, debounced 120ms on template / cover feature /
                shape change. Sits directly above the template chip row so
                tapping a chip gives you instant visual feedback. */}
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 8 }}>Title Slide</p>
            <div
              data-testid="builder-title-preview"
              style={{
                width: '100%', maxWidth: 220, margin: '0 auto 10px',
                aspectRatio: carouselAspect === '3:4' ? '3/4' : '1',
                borderRadius: 10, overflow: 'hidden',
                border: '1px solid var(--midnight-border)',
                background: 'var(--midnight)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative',
              }}
            >
              {builderTitlePreview ? (
                <img src={builderTitlePreview} alt="Title slide preview"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              ) : (
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', textAlign: 'center', padding: 12 }}>
                  {activeTitle === 'none'
                    ? 'Title slide off'
                    : coverFeature
                      ? 'Rendering…'
                      : 'Tap ★ on a track to set cover feature'}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, marginBottom: 20, WebkitOverflowScrolling: 'touch' }}>
              <button
                onClick={() => onTitleTemplateChange?.('none')}
                style={{
                  flexShrink: 0, width: 72, padding: 6, borderRadius: 10, cursor: 'pointer',
                  background: activeTitle === 'none' ? 'var(--midnight-hover)' : 'var(--midnight)',
                  border: activeTitle === 'none' ? '2px solid var(--gold)' : '2px solid var(--midnight-border)',
                  textAlign: 'center',
                }}
              >
                <div style={{ width: '100%', aspectRatio: '1', borderRadius: 6, background: 'var(--midnight-border)', marginBottom: 4,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--fs-lg)', color: 'var(--text-muted)' }}>
                  ✕
                </div>
                <span style={{ fontSize: 'var(--fs-3xs)', fontWeight: 600, color: activeTitle === 'none' ? 'var(--gold)' : 'var(--text-muted)' }}>No Title</span>
              </button>
              {titleTemplates.map(t => (
                <button
                  key={t.id}
                  onClick={() => onTitleTemplateChange?.(t.id)}
                  style={{
                    flexShrink: 0, width: 72, padding: 6, borderRadius: 10, cursor: 'pointer',
                    background: activeTitle === t.id ? 'var(--midnight-hover)' : 'var(--midnight)',
                    border: activeTitle === t.id ? `2px solid ${t.accent}` : '2px solid var(--midnight-border)',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ width: '100%', aspectRatio: '1', borderRadius: 6, background: t.background, marginBottom: 4,
                    display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ color: t.accent, fontSize: 'var(--fs-3xs)', fontWeight: 700 }}>NMF</span>
                  </div>
                  <span style={{ fontSize: 'var(--fs-3xs)', fontWeight: 600,
                    color: activeTitle === t.id ? t.accent : 'var(--text-muted)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block',
                  }}>{t.name}</span>
                </button>
              ))}
            </div>

            {/* Wave 7 Block 5 — Grid slide live preview. Uses the first
                tracksPerSlide tracks of the current selection so the
                preview reflects real content, not a sample set. */}
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 8 }}>Grid Slide</p>
            <div
              data-testid="builder-grid-preview"
              style={{
                width: '100%', maxWidth: 220, margin: '0 auto 10px',
                aspectRatio: carouselAspect === '3:4' ? '3/4' : '1',
                borderRadius: 10, overflow: 'hidden',
                border: '1px solid var(--midnight-border)',
                background: 'var(--midnight)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative',
              }}
            >
              {builderGridPreview ? (
                <img src={builderGridPreview} alt="Grid slide preview"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              ) : (
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', textAlign: 'center', padding: 12 }}>
                  {selections.length === 0 ? 'Select tracks to see preview' : 'Rendering…'}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, marginBottom: 20, WebkitOverflowScrolling: 'touch' }}>
              {gridTemplates.map(t => (
                <button
                  key={t.id}
                  onClick={() => onGridTemplateChange?.(t.id)}
                  style={{
                    flexShrink: 0, width: 72, padding: 6, borderRadius: 10, cursor: 'pointer',
                    background: activeGrid === t.id ? 'var(--midnight-hover)' : 'var(--midnight)',
                    border: activeGrid === t.id ? `2px solid ${t.accent}` : '2px solid var(--midnight-border)',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ width: '100%', aspectRatio: '1', borderRadius: 6, background: t.background, marginBottom: 4,
                    display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ color: t.accent, fontSize: 'var(--fs-3xs)', fontWeight: 700 }}>NMF</span>
                  </div>
                  <span style={{ fontSize: 'var(--fs-3xs)', fontWeight: 600,
                    color: activeGrid === t.id ? t.accent : 'var(--text-muted)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block',
                  }}>{t.name}</span>
                </button>
              ))}
            </div>

            {/* Carousel Shape (tuning — moved below previews) */}
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 8 }}>Shape</p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {([
                { value: '1:1' as CarouselAspect, label: 'Square', sub: '1080×1080' },
                { value: '3:4' as CarouselAspect, label: 'Portrait', sub: '1080×1440' },
              ]).map(opt => (
                <button
                  key={opt.value}
                  onClick={() => onAspectChange?.(opt.value)}
                  style={{
                    flex: 1, padding: '10px 8px', borderRadius: 10, cursor: 'pointer',
                    background: carouselAspect === opt.value ? 'var(--midnight-hover)' : 'var(--midnight)',
                    border: carouselAspect === opt.value ? '2px solid var(--gold)' : '2px solid var(--midnight-border)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                  }}
                >
                  <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: carouselAspect === opt.value ? 'var(--gold)' : 'var(--text-secondary)' }}>
                    {opt.label}
                  </span>
                  <span style={{ fontSize: 'var(--fs-3xs)', color: 'var(--text-muted)' }}>{opt.sub}</span>
                </button>
              ))}
            </div>

            {/* Tracks per slide */}
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 8 }}>Tracks per slide</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              {[4, 6, 8, 9, 16].map(n => (
                <button
                  key={n}
                  className={`filter-pill ${tracksPerSlide === n ? 'active' : ''}`}
                  onClick={() => onTracksPerSlideChange?.(n)}
                  style={{ fontSize: 'var(--fs-sm)' }}
                >
                  {n}
                </button>
              ))}
            </div>
            <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginBottom: 16 }}>
              {selections.length} tracks → {Math.ceil(selections.length / tracksPerSlide) + 1} slides (including title)
            </p>

            <button className="btn btn-gold" onClick={() => { setShowConfig(false); onGenerate(); setShowSlides(true); }}
              disabled={selections.length === 0 || generating}
              style={{ width: '100%', justifyContent: 'center', fontSize: 'var(--fs-lg)', padding: '14px 0' }}>
              {generating ? 'Generating...' : '★ Generate Carousel'}
            </button>
          </div>
        </>
        );
      })()}

      {/* Sticky bottom action bar */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 30,
        background: 'var(--midnight-raised)', borderTop: '2px solid var(--gold-dark)',
        padding: '12px 16px', paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
      }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setShowConfig(true)}
            disabled={selections.length === 0}
            style={{
              flex: 1, justifyContent: 'center', fontSize: 'var(--fs-sm)', fontWeight: 700,
              padding: '14px 0', borderRadius: 10, cursor: selections.length === 0 ? 'default' : 'pointer',
              background: 'var(--midnight)',
              color: selections.length === 0 ? 'var(--text-muted)' : 'var(--gold)',
              border: selections.length === 0 ? '2px solid var(--midnight-border)' : '2px solid var(--gold)',
              opacity: selections.length === 0 ? 0.5 : 1,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
            🎨 Builder
          </button>
          <button className="btn btn-gold"
            disabled={selections.length === 0 || generating}
            onClick={() => { onGenerate(); setShowSlides(true); }}
            style={{ flex: 2, justifyContent: 'center', fontSize: 'var(--fs-lg)', padding: '14px 0' }}>
            {generating ? '...' : allPreviews.length > 0 ? `View (${allPreviews.length})` : '★ Generate'}
          </button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)' }}>
          <span>{selections.length} selected</span>
          <span>{allPreviews.length > 0 ? allPreviews.length : Math.ceil(selections.length / tracksPerSlide) + 1} slides</span>
          {(() => {
            const cover = selections.find(s => s.isCoverFeature);
            return cover ? <span style={{ color: 'var(--gold)' }}>★ {cover.track.artist_names.split(',')[0]}</span> : null;
          })()}
        </div>
      </div>
    </div>
  );
}
