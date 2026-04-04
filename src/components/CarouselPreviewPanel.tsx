import { useState, useMemo, useCallback, useEffect } from 'react';
import type { TrackItem } from '../lib/spotify';
import { getLastFriday } from '../lib/spotify';
import { generateGridSlide, generateCoverSlide, downloadBlob } from '../lib/canvas-grid';
import { getGridsForCount } from '../lib/grid-layouts';
import { getPlatform, PLATFORMS } from '../lib/platforms';
import TemplateSelector from './TemplateSelector';
import TitleTemplatePicker from './TitleTemplatePicker';
import SlideSplitter, { type SlideGroup } from './SlideSplitter';
import type { SelectionSlot } from '../lib/selection';
import { buildSlots } from '../lib/selection';

/** Standard tracks-per-slide options */
const TRACKS_PER_SLIDE_OPTIONS = [
  { value: 4, label: '2×2', grid: '2x2' },
  { value: 6, label: '2×3', grid: '2x3' },
  { value: 8, label: '3×3 + Logo', grid: '3x3_logo', default: true },
  { value: 9, label: '3×3', grid: '3x3' },
  { value: 15, label: '4×4 + Logo', grid: '4x4_logo' },
  { value: 16, label: '4×4', grid: '4x4' },
];

interface Props {
  selectedTracks: TrackItem[];
  coverFeature: SelectionSlot | null;
}

