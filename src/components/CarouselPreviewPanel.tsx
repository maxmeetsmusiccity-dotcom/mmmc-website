import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { TrackItem } from '../lib/spotify';
import { getLastFriday } from '../lib/spotify';
import { generateGridSlide, generateTitleSlide, downloadBlob } from '../lib/canvas-grid';
import { getGridsForCount } from '../lib/grid-layouts';
import { getPlatform, PLATFORMS } from '../lib/platforms';
import { generatePlatformImage, PLATFORM_LIST, type PlatformId } from '../lib/cross-platform';
import TemplateSelector from './TemplateSelector';
import TitleTemplatePicker from './TitleTemplatePicker';
import SlideSplitter, { type SlideGroup } from './SlideSplitter';
import type { SelectionSlot } from '../lib/selection';
import { buildSlots } from '../lib/selection';

/** Compute valid tracks-per-slide options based on total selected tracks */
function getTracksPerSlideOptions(totalTracks: number): { value: number; label: string }[] {
  const options: { value: number; label: string }[] = [];
  const seen = new Set<number>();

  // Always include standard options
  const standards = [
    { value: 4, label: '2×2' },
    { value: 6, label: '2×3' },
    { value: 8, label: '3×3+Logo' },
    { value: 9, label: '3×3' },
    { value: 16, label: '4×4' },
  ];

  // Add divisors of totalTracks (≤16) for exact splits
  if (totalTracks > 1) {
    for (let d = 2; d <= Math.min(totalTracks, 16); d++) {
      if (totalTracks % d === 0 && !seen.has(d)) {
        seen.add(d);
        // Find a label
        const std = standards.find(s => s.value === d);
        if (std) {
          options.push(std);
        } else {
          // Generate label from factorization
          const factors: string[] = [];
          for (let c = 2; c <= Math.min(d, 10); c++) {
            if (d % c === 0 && d / c <= 10) {
              factors.push(`${c}×${d / c}`);
              break;
            }
          }
          options.push({ value: d, label: factors[0] || `${d}` });
        }
      }
    }
  }

  // Always include standard options even if not exact divisors
  for (const s of standards) {
    if (!seen.has(s.value)) {
      seen.add(s.value);
      options.push(s);
    }
  }

  options.sort((a, b) => a.value - b.value);
  return options;
}

interface Props {
  selectedTracks: TrackItem[];
  coverFeature: SelectionSlot | null;
  onTracksPerSlideChange?: (n: number) => void;
}

