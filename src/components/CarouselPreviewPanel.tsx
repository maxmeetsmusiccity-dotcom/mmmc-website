import { useState, useMemo, useCallback, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import type { TrackItem } from '../lib/spotify';
import { getLastFriday } from '../lib/spotify';
import { generateGridSlide, generateTitleSlide, downloadBlob, type CarouselAspect, type SlideComposerCredit } from '../lib/canvas-grid';
import { getVisibleTemplates } from '../lib/carousel-templates';
import { getGridsForCount } from '../lib/grid-layouts';
// getPlatform used indirectly via platformId
import { generatePlatformImage, PLATFORM_LIST, type PlatformId } from '../lib/cross-platform';
import TemplateSelector from './TemplateSelector';
import TitleTemplatePicker from './TitleTemplatePicker';
import UnifiedTemplateBuilder from './UnifiedTemplateBuilder';
import GridLayoutSelector from './GridLayoutSelector';
import SlideSplitter, { type SlideGroup } from './SlideSplitter';
import ResizablePanel from './ResizablePanel';
import type { SelectionSlot } from '../lib/selection';
import { buildSlots } from '../lib/selection';
import { useAuth } from '../lib/auth-context';
import { getDefaultTitleTemplateId } from '../lib/title-templates';
// TitleSlideEditor replaced by UnifiedTemplateBuilder (accessed via TitleTemplatePicker)

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
  onCarouselGenerated?: () => void;
  carouselAspect: CarouselAspect;
  onAspectChange: (a: CarouselAspect) => void;
  generating: boolean;
  onGeneratingChange: (g: boolean) => void;
  allPreviews: string[];
  onAllPreviewsChange: (urls: string[]) => void;
}

export interface CarouselPanelHandle {
  generate: () => void;
  downloadAll: () => void;
  getGridTemplateId: () => string;
  setGridTemplateId: (id: string) => void;
  getTitleTemplateId: () => string;
  setTitleTemplateId: (id: string) => void;
  getLogoUrl: () => string;
  setLogoUrl: (url: string) => void;
}

