import { useState, useMemo, useCallback } from 'react';
import type { TrackItem } from '../lib/spotify';
import { getLastFriday } from '../lib/spotify';
import { generateGridSlide, generateCoverSlide, downloadBlob } from '../lib/canvas-grid';
import { getGridsForCount } from '../lib/grid-layouts';
import { getPlatform } from '../lib/platforms';
import TrackCountSelector from './TrackCountSelector';
import PlatformTabs from './PlatformTabs';
import GridLayoutSelector from './GridLayoutSelector';
import TemplateSelector from './TemplateSelector';
import TitleTemplatePicker from './TitleTemplatePicker';
import SlideSplitter, { type SlideGroup } from './SlideSplitter';
import type { SelectionSlot } from '../lib/selection';
import { buildSlots } from '../lib/selection';

interface Props {
  selectedTracks: TrackItem[];
  coverFeature: SelectionSlot | null;
}

export default function CarouselPreviewPanel({ selectedTracks, coverFeature }: Props) {
  const [trackCount, setTrackCount] = useState(selectedTracks.length || 8);
  const [platformId, setPlatformId] = useState('ig-post');
  const [gridTemplateId, setGridTemplateId] = useState(localStorage.getItem('nmf_template') || 'mmmc_classic');
  const [titleTemplateId, setTitleTemplateId] = useState('nashville_neon');
  const [gridLayoutId, setGridLayoutId] = useState('');
  const [slideGroups, setSlideGroups] = useState<SlideGroup[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [activePreview, setActivePreview] = useState(0);

  const platform = getPlatform(platformId);
  const weekDate = getLastFriday();

  // Tracks to use (limited by trackCount)
  const tracksToUse = useMemo(() =>
    selectedTracks.slice(0, trackCount),
    [selectedTracks, trackCount]
  );

  // Total slides (title + grid slides)
  const totalSlides = (titleTemplateId !== 'none' ? 1 : 0) + slideGroups.length;

  // Auto-select first valid grid when track count changes
  const handleTrackCountChange = useCallback((count: number) => {
    setTrackCount(count);
    const opts = getGridsForCount(count);
    const first = opts.exact[0] || opts.logo[0] || opts.close[0] || opts.mosaic[0];
    if (first) setGridLayoutId(first.id);
    setPreviews([]);
  }, []);

  const handleGridTemplateChange = (id: string) => {
    setGridTemplateId(id);
    localStorage.setItem('nmf_template', id);
    setPreviews([]);
  };

  const handleSplitChange = useCallback((groups: SlideGroup[]) => {
    setSlideGroups(groups);
    setPreviews([]);
  }, []);

  const handleGenerate = async () => {
    if (tracksToUse.length === 0) {
      setError('Select tracks first');
      return;
    }
    setGenerating(true);
    setError('');
    try {
      const urls: string[] = [];

      // Generate title slide if selected
      if (titleTemplateId !== 'none' && coverFeature) {
        const titleBlob = await generateCoverSlide(coverFeature, weekDate, gridTemplateId);
        urls.push(URL.createObjectURL(titleBlob));
      }

      // Generate grid slides
      const groups = slideGroups.length > 0 ? slideGroups : [{ tracks: tracksToUse, gridId: gridLayoutId }];
      for (const group of groups) {
        const slots = buildSlots(group.tracks.map((t, i) => ({
          track: t,
          albumId: t.album_spotify_id,
          selectionNumber: i + 1,
          slideGroup: 1,
          positionInSlide: i + 1,
          isCoverFeature: false,
        })));
        const blob = await generateGridSlide(slots, weekDate, gridTemplateId, '/mmmc-logo.png', group.gridId || gridLayoutId);
        urls.push(URL.createObjectURL(blob));
      }

      setPreviews(prev => { prev.forEach(URL.revokeObjectURL); return urls; });
      setActivePreview(0);
    } catch (e) {
      setError(`Generation failed: ${(e as Error).message}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadAll = async () => {
    for (let i = 0; i < previews.length; i++) {
      const res = await fetch(previews[i]);
      const blob = await res.blob();
      downloadBlob(blob, `nmf-${platformId}-slide-${i + 1}.png`);
      if (i < previews.length - 1) await new Promise(r => setTimeout(r, 200));
    }
  };

  return (
    <div data-testid="carousel-preview-panel" style={{
      padding: '16px 0', borderTop: '1px solid var(--midnight-border)', marginTop: 24,
    }}>
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', marginBottom: 20 }}>
        Generate Carousel
      </h3>

      {/* Step 1: Track count */}
      <TrackCountSelector value={trackCount} onChange={handleTrackCountChange} />

      {/* Step 2: Platform */}
      <PlatformTabs selected={platformId} onSelect={setPlatformId} totalSlides={totalSlides} />

      {/* Step 3: Grid layout */}
      <GridLayoutSelector
        trackCount={trackCount}
        selected={gridLayoutId}
        onSelect={id => { setGridLayoutId(id); setPreviews([]); }}
        onChangeCount={handleTrackCountChange}
      />

      {/* Step 4a: Title slide template */}
      <TitleTemplatePicker selected={titleTemplateId} onSelect={id => { setTitleTemplateId(id); setPreviews([]); }} />

      {/* Step 4b: Grid slide template */}
      <TemplateSelector selected={gridTemplateId} onSelect={handleGridTemplateChange} />

      {/* Step 5: Slide splitter (always visible) */}
      {tracksToUse.length > 0 && (
        <SlideSplitter
          tracks={tracksToUse}
          defaultTracksPerSlide={
            (() => {
              const opts = getGridsForCount(trackCount);
              const grid = [...opts.exact, ...opts.logo, ...opts.close, ...opts.mosaic].find(g => g.id === gridLayoutId);
              return grid?.trackSlots || trackCount;
            })()
          }
          onSplitChange={handleSplitChange}
        />
      )}

      {error && (
        <p style={{ color: 'var(--mmmc-red)', fontSize: '0.8rem', marginBottom: 12 }}>{error}</p>
      )}

      {/* Generate + Export */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <button
          className="btn btn-gold"
          onClick={handleGenerate}
          disabled={generating || tracksToUse.length === 0}
        >
          {generating ? 'Generating...' : previews.length > 0 ? 'Regenerate' : 'Generate Carousel'}
        </button>
        {previews.length > 0 && (
          <>
            <button className="btn btn-sm" onClick={handleDownloadAll}>
              Download All ({previews.length} slides)
            </button>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', alignSelf: 'center' }}>
              {platform.width}×{platform.height} · {platform.aspectLabel}
            </span>
          </>
        )}
      </div>

      {/* Preview area */}
      {previews.length > 0 && (
        <div>
          {/* Navigation dots */}
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 12 }}>
            {previews.map((_, i) => (
              <button
                key={i}
                onClick={() => setActivePreview(i)}
                style={{
                  width: activePreview === i ? 24 : 8, height: 8, borderRadius: 4,
                  background: activePreview === i ? 'var(--gold)' : 'var(--midnight-border)',
                  transition: 'all 0.2s', cursor: 'pointer',
                }}
              />
            ))}
          </div>

          {/* Active slide */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
            <button
              onClick={() => setActivePreview(Math.max(0, activePreview - 1))}
              disabled={activePreview === 0}
              style={{ fontSize: '1.5rem', color: activePreview === 0 ? 'var(--midnight-border)' : 'var(--gold)', cursor: 'pointer', alignSelf: 'center' }}
            >
              ‹
            </button>
            <div style={{ position: 'relative' }}>
              <img
                src={previews[activePreview]}
                alt={`Slide ${activePreview + 1}`}
                style={{
                  maxWidth: 400, maxHeight: 500, borderRadius: 8,
                  border: '1px solid var(--midnight-border)',
                }}
              />
              <span style={{
                position: 'absolute', bottom: 8, right: 8,
                background: 'rgba(0,0,0,0.7)', padding: '2px 8px',
                borderRadius: 4, fontSize: '0.6rem', color: '#fff', fontFamily: 'var(--font-mono)',
              }}>
                {activePreview + 1}/{previews.length}
              </span>
              <button
                className="btn btn-sm"
                onClick={async () => {
                  const res = await fetch(previews[activePreview]);
                  const blob = await res.blob();
                  downloadBlob(blob, `nmf-${platformId}-slide-${activePreview + 1}.png`);
                }}
                style={{ position: 'absolute', top: 8, right: 8, fontSize: '0.6rem', padding: '3px 8px' }}
              >
                Download
              </button>
            </div>
            <button
              onClick={() => setActivePreview(Math.min(previews.length - 1, activePreview + 1))}
              disabled={activePreview === previews.length - 1}
              style={{ fontSize: '1.5rem', color: activePreview === previews.length - 1 ? 'var(--midnight-border)' : 'var(--gold)', cursor: 'pointer', alignSelf: 'center' }}
            >
              ›
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
