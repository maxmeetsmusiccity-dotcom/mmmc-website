import { Link } from 'react-router-dom';
import FilterBar from './FilterBar';
import ManualImport from './ManualImport';
import { downloadJSON, downloadCSV } from '../lib/downloads';
import type { TrackItem, ReleaseCluster } from '../lib/spotify';
import type { SelectionSlot } from '../lib/selection';
import type { CarouselAspect } from '../lib/canvas-grid';

type FilterKey = 'all' | 'single' | 'album';
type SortKey = 'date' | 'artist' | 'title';

interface StickyToolbarProps {
  toolbarRef: (node: HTMLDivElement | null) => void;
  headerHeight: number;
  toolbarHeight: number;
  // Selection
  selections: SelectionSlot[];
  targetCount: number;
  onTargetCountChange: (n: number) => void;
  onSelectAll: () => void;
  onClearSelections: () => void;
  // Navigation
  onNewScan: () => void;
  // Add Tracks
  showAddTracks: boolean;
  onToggleAddTracks: () => void;
  onCloseAddTracks: () => void;
  onManualImport: (tracks: TrackItem[]) => void;
  onNashvilleReleases: () => void;
  token: string | null;
  onRescanSpotify: () => void;
  // Filters
  filter: FilterKey;
  sort: SortKey;
  searchInput: string;
  onFilterChange: (f: FilterKey) => void;
  onSortChange: (s: SortKey) => void;
  onSearchChange: (s: string) => void;
  // View
  viewMode: 'releases' | 'tracks';
  onViewModeChange: (m: 'releases' | 'tracks') => void;
  filteredReleasesCount: number;
  trackCount: number;
  // Card size
  cardSize: number;
  onCardSizeChange: (size: number) => void;
  // Exports
  exportScope: 'all' | 'selects';
  onExportScopeChange: (s: 'all' | 'selects') => void;
  selectedTracks: TrackItem[];
  allTracks: TrackItem[];
  artDownloading: boolean;
  onArtDownload: () => void;
  copied: boolean;
  onCopyManifest: () => void;
  // Carousel
  carouselAspect: CarouselAspect;
  onAspectChange: (a: CarouselAspect) => void;
  generating: boolean;
  onGenerate: () => void;
  onDownloadZip: () => void;
  allPreviewsCount: number;
  tracksPerSlide: number;
  // Undo
  historyLength: number;
  onUndo: () => void;
  // Misc
  onShowShortcuts: () => void;
  // Mobile
  onShowToolsSheet: () => void;
  filteredReleases: ReleaseCluster[];
  onMobileSelectAll: () => void;
  onMobileClear: () => void;
}

