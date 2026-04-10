import { useState, useMemo, useCallback, useRef } from 'react';
import type { TrackItem, ReleaseCluster } from '../lib/spotify';
import type { SelectionSlot } from '../lib/selection';
import { buildSlots } from '../lib/selection';
import type { CarouselAspect } from '../lib/canvas-grid';
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
  selectionsByAlbum: _selectionsByAlbum, onSelectRelease, onDeselect: _onDeselect, onSetCoverFeature,
  featureCounts: _featureCounts, generating, onGenerate, allPreviews,
  onDownloadAll: _onDownloadAll, onDownloadSlide,
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
  const [expandedAlbum, setExpandedAlbum] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const slideContainerRef = useRef<HTMLDivElement>(null);

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
          <button className="btn" onClick={() => onDownloadSlide(activeSlide)}
            style={{ width: '100%', justifyContent: 'center' }}>
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

      {/* Track grid / list */}
      <div style={{ padding: '12px' }}>
        {/* Render function for a single release card (shared by grid and list) */}
        {(() => {
          const handleTap = (cluster: ReleaseCluster) => {
            if (cluster.isSingle || cluster.tracks.length === 1) {
              // Single track — toggle selection directly
              onSelectRelease(cluster);
            } else {
              // Multi-track — expand to show track picker
              setExpandedAlbum(expandedAlbum === cluster.album_spotify_id ? null : cluster.album_spotify_id);
            }
          };

          const renderTrackPicker = (cluster: ReleaseCluster) => {
            if (expandedAlbum !== cluster.album_spotify_id) return null;
            return (
              <div style={{
                padding: '8px 12px', background: 'var(--midnight-raised)',
                borderRadius: '0 0 8px 8px', marginTop: -4,
                border: '1px solid var(--midnight-border)', borderTop: 'none',
              }}>
                <p style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)', marginBottom: 6 }}>
                  Choose a track from {cluster.album_name}:
                </p>
                {cluster.tracks.sort((a, b) => (a.track_number || 0) - (b.track_number || 0)).map(track => {
                  const isTrackSelected = selections.some(s => s.track.track_id === track.track_id);
                  return (
                    <div key={track.track_id}
                      onClick={() => onSelectRelease(cluster, track.track_id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 4px',
                        borderBottom: '1px solid var(--midnight-border)', cursor: 'pointer',
                      }}>
                      <div style={{
                        width: 20, height: 20, borderRadius: 4, flexShrink: 0,
                        border: isTrackSelected ? '2px solid var(--gold)' : '2px solid var(--midnight-border)',
                        background: isTrackSelected ? 'var(--gold)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, color: 'var(--midnight)', fontWeight: 700,
                      }}>
                        {isTrackSelected ? '✓' : ''}
                      </div>
                      <span style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-2xs)', width: 20, textAlign: 'right' }}>
                        {track.track_number}
                      </span>
                      <span style={{
                        flex: 1, fontSize: 'var(--fs-sm)',
                        color: isTrackSelected ? 'var(--gold)' : 'var(--text-primary)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {track.track_name}
                      </span>
                      {isTrackSelected && (
                        <button onClick={e => { e.stopPropagation(); onSetCoverFeature(track.track_id); }}
                          style={{ background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', flexShrink: 0,
                            color: selections.find(s => s.track.track_id === track.track_id && s.isCoverFeature) ? 'var(--gold)' : 'var(--text-muted)' }}>
                          ★
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          };

          return viewMode === 'grid' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              {filtered.map(cluster => {
                const isSelected = selections.some(s => s.albumId === cluster.album_spotify_id);
                const isExpanded = expandedAlbum === cluster.album_spotify_id;
                return (
                  <div key={cluster.album_spotify_id} style={{ gridColumn: isExpanded ? '1 / -1' : undefined, alignSelf: 'start' }}>
                    <div onClick={() => handleTap(cluster)} style={{
                      borderRadius: 8, overflow: 'hidden', cursor: 'pointer',
                      border: isSelected ? '2px solid var(--gold)' : '2px solid transparent',
                      background: isSelected ? 'rgba(212,168,67,0.06)' : 'var(--midnight)',
                    }}>
                      <img src={cluster.tracks[0]?.cover_art_300 || cluster.tracks[0]?.cover_art_640}
                        alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
                      <div style={{ padding: '6px 8px' }}>
                        <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          color: isSelected ? 'var(--gold)' : 'var(--text-primary)' }}>
                          {cluster.album_name}
                        </div>
                        <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {cluster.artist_names}
                          {!cluster.isSingle && ` · ${cluster.tracks.length} ${cluster.tracks.length === 1 ? 'track' : 'tracks'}`}
                        </div>
                      </div>
                    </div>
                    {renderTrackPicker(cluster)}
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {filtered.map(cluster => {
                const isSelected = selections.some(s => s.albumId === cluster.album_spotify_id);
                return (
                  <div key={cluster.album_spotify_id}>
                    <div onClick={() => handleTap(cluster)} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 4px',
                      borderBottom: '1px solid var(--midnight-border)', cursor: 'pointer',
                      background: isSelected ? 'rgba(212,168,67,0.06)' : 'transparent',
                    }}>
                      <img src={cluster.tracks[0]?.cover_art_300 || cluster.tracks[0]?.cover_art_640}
                        alt="" style={{ width: 52, height: 52, borderRadius: 6, flexShrink: 0,
                        border: isSelected ? '2px solid var(--gold)' : '2px solid transparent' }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: isSelected ? 'var(--gold)' : 'var(--text-primary)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {cluster.album_name}
                        </div>
                        <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)' }}>
                          {cluster.artist_names} · {cluster.isSingle ? 'Single' : `${cluster.tracks.length} ${cluster.tracks.length === 1 ? 'track' : 'tracks'} ▸`}
                        </div>
                      </div>
                      {isSelected && (
                        <button onClick={e => { e.stopPropagation(); onSetCoverFeature(cluster.tracks[0].track_id); }}
                          style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', flexShrink: 0,
                            color: selections.find(s => s.albumId === cluster.album_spotify_id && s.isCoverFeature) ? 'var(--gold)' : 'var(--text-muted)' }}>
                          ★
                        </button>
                      )}
                    </div>
                    {renderTrackPicker(cluster)}
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

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
            <p style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, marginBottom: 16, color: 'var(--gold)' }}>Carousel Settings</p>

            {/* Carousel Shape */}
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

            {/* Grid Slide Template */}
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 8 }}>Grid Slide Template</p>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, marginBottom: 16, WebkitOverflowScrolling: 'touch' }}>
              {gridTemplates.map(t => (
                <button
                  key={t.id}
                  onClick={() => onGridTemplateChange?.(t.id)}
                  style={{
                    flexShrink: 0, width: 80, padding: 6, borderRadius: 10, cursor: 'pointer',
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

            {/* Title Slide Template */}
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 8 }}>Title Slide Template</p>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, marginBottom: 16, WebkitOverflowScrolling: 'touch' }}>
              <button
                onClick={() => onTitleTemplateChange?.('none')}
                style={{
                  flexShrink: 0, width: 80, padding: 6, borderRadius: 10, cursor: 'pointer',
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
                    flexShrink: 0, width: 80, padding: 6, borderRadius: 10, cursor: 'pointer',
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

            {/* Logo Upload */}
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 8 }}>Center Logo</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <img src={activeLogo} alt="Logo" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' }} />
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
            ⚙ Settings
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
