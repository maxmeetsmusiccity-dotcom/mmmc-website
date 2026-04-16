import { Link } from 'react-router-dom';
import { downloadJSON, downloadCSV } from '../lib/downloads';
import type { TrackItem } from '../lib/spotify';
import type { SelectionSlot } from '../lib/selection';
import type { CarouselAspect } from '../lib/canvas-grid';

interface MobileToolsSheetProps {
  onClose: () => void;
  onNewScan: () => void;
  onAddTracks: () => void;
  onSelectAll: () => void;
  onClearSelections: () => void;
  selectionsCount: number;
  // View mode
  viewMode: 'releases' | 'tracks';
  onViewModeChange: (mode: 'releases' | 'tracks') => void;
  releaseCount: number;
  trackCount: number;
  // Card size
  cardSize: number;
  onCardSizeChange: (size: number) => void;
  // Exports
  exportScope: 'all' | 'selects';
  onExportScopeChange: (scope: 'all' | 'selects') => void;
  selectedTracks: TrackItem[];
  allTracks: TrackItem[];
  artDownloading: boolean;
  onArtDownload: () => void;
  copied: boolean;
  onCopyManifest: () => void;
  // Carousel
  carouselAspect: CarouselAspect;
  onAspectChange: (a: CarouselAspect) => void;
  selections: SelectionSlot[];
  allPreviewsCount: number;
  tracksPerSlide: number;
  // Utilities
  onDownloadZip: () => void;
  historyLength: number;
  onUndo: () => void;
  onShowShortcuts: () => void;
}