export default function StickyToolbar({
  toolbarRef, headerHeight, toolbarHeight,
  selections, targetCount, onTargetCountChange, onSelectAll, onClearSelections,
  onNewScan,
  showAddTracks, onToggleAddTracks, onCloseAddTracks, onManualImport, onNashvilleReleases, token, onRescanSpotify,
  filter, sort, searchInput, onFilterChange, onSortChange, onSearchChange,
  viewMode, onViewModeChange, filteredReleasesCount, trackCount,
  cardSize, onCardSizeChange,
  exportScope, onExportScopeChange, selectedTracks, allTracks, artDownloading, onArtDownload, copied, onCopyManifest,
  carouselAspect, onAspectChange, generating, onGenerate, onDownloadZip, allPreviewsCount, tracksPerSlide,
  historyLength, onUndo,
  onShowShortcuts,
  onShowToolsSheet, filteredReleases, onMobileSelectAll, onMobileClear,
}: StickyToolbarProps) {
  const exportTracks = exportScope === 'selects' ? selectedTracks : allTracks;
  const exportFilename = (ext: string) => exportScope === 'selects' ? `nmf-curated.${ext}` : `nmf-all-tracks.${ext}`;

  return (
    <>
      <div ref={toolbarRef} style={{
        position: 'fixed', top: headerHeight, left: 0, right: 0, zIndex: 35,
        background: 'var(--midnight)', borderBottom: '2px solid var(--midnight-border)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        transition: 'top 200ms ease',
      }}>
        {/* ---- Desktop toolbar (hidden on mobile) ---- */}
        <div className="desktop-only">
        {/* Row 1: Selection counter + target + filters + stats */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 12, minHeight: 48,
          padding: '12px 24px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="mono" style={{
              fontSize: 'var(--fs-2xl)', fontWeight: 700,
              color: selections.length > targetCount ? 'var(--mmmc-red)' : selections.length > 0 ? 'var(--gold)' : 'var(--text-muted)',
            }}>
              {selections.length}
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-md)' }}>/ {targetCount}</span>
            {selections.length > targetCount && (
              <span style={{ color: 'var(--mmmc-red)', fontSize: 'var(--fs-xs)', fontWeight: 600 }}>Over limit!</span>
            )}
            <select
              value={targetCount}
              onChange={e => onTargetCountChange(Number(e.target.value))}
              style={{
                background: 'var(--midnight)', border: '1px solid var(--midnight-border)',
                borderRadius: 6, color: 'var(--text-secondary)', padding: '3px 6px',
                fontSize: 'var(--fs-xs)', fontFamily: 'var(--font-mono)',
              }}
            >
              {Array.from({ length: 50 }, (_, i) => i + 1).map(n => (
                <option key={n} value={n}>{n} track{n !== 1 ? 's' : ''}</option>
              ))}
            </select>
            {/* New Scan + Add Tracks buttons */}
            <button
              className="btn btn-sm"
              onClick={onNewScan}
              style={{ fontSize: 'var(--fs-2xs)', padding: '2px 8px' }}
            >
              New Scan
            </button>
            <button
              onClick={onToggleAddTracks}
              style={{
                fontSize: 'var(--fs-2xs)', color: 'var(--gold)', cursor: 'pointer',
                padding: '2px 8px', borderRadius: 6,
                border: '1px solid var(--gold-dark)', background: 'rgba(212,168,67,0.08)',
              }}
              title="Add more tracks from CSV, Nashville, or artist browser"
            >
              + Add Tracks
            </button>
            {/* Add Tracks panel — centered overlay */}
            {showAddTracks && (
              <>
                <div
                  onClick={onCloseAddTracks}
                  style={{ position: 'fixed', inset: 0, zIndex: 99, background: 'rgba(0,0,0,0.5)' }}
                />
                <div style={{
                  position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                  zIndex: 100, background: 'var(--midnight-raised)', border: '1px solid var(--midnight-border)',
                  borderRadius: 12, padding: '20px 24px', width: 'min(480px, 90vw)', maxHeight: '75vh', overflow: 'auto',
                  boxShadow: '0 12px 48px rgba(0,0,0,0.6)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <span style={{ fontSize: 'var(--fs-lg)', fontWeight: 600 }}>Add Tracks</span>
                    <button
                      onClick={onCloseAddTracks}
                      style={{
                        background: 'none', border: 'none', color: 'var(--text-muted)',
                        fontSize: 'var(--fs-xl)', cursor: 'pointer', padding: '0 4px', lineHeight: 1,
                      }}
                      title="Close"
                    >
                      &times;
                    </button>
                  </div>
                  <ManualImport onImport={onManualImport} />
                  <button className="btn btn-sm" onClick={onNashvilleReleases} style={{ width: '100%', marginTop: 12, justifyContent: 'center' }}>
                    Nashville Releases
                  </button>
                  {token && (
                    <button className="btn btn-sm btn-spotify" onClick={onRescanSpotify} style={{ width: '100%', marginTop: 8, justifyContent: 'center' }}>
                      Re-scan Spotify
                    </button>
                  )}
                </div>
              </>
            )}
            <span style={{ color: 'var(--midnight-border)', margin: '0 2px' }}>|</span>
            {/* Select All / Clear */}
            <button
              onClick={onSelectAll}
              style={{ fontSize: 'var(--fs-2xs)', color: 'var(--steel)', cursor: 'pointer', padding: '2px 6px' }}
              title="Select the title track from every visible release (Cmd+A)"
            >
              Select All
            </button>
            {selections.length > 0 && (
              <button
                onClick={onClearSelections}
                style={{ fontSize: 'var(--fs-2xs)', color: 'var(--mmmc-red)', cursor: 'pointer', padding: '2px 6px' }}
                title="Remove all selections (Cmd+Shift+A)"
              >
                Clear
              </button>
            )}
            <span style={{ color: 'var(--midnight-border)', margin: '0 2px' }}>|</span>
            <FilterBar
              filter={filter} sort={sort} search={searchInput}
              onFilterChange={onFilterChange} onSortChange={onSortChange} onSearchChange={onSearchChange}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-xs)' }}>
              {viewMode === 'releases'
                ? `${filteredReleasesCount} releases (${trackCount} tracks)`
                : `${trackCount} tracks`}
            </span>
            <button
              className={`filter-pill ${viewMode === 'releases' ? 'active' : ''}`}
              onClick={() => onViewModeChange('releases')}
              style={{ fontSize: 'var(--fs-2xs)', padding: '2px 8px' }}
            >Albums</button>
            <button
              className={`filter-pill ${viewMode === 'tracks' ? 'active' : ''}`}
              onClick={() => onViewModeChange('tracks')}
              style={{ fontSize: 'var(--fs-2xs)', padding: '2px 8px' }}
            >Tracks</button>
            <Link to="/newmusicfriday/archive" className="filter-pill" style={{ textDecoration: 'none', fontSize: 'var(--fs-2xs)', padding: '2px 8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              Archive
            </Link>
            {/* Thumbnail size */}
            <span style={{ color: 'var(--midnight-border)', margin: '0 2px' }}>|</span>
            <button onClick={() => { const v = Math.max(120, cardSize - 40); onCardSizeChange(v); try { localStorage.setItem('nmf_card_size', String(v)); } catch {} }}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14, padding: '0 4px' }} title="Smaller">&#8722;</button>
            <input
              type="range" min="120" max="350" value={cardSize}
              onChange={e => { const v = Number(e.target.value); onCardSizeChange(v); try { localStorage.setItem('nmf_card_size', String(v)); } catch {} }}
              onDoubleClick={() => { onCardSizeChange(200); try { localStorage.setItem('nmf_card_size', '200'); } catch {} }}
              style={{ width: 60 }}
              title={`${cardSize}px · double-click to reset`}
            />
            <button onClick={() => { const v = Math.min(350, cardSize + 40); onCardSizeChange(v); try { localStorage.setItem('nmf_card_size', String(v)); } catch {} }}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14, padding: '0 4px' }} title="Larger">+</button>
          </div>
        </div>

        {/* Row 2: Actions — exports + cover/aspect + generate + indicators */}
        <div style={{
          padding: '12px 24px',
          borderTop: '1px solid var(--midnight-border)',
          display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center',
          fontSize: 'var(--fs-xs)', minHeight: 44,
        }}>
          {/* Export scope toggle */}
          <div style={{ display: 'flex', gap: 2, marginRight: 4 }}>
            <button className={`filter-pill ${exportScope === 'all' ? 'active' : ''}`}
              onClick={() => onExportScopeChange('all')}
              style={{ fontSize: 'var(--fs-3xs)', padding: '2px 6px' }}>All Tracks</button>
            <button className={`filter-pill ${exportScope === 'selects' ? 'active' : ''}`}
              onClick={() => onExportScopeChange('selects')}
              style={{ fontSize: 'var(--fs-3xs)', padding: '2px 6px' }}>Selects</button>
          </div>
          <span style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-3xs)', fontWeight: 600 }}>Downloads:</span>
          <button className="btn btn-sm" style={{ fontSize: 'var(--fs-2xs)', padding: '3px 8px' }}
            onClick={() => downloadCSV(exportTracks, exportFilename('csv'))}>CSV</button>
          <button className="btn btn-sm" style={{ fontSize: 'var(--fs-2xs)', padding: '3px 8px' }}
            onClick={() => downloadJSON(exportTracks, exportFilename('json'))}>JSON</button>
          <button className="btn btn-sm" style={{ fontSize: 'var(--fs-2xs)', padding: '3px 8px' }}
            onClick={onArtDownload}
            disabled={artDownloading}>{artDownloading ? '...' : 'Art ZIP'}</button>
          {exportScope === 'selects' && (
            <button className="btn btn-sm" style={{ fontSize: 'var(--fs-2xs)', padding: '3px 8px' }}
              onClick={onCopyManifest}>{copied ? 'Copied!' : 'Manifest'}</button>
          )}

          <span style={{ color: 'var(--midnight-border)', margin: '0 4px' }}>|</span>

          {/* Cover feature indicator */}
          {selections.length > 0 && (
            (() => {
              const cover = selections.find(s => s.isCoverFeature);
              return cover ? (
                <span style={{ color: 'var(--gold)', fontSize: 'var(--fs-xs)', fontWeight: 600 }}>
                  &#9733; {(cover.track.artist_names || '').split(/,/)[0]}
                </span>
              ) : (
                <span style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-xs)' }}>Set cover &#9733;</span>
              );
            })()
          )}

          {/* Aspect ratio toggle */}
          <div style={{ display: 'flex', gap: 2 }}>
            <button className={`filter-pill ${carouselAspect === '1:1' ? 'active' : ''}`}
              onClick={() => onAspectChange('1:1')}
              style={{ fontSize: 'var(--fs-2xs)', padding: '3px 8px' }}>1:1</button>
            <button className={`filter-pill ${carouselAspect === '3:4' ? 'active' : ''}`}
              onClick={() => onAspectChange('3:4')}
              style={{ fontSize: 'var(--fs-2xs)', padding: '3px 8px' }}>3:4</button>
          </div>

          {/* Generate Carousel */}
          <button className="btn btn-sm btn-gold" style={{ fontSize: 'var(--fs-2xs)', padding: '4px 12px', fontWeight: 700 }}
            disabled={selections.length === 0 || generating}
            onClick={onGenerate}>
            {generating ? 'Generating...' : '★ Generate'}
          </button>

          {/* Download ZIP */}
          {allPreviewsCount > 0 && (
            <button className="btn btn-sm" style={{ fontSize: 'var(--fs-2xs)', padding: '3px 10px' }}
              onClick={onDownloadZip}>
              ZIP ({allPreviewsCount})
            </button>
          )}

          {/* Slide count — use actual count when generated, estimate otherwise */}
          {selections.length > 0 && (
            <span className="mono" style={{ color: 'var(--gold)', fontSize: 'var(--fs-md)', fontWeight: 700 }}>
              {allPreviewsCount > 0 ? allPreviewsCount : Math.ceil(selections.length / tracksPerSlide) + 1} slides
            </span>
          )}

          {/* Undo */}
          {historyLength > 0 && (
            <button className="btn btn-sm" style={{ fontSize: 'var(--fs-2xs)', padding: '3px 8px' }}
              onClick={onUndo}
              title="Undo last selection change">
              Undo ({historyLength})
            </button>
          )}

          {/* Keyboard shortcuts — same size as CSV/JSON buttons */}
          <button className="btn btn-sm" style={{ fontSize: 'var(--fs-2xs)', padding: '3px 8px' }}
            onClick={onShowShortcuts} title="Keyboard shortcuts">Shortcuts</button>
        </div>
        </div>{/* end desktop-only */}

        {/* ---- Mobile compact toolbar ---- */}
        <div className="mobile-only">
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', minHeight: 44,
        }}>
          <span className="mono" style={{
            fontSize: 'var(--fs-lg)', fontWeight: 700, flexShrink: 0,
            color: selections.length > targetCount ? 'var(--mmmc-red)' : selections.length > 0 ? 'var(--gold)' : 'var(--text-muted)',
          }}>
            {selections.length}<span style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-xs)', fontWeight: 400 }}>/{targetCount}</span>
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <FilterBar
              filter={filter} sort={sort} search={searchInput}
              onFilterChange={onFilterChange} onSortChange={onSortChange} onSearchChange={onSearchChange}
            />
          </div>
          {/* Cover artist indicator */}
          {(() => {
            const cover = selections.find(s => s.isCoverFeature);
            return cover ? (
              <span style={{ fontSize: 'var(--fs-2xs)', color: 'var(--gold)', fontWeight: 600, flexShrink: 0, maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                &#9733; {(cover.track.artist_names || '').split(/,/)[0]}
              </span>
            ) : null;
          })()}
          {/* Generate button */}
          <button
            className="btn btn-sm btn-gold"
            disabled={selections.length === 0 || generating}
            onClick={onGenerate}
            style={{ fontSize: 'var(--fs-2xs)', padding: '4px 8px', fontWeight: 700, flexShrink: 0, whiteSpace: 'nowrap' }}
          >
            {generating ? '...' : 'Generate'}
          </button>
          <button
            onClick={onShowToolsSheet}
            style={{
              background: 'none', border: '1px solid var(--midnight-border)', borderRadius: 6,
              color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px 10px',
              fontSize: 'var(--fs-sm)', flexShrink: 0, lineHeight: 1,
            }}
          >
            &hellip;
          </button>
        </div>
        {/* Mobile Select All / Clear row */}
        {filteredReleases.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px 8px',
            borderTop: '1px solid var(--midnight-border)',
          }}>
            <button
              style={{ fontSize: 'var(--fs-2xs)', color: 'var(--steel)', cursor: 'pointer', padding: '2px 6px', background: 'none', border: 'none' }}
              onClick={onMobileSelectAll}
            >Select All</button>
            {selections.length > 0 && (
              <button
                style={{ fontSize: 'var(--fs-2xs)', color: 'var(--mmmc-red)', cursor: 'pointer', padding: '2px 6px', background: 'none', border: 'none' }}
                onClick={onMobileClear}
              >Clear ({selections.length})</button>
            )}
            <span style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-2xs)', marginLeft: 'auto' }}>
              {filteredReleases.length} releases
            </span>
          </div>
        )}
        </div>{/* end mobile-only */}
      </div>

      {/* Spacer for toolbar only (header spacer is already above) */}
      <div style={{ height: toolbarHeight }} />
    </>
  );
}