export default function CarouselPreviewPanel({ selectedTracks, coverFeature }: Props) {
  const [tracksPerSlide, setTracksPerSlide] = useState(8);
  const [platformId, setPlatformId] = useState('ig-post');
  const [gridTemplateId, setGridTemplateId] = useState(localStorage.getItem('nmf_template') || 'mmmc_classic');
  const [titleTemplateId, setTitleTemplateId] = useState('nashville_neon');
  const [slideGroups, setSlideGroups] = useState<SlideGroup[]>([]);
  const [gridPreview, setGridPreview] = useState<string>('');
  const [titlePreview, setTitlePreview] = useState<string>('');
  const [allPreviews, setAllPreviews] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [activePreview, setActivePreview] = useState(0);

  const platform = getPlatform(platformId);
  const weekDate = getLastFriday();

  // Compute grid layout ID from tracks per slide
  const gridLayoutId = useMemo(() => {
    const opt = TRACKS_PER_SLIDE_OPTIONS.find(o => o.value === tracksPerSlide);
    if (opt) {
      // Find matching grid
      const opts = getGridsForCount(opt.value);
      const match = [...opts.exact, ...opts.logo].find(g => g.id === opt.grid);
      return match?.id || opts.exact[0]?.id || opts.logo[0]?.id || '';
    }
    const opts = getGridsForCount(tracksPerSlide);
    return opts.exact[0]?.id || opts.logo[0]?.id || '';
  }, [tracksPerSlide]);

  // Total slides
  const slideCount = Math.ceil(selectedTracks.length / tracksPerSlide);
  const totalSlides = (titleTemplateId !== 'none' ? 1 : 0) + slideCount;

  // Auto-update slide groups when tracks or tracksPerSlide change
  useEffect(() => {
    const groups: SlideGroup[] = [];
    for (let i = 0; i < selectedTracks.length; i += tracksPerSlide) {
      groups.push({
        tracks: selectedTracks.slice(i, i + tracksPerSlide),
        gridId: gridLayoutId,
      });
    }
    setSlideGroups(groups);
  }, [selectedTracks, tracksPerSlide, gridLayoutId]);

  // Live preview: render grid slide when template or tracks change
  useEffect(() => {
    if (selectedTracks.length === 0) return;
    const firstSlice = selectedTracks.slice(0, tracksPerSlide);
    const slots = buildSlots(firstSlice.map((t, i) => ({
      track: t, albumId: t.album_spotify_id,
      selectionNumber: i + 1, slideGroup: 1,
      positionInSlide: i + 1, isCoverFeature: false,
    })));
    generateGridSlide(slots, weekDate, gridTemplateId, '/mmmc-logo.png', gridLayoutId)
      .then(blob => {
        const url = URL.createObjectURL(blob);
        setGridPreview(prev => { if (prev) URL.revokeObjectURL(prev); return url; });
      })
      .catch(() => {});
  }, [gridTemplateId, gridLayoutId, selectedTracks, tracksPerSlide, weekDate]);

  // Live preview: render title slide when title template changes
  useEffect(() => {
    if (!coverFeature || titleTemplateId === 'none') {
      setTitlePreview('');
      return;
    }
    generateCoverSlide(coverFeature, weekDate, gridTemplateId)
      .then(blob => {
        const url = URL.createObjectURL(blob);
        setTitlePreview(prev => { if (prev) URL.revokeObjectURL(prev); return url; });
      })
      .catch(() => {});
  }, [titleTemplateId, gridTemplateId, coverFeature, weekDate]);

  const handleGridTemplateChange = (id: string) => {
    setGridTemplateId(id);
    localStorage.setItem('nmf_template', id);
    setAllPreviews([]);
  };

  const handleSplitChange = useCallback((groups: SlideGroup[]) => {
    setSlideGroups(groups);
    setAllPreviews([]);
  }, []);

  const handleGenerate = async () => {
    if (selectedTracks.length === 0) {
      setError('Select tracks first');
      return;
    }
    setGenerating(true);
    setError('');
    try {
      const urls: string[] = [];

      // Title slide
      if (titleTemplateId !== 'none' && coverFeature) {
        const titleBlob = await generateCoverSlide(coverFeature, weekDate, gridTemplateId);
        urls.push(URL.createObjectURL(titleBlob));
      }

      // Grid slides
      for (const group of slideGroups) {
        const slots = buildSlots(group.tracks.map((t, i) => ({
          track: t, albumId: t.album_spotify_id,
          selectionNumber: i + 1, slideGroup: 1,
          positionInSlide: i + 1, isCoverFeature: false,
        })));
        const blob = await generateGridSlide(slots, weekDate, gridTemplateId, '/mmmc-logo.png', group.gridId || gridLayoutId);
        urls.push(URL.createObjectURL(blob));
      }

      setAllPreviews(prev => { prev.forEach(URL.revokeObjectURL); return urls; });
      setActivePreview(0);
    } catch (e) {
      setError(`Generation failed: ${(e as Error).message}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadAll = async () => {
    for (let i = 0; i < allPreviews.length; i++) {
      const res = await fetch(allPreviews[i]);
      const blob = await res.blob();
      downloadBlob(blob, `nmf-${platformId}-slide-${i + 1}.png`);
      if (i < allPreviews.length - 1) await new Promise(r => setTimeout(r, 200));
    }
  };

  if (selectedTracks.length === 0) return null;

  return (
    <div data-testid="carousel-preview-panel" style={{
      padding: '24px 0', borderTop: '1px solid var(--midnight-border)', marginTop: 24,
    }}>
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', marginBottom: 20 }}>
        ② Configure & Preview
      </h3>

      {/* TWO-COLUMN LAYOUT (desktop) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(300px, 1fr) minmax(300px, 1fr)',
        gap: 32,
      }}>
        {/* LEFT COLUMN: Selectors */}
        <div>
          {/* Tracks per slide */}
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8 }}>Tracks per slide</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {TRACKS_PER_SLIDE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setTracksPerSlide(opt.value)}
                  className={`filter-pill ${tracksPerSlide === opt.value ? 'active' : ''}`}
                  style={{ fontSize: '0.75rem' }}
                >
                  {opt.value} ({opt.label})
                </button>
              ))}
            </div>
            <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 6 }}>
              {selectedTracks.length} tracks → {slideCount} slide{slideCount !== 1 ? 's' : ''}
              {titleTemplateId !== 'none' ? ' + title slide' : ''}
            </p>
          </div>

          {/* Platform */}
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8 }}>Platform</p>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {PLATFORMS.map(p => {
                const isActive = platformId === p.id;
                const overLimit = totalSlides > p.maxSlides;
                return (
                  <button
                    key={p.id}
                    onClick={() => setPlatformId(p.id)}
                    className={`filter-pill ${isActive ? 'active' : ''}`}
                    style={{
                      fontSize: '0.65rem', padding: '4px 8px',
                      borderColor: overLimit && isActive ? 'var(--mmmc-red)' : undefined,
                      color: overLimit && isActive ? 'var(--mmmc-red)' : undefined,
                    }}
                  >
                    {p.icon} {p.name.replace('Instagram ', 'IG ')}
                  </button>
                );
              })}
            </div>
            {totalSlides > platform.maxSlides && (
              <p style={{ fontSize: '0.6rem', color: 'var(--mmmc-red)', marginTop: 4 }}>
                {platform.name} max {platform.maxSlides} slides. You have {totalSlides}.
              </p>
            )}
          </div>

          {/* Grid Slide Style */}
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8 }}>Grid Slide Style</p>
            <TemplateSelector selected={gridTemplateId} onSelect={handleGridTemplateChange} />
          </div>

          {/* Title Slide Style */}
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8 }}>Title Slide Style</p>
            <TitleTemplatePicker
              selected={titleTemplateId}
              onSelect={id => { setTitleTemplateId(id); setAllPreviews([]); }}
            />
          </div>

          {/* Slide Split */}
          <SlideSplitter
            tracks={selectedTracks}
            defaultTracksPerSlide={tracksPerSlide}
            onSplitChange={handleSplitChange}
          />
        </div>

        {/* RIGHT COLUMN: Live Previews */}
        <div style={{ position: 'sticky', top: 80, alignSelf: 'start' }}>
          {/* Grid slide preview */}
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 6 }}>
              Grid Slide Preview
            </p>
            {gridPreview ? (
              <img
                src={gridPreview}
                alt="Grid slide preview"
                style={{
                  width: '100%', maxWidth: 400, borderRadius: 8,
                  border: '1px solid var(--midnight-border)',
                }}
              />
            ) : (
              <div style={{
                width: '100%', maxWidth: 400, aspectRatio: '1',
                borderRadius: 8, background: 'var(--midnight)',
                border: '1px solid var(--midnight-border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-muted)', fontSize: '0.8rem',
              }}>
                Select tracks to see preview
              </div>
            )}
          </div>

          {/* Title slide preview */}
          {titleTemplateId !== 'none' && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 6 }}>
                Title Slide Preview
              </p>
              {titlePreview ? (
                <img
                  src={titlePreview}
                  alt="Title slide preview"
                  style={{
                    width: '100%', maxWidth: 400, borderRadius: 8,
                    border: '1px solid var(--midnight-border)',
                  }}
                />
              ) : (
                <div style={{
                  width: '100%', maxWidth: 400, aspectRatio: '1',
                  borderRadius: 8, background: 'var(--midnight)',
                  border: '1px solid var(--midnight-border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--text-muted)', fontSize: '0.8rem',
                }}>
                  {coverFeature ? 'Rendering...' : 'Set a cover feature (★) to preview'}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* GENERATE + EXPORT (full width below the two columns) */}
      {error && (
        <p style={{ color: 'var(--mmmc-red)', fontSize: '0.8rem', marginBottom: 12 }}>{error}</p>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 20, marginBottom: 16 }}>
        <button
          className="btn btn-gold"
          onClick={handleGenerate}
          disabled={generating || selectedTracks.length === 0}
        >
          {generating ? 'Generating...' : allPreviews.length > 0 ? 'Regenerate All Slides' : 'Generate Carousel'}
        </button>
        {allPreviews.length > 0 && (
          <button className="btn btn-sm" onClick={handleDownloadAll}>
            Download All ({allPreviews.length} slides)
          </button>
        )}
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', alignSelf: 'center' }}>
          {platform.width}×{platform.height} · {platform.aspectLabel} · {totalSlides} slide{totalSlides !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Full carousel preview with navigation */}
      {allPreviews.length > 0 && (
        <div>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 12 }}>
            {allPreviews.map((_, i) => (
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
                src={allPreviews[activePreview]}
                alt={`Slide ${activePreview + 1}`}
                style={{ maxWidth: 500, maxHeight: 600, borderRadius: 8, border: '1px solid var(--midnight-border)' }}
              />
              <span style={{
                position: 'absolute', bottom: 8, right: 8,
                background: 'rgba(0,0,0,0.7)', padding: '2px 8px',
                borderRadius: 4, fontSize: '0.6rem', color: '#fff', fontFamily: 'var(--font-mono)',
              }}>
                {activePreview + 1}/{allPreviews.length}
              </span>
              <button
                className="btn btn-sm"
                onClick={async () => {
                  const res = await fetch(allPreviews[activePreview]);
                  const blob = await res.blob();
                  downloadBlob(blob, `nmf-${platformId}-slide-${activePreview + 1}.png`);
                }}
                style={{ position: 'absolute', top: 8, right: 8, fontSize: '0.6rem', padding: '3px 8px' }}
              >
                Download
              </button>
            </div>
            <button
              onClick={() => setActivePreview(Math.min(allPreviews.length - 1, activePreview + 1))}
              disabled={activePreview === allPreviews.length - 1}
              style={{ fontSize: '1.5rem', color: activePreview === allPreviews.length - 1 ? 'var(--midnight-border)' : 'var(--gold)', cursor: 'pointer', alignSelf: 'center' }}
            >
              ›
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