export default function MobileToolsSheet({
  onClose, onNewScan, onAddTracks, onSelectAll, onClearSelections, selectionsCount,
  viewMode, onViewModeChange, releaseCount, trackCount,
  cardSize, onCardSizeChange,
  exportScope, onExportScopeChange, selectedTracks, allTracks, artDownloading, onArtDownload, copied, onCopyManifest,
  carouselAspect, onAspectChange, selections, allPreviewsCount, tracksPerSlide,
  onDownloadZip, historyLength, onUndo, onShowShortcuts,
}: MobileToolsSheetProps) {
  const exportTracks = exportScope === 'selects' ? selectedTracks : allTracks;

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 98, background: 'rgba(0,0,0,0.5)' }}
      />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 99,
        background: 'var(--midnight-raised)', borderTop: '2px solid var(--gold-dark)',
        borderRadius: '16px 16px 0 0', padding: '12px 16px 24px',
        maxHeight: '75vh', overflowY: 'auto',
        boxShadow: '0 -8px 32px rgba(0,0,0,0.6)',
        animation: 'sheetSlideUp 200ms ease',
      }}>
        {/* Drag handle */}
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--midnight-border)', margin: '0 auto 14px' }} />

        {/* Source actions */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <button className="btn btn-sm" onClick={onNewScan} style={{ flex: 1, justifyContent: 'center' }}>New Scan</button>
          <button className="btn btn-sm" onClick={onAddTracks} style={{ flex: 1, justifyContent: 'center', color: 'var(--gold)', border: '1px solid var(--gold-dark)' }}>+ Add Tracks</button>
        </div>

        {/* Selection */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <button className="btn btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={onSelectAll}>Select All</button>
          {selectionsCount > 0 && (
            <button className="btn btn-sm" style={{ flex: 1, justifyContent: 'center', color: 'var(--mmmc-red)' }}
              onClick={onClearSelections}>
              Clear ({selectionsCount})
            </button>
          )}
        </div>

        {/* View mode + stats */}
        <div style={{ borderTop: '1px solid var(--midnight-border)', paddingTop: 12, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-xs)' }}>
              {viewMode === 'releases' ? `${releaseCount} releases (${trackCount} tracks)` : `${trackCount} tracks`}
            </span>
            <button className={`filter-pill ${viewMode === 'releases' ? 'active' : ''}`}
              onClick={() => onViewModeChange('releases')} style={{ fontSize: 'var(--fs-2xs)', padding: '2px 8px' }}>Albums</button>
            <button className={`filter-pill ${viewMode === 'tracks' ? 'active' : ''}`}
              onClick={() => onViewModeChange('tracks')} style={{ fontSize: 'var(--fs-2xs)', padding: '2px 8px' }}>Tracks</button>
            <Link to="/newmusicfriday/archive" className="filter-pill" onClick={onClose}
              style={{ textDecoration: 'none', fontSize: 'var(--fs-2xs)', padding: '2px 8px', display: 'inline-flex', alignItems: 'center' }}>
              Archive
            </Link>
          </div>
          {/* Card size */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>Card Size</span>
            <input type="range" min="120" max="350" value={cardSize}
              onChange={e => { const v = Number(e.target.value); onCardSizeChange(v); try { localStorage.setItem('nmf_card_size', String(v)); } catch {} }}
              style={{ flex: 1 }} />
            <span className="mono" style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)' }}>{cardSize}px</span>
          </div>
        </div>

        {/* Exports */}
        <div style={{ borderTop: '1px solid var(--midnight-border)', paddingTop: 12, marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            <button className={`filter-pill ${exportScope === 'all' ? 'active' : ''}`}
              onClick={() => onExportScopeChange('all')} style={{ fontSize: 'var(--fs-2xs)', padding: '2px 8px' }}>All Tracks</button>
            <button className={`filter-pill ${exportScope === 'selects' ? 'active' : ''}`}
              onClick={() => onExportScopeChange('selects')} style={{ fontSize: 'var(--fs-2xs)', padding: '2px 8px' }}>Selects</button>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-sm" style={{ fontSize: 'var(--fs-2xs)', padding: '3px 8px' }}
              onClick={() => downloadCSV(exportTracks, exportScope === 'selects' ? 'nmf-curated.csv' : 'nmf-all-tracks.csv')}>CSV</button>
            <button className="btn btn-sm" style={{ fontSize: 'var(--fs-2xs)', padding: '3px 8px' }}
              onClick={() => downloadJSON(exportTracks, exportScope === 'selects' ? 'nmf-curated.json' : 'nmf-all-tracks.json')}>JSON</button>
            <button className="btn btn-sm" style={{ fontSize: 'var(--fs-2xs)', padding: '3px 8px' }}
              onClick={onArtDownload}
              disabled={artDownloading}>{artDownloading ? '...' : 'Art ZIP'}</button>
            {exportScope === 'selects' && (
              <button className="btn btn-sm" style={{ fontSize: 'var(--fs-2xs)', padding: '3px 8px' }}
                onClick={onCopyManifest}>{copied ? 'Copied!' : 'Manifest'}</button>
            )}
          </div>
        </div>

        {/* Carousel settings */}
        <div style={{ borderTop: '1px solid var(--midnight-border)', paddingTop: 12, marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>Aspect:</span>
            <button className={`filter-pill ${carouselAspect === '1:1' ? 'active' : ''}`}
              onClick={() => onAspectChange('1:1')} style={{ fontSize: 'var(--fs-2xs)', padding: '3px 8px' }}>1:1</button>
            <button className={`filter-pill ${carouselAspect === '3:4' ? 'active' : ''}`}
              onClick={() => onAspectChange('3:4')} style={{ fontSize: 'var(--fs-2xs)', padding: '3px 8px' }}>3:4</button>
            {selectionsCount > 0 && (
              <span className="mono" style={{ color: 'var(--gold)', fontSize: 'var(--fs-md)', fontWeight: 700 }}>
                {allPreviewsCount > 0 ? allPreviewsCount : Math.ceil(selectionsCount / tracksPerSlide) + 1} slides
              </span>
            )}
          </div>
          {/* Cover feature indicator */}
          {selectionsCount > 0 && (
            <div style={{ marginTop: 8 }}>
              {(() => {
                const cover = selections.find(s => s.isCoverFeature);
                return cover ? (
                  <span style={{ color: 'var(--gold)', fontSize: 'var(--fs-xs)', fontWeight: 600 }}>
                    &#9733; {(cover.track.artist_names || '').split(/,/)[0]}
                  </span>
                ) : (
                  <span style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-xs)' }}>Set cover &#9733;</span>
                );
              })()}
            </div>
          )}
        </div>

        {/* Utilities */}
        <div style={{ display: 'flex', gap: 8, borderTop: '1px solid var(--midnight-border)', paddingTop: 12 }}>
          {allPreviewsCount > 0 && (
            <button className="btn btn-sm" style={{ fontSize: 'var(--fs-2xs)', padding: '3px 10px' }}
              onClick={() => { onClose(); onDownloadZip(); }}>
              ZIP ({allPreviewsCount})
            </button>
          )}
          {historyLength > 0 && (
            <button className="btn btn-sm" style={{ fontSize: 'var(--fs-2xs)', padding: '3px 8px' }}
              onClick={onUndo}>
              Undo ({historyLength})
            </button>
          )}
          <button className="btn btn-sm" style={{ fontSize: 'var(--fs-2xs)', padding: '3px 8px' }}
            onClick={() => { onClose(); onShowShortcuts(); }}>
            Shortcuts
          </button>
        </div>
      </div>
    </>
  );
}