export default function CarouselPreviewPanel({ selectedTracks, coverFeature, onTracksPerSlideChange }: Props) {
  const [tracksPerSlide, setTracksPerSlide] = useState(8);
  const [platformId, setPlatformId] = useState('ig-post');
  const [gridTemplateId, setGridTemplateId] = useState(localStorage.getItem('nmf_template') || 'mmmc_classic');
  const [titleTemplateId, setTitleTemplateId] = useState('nashville_neon');
  const [slideGroups, setSlideGroups] = useState<SlideGroup[]>([]);
  const manualSplit = useRef(false);
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
    const opts = getGridsForCount(tracksPerSlide);
    // Prefer logo variants (3x3+logo for 8), then exact fit
    const best = opts.logo[0] || opts.exact.find(g => g.columns > 1 && g.rows > 1) || opts.exact[0];
    return best?.id || '';
  }, [tracksPerSlide]);

  // Total slides
  const slideCount = Math.ceil(selectedTracks.length / tracksPerSlide);
  const totalSlides = (titleTemplateId !== 'none' ? 1 : 0) + slideCount;

  // Auto-update slide groups when tracks or tracksPerSlide change (skip if user made manual splits)
  useEffect(() => {
    if (manualSplit.current) return;
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
    console.log('[PREVIEW] Rendering grid with template:', gridTemplateId, 'layout:', gridLayoutId);
    const firstSlice = selectedTracks.slice(0, tracksPerSlide);
    const slots = buildSlots(firstSlice.map((t, i) => ({
      track: t, albumId: t.album_spotify_id,
      selectionNumber: i + 1, slideGroup: 1,
      positionInSlide: i + 1, isCoverFeature: false,
    })));
    // Clear previous preview immediately to show loading state
    setGridPreview('');
    generateGridSlide(slots, weekDate, gridTemplateId, '/mmmc-logo.png', gridLayoutId)
      .then(blob => {
        const url = URL.createObjectURL(blob);
        setGridPreview(prev => { if (prev) URL.revokeObjectURL(prev); return url; });
      })
      .catch(e => console.error('[PREVIEW] Grid render error:', e));
  }, [gridTemplateId, gridLayoutId, selectedTracks, tracksPerSlide, weekDate]);

  // Live preview: render title slide using TitleSlideTemplate (independent of grid template)
  useEffect(() => {
    if (!coverFeature || titleTemplateId === 'none') {
      setTitlePreview('');
      return;
    }
    generateTitleSlide(coverFeature, weekDate, titleTemplateId)
      .then(blob => {
        const url = URL.createObjectURL(blob);
        setTitlePreview(prev => { if (prev) URL.revokeObjectURL(prev); return url; });
      })
      .catch(e => console.error('[PREVIEW] Title render error:', e));
  }, [titleTemplateId, coverFeature, weekDate]);

  const handleGridTemplateChange = (id: string) => {
    setGridTemplateId(id);
    localStorage.setItem('nmf_template', id);
    setAllPreviews([]);
  };

  const handleSplitChange = useCallback((groups: SlideGroup[]) => {
    manualSplit.current = true;
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

      // Title slide (uses TitleSlideTemplate, independent of grid style)
      if (titleTemplateId !== 'none' && coverFeature) {
        const titleBlob = await generateTitleSlide(coverFeature, weekDate, titleTemplateId);
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

      {/* TWO-COLUMN LAYOUT: controls left, larger previews right */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(280px, 2fr) minmax(350px, 3fr)',
        gap: 24,
      }}>
        {/* LEFT COLUMN: Selectors */}
        <div>
          {/* Tracks per slide */}
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8 }}>Tracks per slide</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {getTracksPerSlideOptions(selectedTracks.length).map(opt => (
                <button
                  key={opt.value}
                  onClick={() => { manualSplit.current = false; setTracksPerSlide(opt.value); onTracksPerSlideChange?.(opt.value); }}
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
              {slideGroups.length > 0 && (
                <button
                  onClick={() => {
                    // Fisher-Yates shuffle tracks within each slide group
                    const shuffled = slideGroups.map(group => {
                      const tracks = [...group.tracks];
                      for (let i = tracks.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
                      }
                      return { ...group, tracks };
                    });
                    setSlideGroups(shuffled);
                    setAllPreviews([]);
                  }}
                  style={{ marginLeft: 8, fontSize: '0.6rem', color: 'var(--steel)', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Shuffle All
                </button>
              )}
            </p>
          </div>

          {/* Platform export */}
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8 }}>
              Export for Platform <span style={{ fontSize: '0.6rem' }}>({platform.width}x{platform.height}, max {platform.maxSlides} slides)</span>
            </p>
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
            {/* Quick export for non-Instagram platforms */}
            {!platformId.startsWith('ig-') && selectedTracks.length > 0 && (
              <button
                className="btn btn-sm"
                style={{ marginTop: 8, fontSize: '0.7rem' }}
                onClick={async () => {
                  const mapped: Record<string, PlatformId> = {
                    'tiktok': 'tiktok', 'facebook': 'facebook', 'twitter': 'twitter', 'linkedin': 'facebook',
                  };
                  const crossId = mapped[platformId];
                  if (!crossId) return;
                  const slots = buildSlots(selectedTracks.map((t, i) => ({
                    track: t, albumId: t.album_spotify_id,
                    selectionNumber: i + 1, slideGroup: 1,
                    positionInSlide: i + 1, isCoverFeature: false,
                  })));
                  const blob = await generatePlatformImage(slots, weekDate, crossId, gridTemplateId);
                  downloadBlob(blob, `nmf-${platformId}-${platform.width}x${platform.height}.png`);
                }}
              >
                Download {platform.name} Image ({platform.width}x{platform.height})
              </button>
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
                  width: '100%', borderRadius: 8,
                  border: '1px solid var(--midnight-border)',
                }}
              />
            ) : (
              <div style={{
                width: '100%', aspectRatio: '1',
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
                    width: '100%', borderRadius: 8,
                    border: '1px solid var(--midnight-border)',
                  }}
                />
              ) : (
                <div style={{
                  width: '100%', aspectRatio: '1',
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
          data-testid="generate-button"
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
        {allPreviews.length > 0 && PLATFORM_LIST.filter(p => p.id !== 'instagram').map(p => (
          <button
            key={p.id}
            className="btn btn-sm"
            onClick={async () => {
              const slots = buildSlots(selectedTracks.map((t, i) => ({
                track: t, albumId: t.album_spotify_id,
                selectionNumber: i + 1, slideGroup: 1,
                positionInSlide: i + 1, isCoverFeature: false,
              })));
              const blob = await generatePlatformImage(slots, weekDate, p.id as PlatformId, gridTemplateId);
              downloadBlob(blob, `nmf-${p.id}-${p.w}x${p.h}.png`);
            }}
            style={{ fontSize: '0.6rem' }}
          >
            {p.label} ({p.w}×{p.h})
          </button>
        ))}
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