const CarouselPreviewPanel = forwardRef<CarouselPanelHandle, Props>(function CarouselPreviewPanel({
  selectedTracks, coverFeature, onTracksPerSlideChange, onCarouselGenerated,
  carouselAspect, onAspectChange, generating, onGeneratingChange, allPreviews, onAllPreviewsChange,
}, ref) {
  const { user } = useAuth();
  const [tracksPerSlide, setTracksPerSlide] = useState(8);
  // platformId kept for cross-platform export compatibility
  const platformId = 'ig-post';
  const [gridTemplateId, setGridTemplateId] = useState(localStorage.getItem('nmf_template') || 'mmmc_classic');
  const [titleTemplateId, setTitleTemplateId] = useState(() => {
    const saved = localStorage.getItem('nmf_title_template');
    const fallback = getDefaultTitleTemplateId(user?.email || undefined);
    const chosen = saved || fallback;
    if (import.meta.env.DEV) console.log('[title-template] init:', { saved, fallback, chosen, email: user?.email || null });
    return chosen;
  });
  const hasUserChangedTitle = useRef(!!localStorage.getItem('nmf_title_template'));
  const [slideGroups, setSlideGroups] = useState<SlideGroup[]>([]);
  const manualSplit = useRef(false);
  const [gridPreview, setGridPreview] = useState<string>('');
  const [titlePreview, setTitlePreview] = useState<string>('');
  const [editingPreview, setEditingPreview] = useState<'grid' | 'title' | null>(null);
  // allPreviews, generating, carouselAspect — lifted to parent via props
  const setAllPreviews = onAllPreviewsChange;
  const setGenerating = onGeneratingChange;
  const [error, setError] = useState('');
  const previewStripRef = useRef<HTMLDivElement>(null);
  const [logoUrl, setLogoUrl] = useState(localStorage.getItem('nmf_logo_url') || '/mmmc-logo.png');
  const logoFileRef = useRef<HTMLInputElement>(null);
  const setCarouselAspect = onAspectChange;
  const [comparePreviews, setComparePreviews] = useState<{ id: string; name: string; url: string }[]>([]);
  // Title editing now handled by UnifiedTemplateBuilder via TitleTemplatePicker

  // Songwriter credit slide toggle — Ward's feedback (default ON for user delight)
  const [showComposerCredits, setShowComposerCredits] = useState(() => {
    try {
      const saved = localStorage.getItem('nmf_show_composer_credits');
      return saved === null ? true : saved === 'true';
    } catch { return true; }
  });

  // Songwriter cache for credit lookup at generation time
  const songwriterCacheRef = useRef<Map<string, { display_name: string; charting_songs: number; no1_songs: number; publisher: string | null }>>(new Map());
  const songwriterAliasesRef = useRef<Map<string, string>>(new Map());
  const [cacheLoaded, setCacheLoaded] = useState(false);
  useEffect(() => {
    if (!showComposerCredits || cacheLoaded) return;
    fetch('/data/songwriter_cache.json')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.writers) return;
        const writers = new Map<string, any>();
        for (const [k, v] of Object.entries(data.writers)) writers.set(k, v);
        const aliases = new Map<string, string>();
        if (data.aliases) {
          for (const [alias, target] of Object.entries(data.aliases)) aliases.set(alias, target as string);
        }
        songwriterCacheRef.current = writers;
        songwriterAliasesRef.current = aliases;
        setCacheLoaded(true);
      })
      .catch(() => {});
  }, [showComposerCredits, cacheLoaded]);

  /** Parse Apple Music composerName string, dedupe, lookup in cache, return top 3 with charting > 0 */
  const buildCreditsForTrack = (composerName: string | null | undefined): SlideComposerCredit[] => {
    if (!composerName) return [];
    const skip = new Set(['traditional', 'public domain', 'unknown', 'various', 'n/a']);
    const names = composerName.replace(/ & /g, ', ').replace(/\band\b/gi, ',')
      .split(',').map(s => s.trim()).filter(s => s.length >= 2 && !skip.has(s.toLowerCase()));
    const writers = songwriterCacheRef.current;
    const aliases = songwriterAliasesRef.current;
    const credits: SlideComposerCredit[] = [];
    const seen = new Set<string>();
    for (const name of names) {
      const key = name.toLowerCase().trim();
      const target = aliases.get(key) || key;
      const info = writers.get(target);
      if (info && info.charting_songs > 0 && !seen.has(target)) {
        seen.add(target);
        credits.push({
          name: info.display_name,
          charting: info.charting_songs,
          publisher: info.publisher,
        });
      }
    }
    return credits.sort((a, b) => b.charting - a.charting).slice(0, 3);
  };

  /** Compute the composer credits to use for a slide group — uses first track with composer_name */
  const creditsForSlideGroup = (tracks: TrackItem[]): SlideComposerCredit[] => {
    if (!showComposerCredits) return [];
    for (const t of tracks) {
      const credits = buildCreditsForTrack(t.composer_name);
      if (credits.length > 0) return credits;
    }
    return [];
  };

  void platformId; // used in cross-platform export
  const weekDate = getLastFriday();

  // Fix: update title template when user email resolves (Supabase auth is async)
  // Also trigger on user.id change in case email arrives with the session
  useEffect(() => {
    if (import.meta.env.DEV) console.log('[title-template] useEffect:', { email: user?.email, hasUserChanged: hasUserChangedTitle.current });
    if (!hasUserChangedTitle.current) {
      const email = user?.email;
      if (email) {
        const defaultId = getDefaultTitleTemplateId(email);
        if (import.meta.env.DEV) console.log('[title-template] auth resolved → setting default:', defaultId);
        setTitleTemplateId(defaultId);
        localStorage.setItem('nmf_title_template', defaultId);
      }
    }
  }, [user?.email, user?.id]);

  // Grid layout: auto-computed but user-overridable
  const autoLayoutId = useMemo(() => {
    const opts = getGridsForCount(tracksPerSlide);
    const best = opts.logo[0] || opts.exact.find(g => g.columns > 1 && g.rows > 1) || opts.exact[0];
    return best?.id || '';
  }, [tracksPerSlide]);
  const [gridLayoutId, setGridLayoutId] = useState(autoLayoutId);
  const hasUserChangedLayout = useRef(false);
  useEffect(() => {
    if (!hasUserChangedLayout.current) setGridLayoutId(autoLayoutId);
  }, [autoLayoutId]);

  // Total slides
  const slideCount = Math.ceil(selectedTracks.length / tracksPerSlide);
  // totalSlides available if needed: (titleTemplateId !== 'none' ? 1 : 0) + slideCount

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
    if (import.meta.env.DEV) console.log('[PREVIEW] Rendering grid with template:', gridTemplateId, 'layout:', gridLayoutId);
    const firstSlice = selectedTracks.slice(0, tracksPerSlide);
    const slots = buildSlots(firstSlice.map((t, i) => ({
      track: t, albumId: t.album_spotify_id,
      selectionNumber: i + 1, slideGroup: 1,
      positionInSlide: i + 1, isCoverFeature: false,
    })));
    // Clear previous preview immediately to show loading state
    setGridPreview('');
    const previewCredits = creditsForSlideGroup(firstSlice);
    generateGridSlide(slots, weekDate, gridTemplateId, logoUrl, gridLayoutId, carouselAspect, undefined, previewCredits)
      .then(blob => {
        const url = URL.createObjectURL(blob);
        setGridPreview(prev => { if (prev) URL.revokeObjectURL(prev); return url; });
      })
      .catch(e => console.error('[PREVIEW] Grid render error:', e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gridTemplateId, gridLayoutId, selectedTracks, tracksPerSlide, weekDate, carouselAspect, logoUrl, showComposerCredits, cacheLoaded]);

  // Live preview: render title slide using TitleSlideTemplate (independent of grid template)
  useEffect(() => {
    if (!coverFeature || titleTemplateId === 'none') {
      setTitlePreview('');
      return;
    }
    generateTitleSlide(coverFeature, weekDate, titleTemplateId, carouselAspect)
      .then(blob => {
        const url = URL.createObjectURL(blob);
        setTitlePreview(prev => { if (prev) URL.revokeObjectURL(prev); return url; });
      })
      .catch(e => console.error('[PREVIEW] Title render error:', e));
  }, [titleTemplateId, coverFeature, weekDate, carouselAspect]);

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
        const titleBlob = await generateTitleSlide(coverFeature, weekDate, titleTemplateId, carouselAspect);
        urls.push(URL.createObjectURL(titleBlob));
      }

      // Grid slides — each gets composer credits from its first track with a match
      for (const group of slideGroups) {
        const slots = buildSlots(group.tracks.map((t, i) => ({
          track: t, albumId: t.album_spotify_id,
          selectionNumber: i + 1, slideGroup: 1,
          positionInSlide: i + 1, isCoverFeature: false,
        })));
        const credits = creditsForSlideGroup(group.tracks);
        const blob = await generateGridSlide(slots, weekDate, gridTemplateId, logoUrl, group.gridId || gridLayoutId, carouselAspect, undefined, credits);
        urls.push(URL.createObjectURL(blob));
      }

      allPreviews.forEach(URL.revokeObjectURL);
      setAllPreviews(urls);
      onCarouselGenerated?.();

      // Scroll to the preview strip so user sees their slides
      requestAnimationFrame(() => {
        previewStripRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });

      // Upload slides to Supabase Storage for permanent archive
      if (user?.id) {
        import('../lib/supabase').then(({ uploadFullCarousel }) => {
          // Convert blob URLs back to blobs for upload
          Promise.all(urls.map(u => fetch(u).then(r => r.blob())))
            .then(blobs => uploadFullCarousel(weekDate, blobs, gridTemplateId))
            .catch(() => {}); // Non-critical — archive upload failure shouldn't block user
        });
      }
    } catch (e) {
      setError(`Generation failed: ${(e as Error).message}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateStory = async () => {
    if (!coverFeature) { setError('Star a release to generate a Story slide'); return; }
    setGenerating(true);
    try {
      const storyBlob = await generateTitleSlide(coverFeature, weekDate, titleTemplateId, '9:16');
      const url = URL.createObjectURL(storyBlob);
      // Download directly
      downloadBlob(storyBlob, `nmf-story-${weekDate}.png`);
      // Also add to previews so user can see it
      setAllPreviews([...allPreviews, url]);
    } catch (e) {
      setError(`Story generation failed: ${(e as Error).message}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadAll = async () => {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    for (let i = 0; i < allPreviews.length; i++) {
      const res = await fetch(allPreviews[i]);
      const blob = await res.blob();
      zip.file(`nmf-slide-${i + 1}.png`, blob);
    }
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    downloadBlob(zipBlob, `nmf-carousel-${weekDate}.zip`);
  };

  // Expose generate, downloadAll, and template state to parent via ref
  useImperativeHandle(ref, () => ({
    generate: handleGenerate,
    generateStory: handleGenerateStory,
    downloadAll: handleDownloadAll,
    getGridTemplateId: () => gridTemplateId,
    setGridTemplateId: (id: string) => { setGridTemplateId(id); localStorage.setItem('nmf_template', id); setAllPreviews([]); },
    getTitleTemplateId: () => titleTemplateId,
    setTitleTemplateId: (id: string) => { hasUserChangedTitle.current = true; setTitleTemplateId(id); localStorage.setItem('nmf_title_template', id); setAllPreviews([]); },
    getLogoUrl: () => logoUrl,
    setLogoUrl: (url: string) => { setLogoUrl(url); localStorage.setItem('nmf_logo_url', url); setAllPreviews([]); },
  }));

  if (selectedTracks.length === 0) return null;

  return (
    <div data-testid="carousel-preview-panel" style={{
      padding: '24px 0', borderTop: '1px solid var(--midnight-border)', marginTop: 24,
    }}>
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-2xl)', marginBottom: 20 }}>
        ② Configure & Preview
      </h3>

      {/* TWO-COLUMN with draggable divider on desktop, single column on mobile */}
      <ResizablePanel
        left={<div style={{ minWidth: 0, overflow: 'hidden' }}>
          {/* Carousel Shape */}
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 'var(--fs-lg)', color: 'var(--text-muted)', marginBottom: 8 }}>Carousel Shape</p>
            <div style={{ display: 'flex', gap: 8 }}>
              {([
                { value: '1:1' as CarouselAspect, label: 'Square', sub: '1080×1080', icon: '◻' },
                { value: '3:4' as CarouselAspect, label: 'Portrait', sub: '1080×1440', icon: '▯' },
              ]).map(opt => (
                <button
                  key={opt.value}
                  onClick={() => { setCarouselAspect(opt.value); setAllPreviews([]); }}
                  title={`Generate ${opt.label} slides (${opt.sub})`}
                  style={{
                    flex: 1, padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                    background: carouselAspect === opt.value ? 'var(--midnight-hover)' : 'var(--midnight)',
                    border: carouselAspect === opt.value ? '2px solid var(--gold)' : '2px solid var(--midnight-border)',
                    transition: 'all 0.15s',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  }}
                >
                  <span style={{ fontSize: 'var(--fs-2xl)' }}>{opt.icon}</span>
                  <span style={{
                    fontSize: 'var(--fs-md)', fontWeight: 600,
                    color: carouselAspect === opt.value ? 'var(--gold)' : 'var(--text-secondary)',
                  }}>
                    {opt.label}
                  </span>
                  <span style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)' }}>
                    {opt.sub}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Tracks per slide */}
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 'var(--fs-lg)', color: 'var(--text-muted)', marginBottom: 8 }}>Tracks per slide</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {getTracksPerSlideOptions(selectedTracks.length).map(opt => (
                <button
                  key={opt.value}
                  onClick={() => { manualSplit.current = false; setTracksPerSlide(opt.value); onTracksPerSlideChange?.(opt.value); }}
                  className={`filter-pill ${tracksPerSlide === opt.value ? 'active' : ''}`}
                  style={{ fontSize: 'var(--fs-sm)' }}
                >
                  {opt.value} ({opt.label})
                </button>
              ))}
            </div>
            <p style={{ fontSize: 'var(--fs-md)', color: 'var(--text-muted)', marginTop: 6 }}>
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
                  style={{ marginLeft: 8, fontSize: 'var(--fs-sm)', color: 'var(--steel)', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Shuffle All
                </button>
              )}
            </p>
          </div>

          {/* Grid Layout Picker */}
          <GridLayoutSelector
            trackCount={tracksPerSlide}
            selected={gridLayoutId}
            onSelect={(id) => { hasUserChangedLayout.current = true; setGridLayoutId(id); setAllPreviews([]); }}
          />

          {/* Songwriter credits toggle — Ward's feedback */}
          <div style={{ marginBottom: 20, padding: '10px 12px', background: 'var(--midnight)', border: '1px solid var(--midnight-border)', borderRadius: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showComposerCredits}
                onChange={e => {
                  const v = e.target.checked;
                  setShowComposerCredits(v);
                  try { localStorage.setItem('nmf_show_composer_credits', String(v)); } catch { /* quota */ }
                  setAllPreviews([]); // force regen
                }}
                style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--gold)' }}
              />
              <span>
                <span style={{ fontSize: 'var(--fs-md)', color: 'var(--text-primary)', fontWeight: 600 }}>Show songwriter credits</span>
                <span style={{ display: 'block', fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)', marginTop: 2 }}>
                  Adds "Written by" section on grid slides when track has matched ND writers
                </span>
              </span>
            </label>
          </div>

          {/* Platform section removed — Carousel Shape toggle handles aspect ratio */}

          {/* Center Logo */}
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 'var(--fs-lg)', color: 'var(--text-muted)', marginBottom: 6 }}>Center Logo</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <img
                src={logoUrl}
                alt="Logo"
                style={{ width: 36, height: 36, borderRadius: 6, border: '1px solid var(--midnight-border)', objectFit: 'cover' }}
                onError={e => { (e.target as HTMLImageElement).src = '/mmmc-logo.png'; }}
              />
              <button
                className="btn btn-sm"
                onClick={() => logoFileRef.current?.click()}
                style={{ fontSize: 'var(--fs-2xs)' }}
                title="Upload your own logo image (PNG, JPEG, WebP)"
              >
                Upload Logo
              </button>
              {logoUrl !== '/mmmc-logo.png' && (
                <button
                  className="btn btn-sm"
                  onClick={() => { setLogoUrl('/mmmc-logo.png'); localStorage.removeItem('nmf_logo_url'); setAllPreviews([]); }}
                  style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)' }}
                >
                  Reset
                </button>
              )}
              <input
                ref={logoFileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                style={{ display: 'none' }}
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const url = URL.createObjectURL(file);
                  setLogoUrl(url);
                  localStorage.setItem('nmf_logo_url', url);
                  setAllPreviews([]);
                }}
              />
            </div>
          </div>

          {/* Grid Slide Style Template */}
          <div style={{ marginBottom: 20, maxWidth: '100%' }}>
            <p style={{ fontSize: 'var(--fs-lg)', color: 'var(--text-muted)', marginBottom: 8 }}>Grid Slide Style Template</p>
            <TemplateSelector selected={gridTemplateId} onSelect={handleGridTemplateChange}
              selectedTracks={selectedTracks} weekDate={weekDate} logoUrl={logoUrl} gridLayoutId={gridLayoutId} />
          </div>

          {/* Title Slide Template */}
          <div style={{ marginBottom: 20, maxWidth: '100%' }}>
            <div style={{ marginBottom: 4 }}>
              <TitleTemplatePicker
                selected={titleTemplateId}
                onSelect={id => { hasUserChangedTitle.current = true; setTitleTemplateId(id); localStorage.setItem('nmf_title_template', id); setAllPreviews([]); }}
                coverFeature={coverFeature}
                weekDate={weekDate}
              />
            </div>
            {/* Title customization now via "Create New" in TitleTemplatePicker */}
          </div>

          {/* Slide Split */}
          <SlideSplitter
            tracks={selectedTracks}
            defaultTracksPerSlide={tracksPerSlide}
            onSplitChange={handleSplitChange}
          />
        </div>}
        right={<div style={{ position: 'sticky', top: 80, marginTop: 20 }}>
          {/* Grid slide preview — click to edit */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', margin: 0 }}>Grid Slide Preview</p>
              {gridPreview && (
                <button onClick={() => setEditingPreview(editingPreview === 'grid' ? null : 'grid')}
                  style={{ fontSize: 'var(--fs-2xs)', color: 'var(--gold)', cursor: 'pointer', background: 'none', border: 'none' }}>
                  {editingPreview === 'grid' ? 'Close Editor' : '✏ Customize'}
                </button>
              )}
            </div>
            {gridPreview ? (
              <img
                src={gridPreview}
                alt="Grid slide preview"
                onClick={() => setEditingPreview(editingPreview === 'grid' ? null : 'grid')}
                style={{
                  width: '85%', maxWidth: 480, borderRadius: 8, cursor: 'pointer', display: 'block', margin: '0 auto',
                  border: editingPreview === 'grid' ? '2px solid var(--gold)' : '1px solid var(--midnight-border)',
                  aspectRatio: carouselAspect === '3:4' ? '3/4' : '1',
                }}
              />
            ) : (
              <div style={{
                width: '100%', aspectRatio: carouselAspect === '3:4' ? '3/4' : '1',
                borderRadius: 8, background: 'var(--midnight)',
                border: '1px solid var(--midnight-border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-muted)', fontSize: 'var(--fs-md)',
              }}>
                Select tracks to see preview
              </div>
            )}
            {/* Inline grid template editor */}
            {editingPreview === 'grid' && (
              <UnifiedTemplateBuilder
                mode="grid"
                initial={getVisibleTemplates(user?.email || undefined).find(t => t.id === gridTemplateId)}
                selectedTracks={selectedTracks}
                weekDate={weekDate}
                logoUrl={logoUrl}
                gridLayoutId={gridLayoutId}
                onSave={(t) => {
                  setGridTemplateId(t.id);
                  localStorage.setItem('nmf_template', t.id);
                  setAllPreviews([]);
                  setEditingPreview(null);
                }}
                onCancel={() => setEditingPreview(null)}
              />
            )}
          </div>

          {/* Title slide preview — click to edit */}
          {titleTemplateId !== 'none' && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', margin: 0 }}>Title Slide Preview</p>
                {titlePreview && (
                  <button onClick={() => setEditingPreview(editingPreview === 'title' ? null : 'title')}
                    style={{ fontSize: 'var(--fs-2xs)', color: 'var(--gold)', cursor: 'pointer', background: 'none', border: 'none' }}>
                    {editingPreview === 'title' ? 'Close Editor' : '✏ Customize'}
                  </button>
                )}
              </div>
              {titlePreview ? (
                <img
                  src={titlePreview}
                  alt="Title slide preview"
                  onClick={() => setEditingPreview(editingPreview === 'title' ? null : 'title')}
                  style={{
                    width: '85%', maxWidth: 480, borderRadius: 8, cursor: 'pointer', display: 'block', margin: '0 auto',
                    border: editingPreview === 'title' ? '2px solid var(--gold)' : '1px solid var(--midnight-border)',
                    aspectRatio: carouselAspect === '3:4' ? '3/4' : '1',
                  }}
                />
              ) : (
                <div style={{
                  width: '100%', aspectRatio: carouselAspect === '3:4' ? '3/4' : '1',
                  borderRadius: 8, background: 'var(--midnight)',
                  border: '1px solid var(--midnight-border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--text-muted)', fontSize: 'var(--fs-md)',
                }}>
                  {coverFeature ? 'Rendering...' : 'Set a cover feature (★) to preview'}
                </div>
              )}
              {/* Inline title template editor */}
              {editingPreview === 'title' && (
                <UnifiedTemplateBuilder
                  mode="title"
                  initial={undefined}
                  coverFeature={coverFeature}
                  weekDate={weekDate}
                  onSave={(t) => {
                    setTitleTemplateId(t.id);
                    localStorage.setItem('nmf_title_template', t.id);
                    setAllPreviews([]);
                    setEditingPreview(null);
                  }}
                  onCancel={() => setEditingPreview(null)}
                />
              )}
            </div>
          )}
        </div>}
      />

      {/* GENERATE + EXPORT (full width below the two columns) */}
      {error && (
        <p style={{ color: 'var(--mmmc-red)', fontSize: 'var(--fs-md)', marginBottom: 12 }}>{error}</p>
      )}

      {/* Generate + Download */}
      {/* Generate / Download bar */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 20, marginBottom: 16, alignItems: 'center' }}>
        {allPreviews.length === 0 ? (
          <button
            data-testid="generate-button"
            className="btn btn-gold"
            onClick={handleGenerate}
            disabled={generating || selectedTracks.length === 0}
            style={{ fontSize: 'var(--fs-lg)', padding: '12px 32px' }}
          >
            {generating ? 'Generating...' : 'Generate Carousel'}
          </button>
        ) : (
          <>
            <button className="btn btn-gold" onClick={handleDownloadAll}
              style={{ fontSize: 'var(--fs-lg)', padding: '12px 32px' }}>
              {allPreviews.length === 1 ? 'Download Slide' : `Download All (${allPreviews.length} slides)`}
            </button>
            <button className="btn btn-sm" onClick={handleGenerate} disabled={generating}
              style={{ fontSize: 'var(--fs-sm)', padding: '8px 16px', marginLeft: 'auto' }}>
              {generating ? '...' : 'Regenerate'}
            </button>
          </>
        )}
      </div>
      {/* Template comparison — only show BEFORE generation */}
      {selectedTracks.length > 0 && slideGroups.length > 0 && allPreviews.length === 0 && (
        <details style={{ marginBottom: 12 }}>
          <summary style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', cursor: 'pointer' }}>
            Compare Templates {comparePreviews.length > 0 ? `(${comparePreviews.length})` : ''}
          </summary>
          <div style={{ marginTop: 8 }}>
            <button
              className="btn btn-sm"
              onClick={async () => {
                const templates = getVisibleTemplates(user?.email || undefined).slice(0, 4);
                const firstGroup = slideGroups[0];
                if (!firstGroup) return;
                const slots = buildSlots(firstGroup.tracks.map((t, i) => ({
                  track: t, albumId: t.album_spotify_id,
                  selectionNumber: i + 1, slideGroup: 1,
                  positionInSlide: i + 1, isCoverFeature: false,
                })));
                const results: { id: string; name: string; url: string }[] = [];
                for (const tmpl of templates) {
                  const blob = await generateGridSlide(slots, weekDate, tmpl.id, logoUrl, undefined, carouselAspect);
                  results.push({ id: tmpl.id, name: tmpl.name, url: URL.createObjectURL(blob) });
                }
                setComparePreviews(prev => { prev.forEach(p => URL.revokeObjectURL(p.url)); return results; });
              }}
              style={{ fontSize: 'var(--fs-2xs)', marginBottom: 8 }}
            >
              Generate Comparison (first 4 templates)
            </button>
            {comparePreviews.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
                {comparePreviews.map(p => (
                  <div key={p.id} style={{ textAlign: 'center' }}>
                    <img src={p.url} alt={p.name} style={{ width: '100%', borderRadius: 6, border: gridTemplateId === p.id ? '2px solid var(--gold)' : '1px solid var(--midnight-border)' }} />
                    <p style={{ fontSize: 'var(--fs-3xs)', color: gridTemplateId === p.id ? 'var(--gold)' : 'var(--text-muted)', marginTop: 4, fontWeight: gridTemplateId === p.id ? 700 : 400 }}>
                      {p.name} {gridTemplateId === p.id ? '(current)' : ''}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </details>
      )}

      {/* Other platform exports — collapsible */}
      {allPreviews.length > 0 && (
        <details style={{ marginBottom: 16 }}>
          <summary style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', cursor: 'pointer' }}>
            Export for other platforms (Twitter, TikTok, Facebook)
          </summary>
          <p style={{ fontSize: 'var(--fs-3xs)', color: 'var(--text-muted)', margin: '8px 0 6px' }}>
            These generate a single composite image with all your selected tracks arranged for each platform's dimensions.
          </p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {PLATFORM_LIST.filter(p => p.id !== 'instagram').map(p => (
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
                style={{ fontSize: 'var(--fs-3xs)' }}
                title={`Generate ${p.label} image (${p.w}x${p.h})`}
              >
                {p.label} ({p.w}x{p.h})
              </button>
            ))}
          </div>
        </details>
      )}

      {/* Carousel preview — horizontal scrollable strip showing ALL slides */}
      {allPreviews.length > 0 && (
        <div ref={previewStripRef}>
          <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginBottom: 8 }}>
            {allPreviews.length} {allPreviews.length === 1 ? 'slide' : 'slides'} — drag to reorder, scroll to browse
          </p>
          <div style={{
            display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 12,
            WebkitOverflowScrolling: 'touch', scrollSnapType: 'x mandatory',
          }}>
            {allPreviews.map((url, i) => (
              <div
                key={i}
                draggable
                onDragStart={e => { e.dataTransfer.setData('text/plain', String(i)); e.dataTransfer.effectAllowed = 'move'; }}
                onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                onDrop={e => {
                  e.preventDefault();
                  const from = parseInt(e.dataTransfer.getData('text/plain'));
                  const to = i;
                  if (from === to) return;
                  const reordered = [...allPreviews];
                  const [moved] = reordered.splice(from, 1);
                  reordered.splice(to, 0, moved);
                  setAllPreviews(reordered);
                }}
                style={{
                  flexShrink: 0, scrollSnapAlign: 'start', cursor: 'grab',
                  width: 240, position: 'relative',
                  borderRadius: 8, overflow: 'hidden',
                  border: '1px solid var(--midnight-border)',
                  transition: 'all 0.15s',
                }}
              >
                <img src={url} alt={`Slide ${i + 1}`}
                  style={{ width: '100%', display: 'block' }} />
                <span style={{
                  position: 'absolute', top: 6, left: 6,
                  background: 'rgba(0,0,0,0.7)', padding: '2px 8px',
                  borderRadius: 4, fontSize: 'var(--fs-2xs)', color: '#fff', fontFamily: 'var(--font-mono)',
                }}>
                  {i + 1}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Title editing handled by UnifiedTemplateBuilder via TitleTemplatePicker */}
    </div>
  );
});

export default CarouselPreviewPanel;
