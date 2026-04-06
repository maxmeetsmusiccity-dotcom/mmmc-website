import { useState, useEffect, useRef, useCallback } from 'react';
import type { CarouselTemplate } from '../lib/carousel-templates';
import { TEMPLATES } from '../lib/carousel-templates';
import type { TitleSlideTemplate } from '../lib/title-templates';
import { getTitleTemplate, TITLE_TEMPLATES } from '../lib/title-templates';
import { generateTemplatePreview, generateTitleSlide, type CarouselAspect } from '../lib/canvas-grid';
import type { SelectionSlot } from '../lib/selection';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface Props {
  mode: 'grid' | 'title';
  onSave: (template: any) => void;
  onCancel: () => void;
  initial?: any; // CarouselTemplate or TitleSlideTemplate
  coverFeature?: SelectionSlot | null; // for title preview
  weekDate?: string; // for title preview
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const FONT_OPTIONS = [
  { label: 'Dancing Script', value: '"Dancing Script", cursive' },
  { label: 'Playfair Display', value: '"Playfair Display", "Georgia", serif' },
  { label: 'DM Sans', value: '"DM Sans", sans-serif' },
  { label: 'Source Serif', value: '"Source Serif 4", Georgia, serif' },
  { label: 'DM Mono', value: '"DM Mono", "Courier New", monospace' },
  { label: 'System', value: 'system-ui, sans-serif' },
];

const PRESET_COLORS = [
  '#0F1B33', '#1A1A2E', '#1A0A2E', '#0D0D0D',
  '#1C1208', '#F5F0E8', '#0B1622', '#2C1810',
  '#FFFFFF', '#050510', '#1A2E1A', '#0A0E1E',
];

const ACCENT_COLORS = [
  '#D4A843', '#FFFFFF', '#FF69B4', '#FF4500',
  '#FFB347', '#1A1A1A', '#00D4FF', '#7B68EE',
  '#E8E8E8', '#7BA87A', '#CC1100', '#C4572A',
];

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16) || 0;
  const g = parseInt(h.substring(2, 4), 16) || 0;
  const b = parseInt(h.substring(4, 6), 16) || 0;
  return `${r}, ${g}, ${b}`;
}

/* ------------------------------------------------------------------ */
/*  Reusable sub-components                                            */
/* ------------------------------------------------------------------ */

function Slider({ label, value, min, max, step, onChange, suffix = '' }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; suffix?: string;
}) {
  const display = step < 1 && !suffix
    ? `${(value * 100).toFixed(0)}%`
    : `${typeof value === 'number' ? (Number.isInteger(value) ? value : value.toFixed(1)) : value}${suffix}`;
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)' }}>
        <span>{label}</span><span>{display}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))} style={{ width: '100%' }} />
    </div>
  );
}

function SwatchRow({ colors, selected, onSelect, extraPicker, pickerValue, onPickerChange }: {
  colors: string[];
  selected: string;
  onSelect: (c: string) => void;
  extraPicker?: boolean;
  pickerValue?: string;
  onPickerChange?: (c: string) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
      {colors.map(c => (
        <button key={c} onClick={() => onSelect(c)} title={c} style={{
          ...swatchStyle, background: c,
          border: selected === c ? '2px solid var(--gold)' : '2px solid transparent',
        }} />
      ))}
      {extraPicker !== false && (
        <input type="color" value={pickerValue ?? selected}
          onChange={e => (onPickerChange ?? onSelect)(e.target.value)}
          style={{ width: 26, height: 26, cursor: 'pointer', border: 'none', padding: 0, borderRadius: 4 }} />
      )}
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label style={{ ...labelStyle, flex: 1 }}>
      {label}
      <input type="color" value={value} onChange={e => onChange(e.target.value)}
        style={{ width: '100%', height: 26, cursor: 'pointer' }} />
    </label>
  );
}

function FontSelect({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label style={{ ...labelStyle, flex: 1 }}>
      {label}
      <select value={value} onChange={e => onChange(e.target.value)} style={selectStyle}>
        {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
      </select>
    </label>
  );
}

/* ------------------------------------------------------------------ */
/*  Default factories                                                  */
/* ------------------------------------------------------------------ */

function _defaultGrid(base?: CarouselTemplate): CarouselTemplate {
  return base ? { ...base } : { ...TEMPLATES[0] };
}

function _defaultTitle(base?: TitleSlideTemplate): TitleSlideTemplate {
  return base ? { ...base } : { ...getTitleTemplate('vintage_press') };
}

void _defaultGrid; void _defaultTitle; // used for type reference

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function UnifiedTemplateBuilder({ mode, onSave, onCancel, initial, coverFeature, weekDate }: Props) {
  const isGrid = mode === 'grid';

  /* ---------- identity ---------- */
  const [name, setName] = useState(
    initial?.name
      ? (initial.name.endsWith(' (Custom)') ? initial.name : `${initial.name} (Custom)`)
      : (isGrid ? 'My Template' : 'My Custom Title')
  );
  const [description, setDescription] = useState(initial?.description || (isGrid ? 'Custom design' : ''));
  const [baseTemplateId, setBaseTemplateId] = useState(initial?.id || '');

  /* ---------- colors ---------- */
  const initBg = initial?.background || (isGrid ? TEMPLATES[0].background : getTitleTemplate('vintage_press').background);
  const [bg, setBg] = useState(initBg);
  const [accent, setAccent] = useState(initial?.accent || (isGrid ? TEMPLATES[0].accent : getTitleTemplate('vintage_press').accent));
  const [textPrimary, setTextPrimary] = useState(initial?.textPrimary || '#FFFFFF');
  const [textSecondary, setTextSecondary] = useState(initial?.textSecondary || '#AAAAAA');
  const [useGradient, setUseGradient] = useState(!!initial?.backgroundGradient);
  const [gradientEnd, setGradientEnd] = useState('#000000');
  const [gradientAngle, setGradientAngle] = useState(180);

  /* ---------- typography ---------- */
  // Grid mode fonts
  const [scriptFont, setScriptFont] = useState(initial?.scriptFont || TEMPLATES[0].scriptFont);
  const [bodyFont, setBodyFont] = useState(initial?.bodyFont || TEMPLATES[0].bodyFont);
  const [headerFontSize, setHeaderFontSize] = useState(initial?.headerFontSize || 52);
  const [letterSpacing, setLetterSpacing] = useState(initial?.letterSpacing || 0);
  const [textTransform, setTextTransform] = useState<'none' | 'uppercase' | 'lowercase'>(initial?.textTransform || 'none');

  // Title mode fonts
  const titleInit = isGrid ? getTitleTemplate('vintage_press') : (initial as TitleSlideTemplate | undefined);
  const [headlineFont, setHeadlineFont] = useState(titleInit?.headlineFont || '"DM Sans", sans-serif');
  const [dateFont, setDateFont] = useState(titleInit?.dateFont || '"DM Sans", sans-serif');
  const [headlineCase, setHeadlineCase] = useState<'capitalize' | 'uppercase' | 'none'>(titleInit?.headlineCase || 'capitalize');
  const [headlineWeight, setHeadlineWeight] = useState(titleInit?.headlineWeight || 700);
  const [headlineSize, setHeadlineSize] = useState(titleInit?.headlineSize || 0.065);
  const [subtitleSize, setSubtitleSize] = useState(titleInit?.subtitleSize || 0.028);
  const [dateSize, setDateSize] = useState(titleInit?.dateSize || 0.042);

  /* ---------- effects ---------- */
  // Shared glow (grid uses neon.outerBlur, title uses glow object)
  const [glowBlur, setGlowBlur] = useState(() => {
    if (!isGrid && titleInit) return titleInit.glow.blur;
    return initial?.neon?.outerBlur || 30;
  });
  const [glowPasses, setGlowPasses] = useState(() => {
    if (!isGrid && titleInit) return titleInit.glow.passes;
    return 3;
  });
  const [glowColor, setGlowColor] = useState(() => {
    if (!isGrid && titleInit) {
      const gc = titleInit.glow.color;
      return gc.includes('#') ? gc : '#D4A843';
    }
    return initial?.accent || TEMPLATES[0].accent;
  });
  const [grainIntensity, setGrainIntensity] = useState(() => {
    if (!isGrid && titleInit) return titleInit.grain;
    return initial?.grainIntensity ?? 0.12;
  });
  const [vignetteIntensity, setVignetteIntensity] = useState(() => {
    if (!isGrid && titleInit) return titleInit.vignette;
    return initial?.vignetteIntensity ?? 0.2;
  });
  // Grid-only effects
  const [scanlineSpacing, setScanlineSpacing] = useState(initial?.scanlineSpacing || 0);
  const [colorOverlay, setColorOverlay] = useState(initial?.colorOverlay || '');
  const [colorOverlayBlend, setColorOverlayBlend] = useState<'screen' | 'multiply' | 'overlay'>(initial?.colorOverlayBlend || 'overlay');

  /* ---------- grid options ---------- */
  const gridInit = isGrid ? (initial as CarouselTemplate | undefined) : undefined;
  const [gridGap, setGridGap] = useState(gridInit?.grid?.gap ?? TEMPLATES[0].grid.gap);
  const [rotation, setRotation] = useState(Math.abs(gridInit?.grid?.rotations?.[0] ?? 0));
  const [cellBorder, setCellBorder] = useState(gridInit?.grid?.cellBorder ?? false);
  const [cellBorderWidth, setCellBorderWidth] = useState(gridInit?.cellBorderWidth ?? 2);
  const [cellBorderColor, setCellBorderColor] = useState(gridInit?.grid?.cellBorderColor || accent);
  const [cellCornerRadius, setCellCornerRadius] = useState(gridInit?.cellCornerRadius ?? 0);
  const [cellShadow, setCellShadow] = useState(gridInit?.grid?.cellShadow ?? false);
  const [cellShadowBlur, setCellShadowBlur] = useState(gridInit?.cellShadowBlur ?? 16);

  /* ---------- title layout ---------- */
  const [headlineY, setHeadlineY] = useState(titleInit?.headlineY ?? 0.04);
  const [subtitleY, setSubtitleY] = useState(titleInit?.subtitleY ?? 0.12);
  const [dateY, setDateY] = useState(titleInit?.dateY ?? 0.90);
  const [featuredImageY, setFeaturedImageY] = useState(titleInit?.featuredImageY ?? 0.18);
  const [featuredImageSize, setFeaturedImageSize] = useState(titleInit?.featuredImageSize ?? 0.52);
  const [featuredRotation, setFeaturedRotation] = useState(titleInit?.featuredRotation ?? 0);
  const [featuredBorder, setFeaturedBorder] = useState(titleInit?.featuredBorder ?? 0);
  const [featuredBorderColor, setFeaturedBorderColor] = useState(titleInit?.featuredBorderColor || '#FFFFFF');
  const [featuredShadowBlur, setFeaturedShadowBlur] = useState(titleInit?.featuredShadowBlur ?? 30);

  /* ---------- decorations (grid) ---------- */
  const [showNotes, setShowNotes] = useState(gridInit?.decorations?.showNotes ?? true);
  const [showSparkles, setShowSparkles] = useState(gridInit?.decorations?.showSparkles ?? true);
  const [noteSize, setNoteSize] = useState(gridInit?.decorations?.noteSize ?? 40);
  const [sparkleSize, setSparkleSize] = useState(gridInit?.decorations?.sparkleSize ?? 24);
  const [showVinyl, setShowVinyl] = useState(gridInit?.cover?.vinylOverlay ?? false);
  const [vinylOpacity, setVinylOpacity] = useState(gridInit?.cover?.vinylOpacity ?? 0.4);
  const [showChevrons, setShowChevrons] = useState(gridInit?.cover?.showChevrons ?? true);

  /* ---------- decorations (title) ---------- */
  const [showFrame, setShowFrame] = useState(titleInit?.showFrame ?? false);
  const [frameColor, setFrameColor] = useState(titleInit?.frameColor || '#D4A843');
  const [frameWidth, setFrameWidth] = useState(titleInit?.frameWidth ?? 4);
  const [showDivider, setShowDivider] = useState(titleInit?.showDivider ?? false);
  const [dividerColor, setDividerColor] = useState(titleInit?.dividerColor || 'rgba(255,255,255,0.3)');
  const [swipePill, setSwipePill] = useState(titleInit?.swipePill ?? true);

  /* ---------- background image (grid) ---------- */
  const [bgFrameUrl, setBgFrameUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /* ---------- preview ---------- */
  const [previewUrl, setPreviewUrl] = useState('');
  const [aspect, setAspect] = useState<CarouselAspect>('1:1');
  const [rendering, setRendering] = useState(false);
  const previewTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  /* ================================================================ */
  /*  Build the output template from current state                     */
  /* ================================================================ */

  const buildGridTemplate = useCallback((): CarouselTemplate => {
    const outerBlur = glowBlur;
    const outerAlpha = Math.min(glowBlur / 60, 1) * 0.4;
    return {
      id: initial?.id || `custom_${Date.now()}`,
      name,
      description,
      background: bg,
      textPrimary,
      textSecondary,
      accent,
      accentGlow: `rgba(${hexToRgb(glowColor)}, `,
      scriptFont,
      bodyFont,
      neon: {
        outerGlow: `rgba(${hexToRgb(glowColor)}, ${outerAlpha.toFixed(2)})`,
        outerBlur,
        outerAlpha,
        midGlow: `rgba(${hexToRgb(glowColor)}, ${(outerAlpha * 1.8).toFixed(2)})`,
        midBlur: Math.round(outerBlur * 0.45),
        midAlpha: outerAlpha * 2,
        coreColor: textPrimary,
        coreBlur: Math.round(outerBlur * 0.12),
      },
      grid: {
        gap: gridGap,
        rotations: Array(8).fill(0).map((_, i) => (i % 2 === 0 ? -rotation : rotation)),
        cellShadow,
        cellBorder,
        cellBorderColor,
      },
      cover: {
        vinylOverlay: showVinyl,
        vinylOpacity,
        grooveCount: 60,
        frameBorder: 14,
        frameColor: textPrimary,
        frameShadowBlur: 32,
        showChevrons,
        showArtistName: true,
        showTrackName: true,
        subtitleText: name,
      },
      decorations: { showNotes, showSparkles, noteSize, sparkleSize },
      assets: bgFrameUrl ? { background: bgFrameUrl } : undefined,
      backgroundGradient: useGradient ? `linear-gradient(${gradientAngle}deg, ${bg}, ${gradientEnd})` : undefined,
      headerFontSize,
      letterSpacing,
      textTransform,
      cellCornerRadius,
      cellShadowBlur,
      cellBorderWidth,
      grainIntensity,
      vignetteIntensity: vignetteIntensity,
      scanlineSpacing,
      colorOverlay: colorOverlay || undefined,
      colorOverlayBlend,
    };
  }, [
    name, description, bg, accent, textPrimary, textSecondary, scriptFont, bodyFont,
    gridGap, rotation, cellBorder, cellBorderWidth, cellBorderColor, cellCornerRadius,
    cellShadow, cellShadowBlur, showNotes, showSparkles, showVinyl, vinylOpacity,
    showChevrons, noteSize, sparkleSize, grainIntensity, vignetteIntensity,
    scanlineSpacing, colorOverlay, colorOverlayBlend, bgFrameUrl, useGradient,
    gradientEnd, gradientAngle, glowBlur, glowColor, headerFontSize,
    letterSpacing, textTransform, initial?.id,
  ]);

  const buildTitleTemplate = useCallback((): TitleSlideTemplate => {
    return {
      id: initial?.id || `custom_title_${Date.now()}`,
      name,
      description,
      background: bg,
      backgroundGradient: useGradient ? `linear-gradient(${gradientAngle}deg, ${bg}, ${gradientEnd})` : undefined,
      textPrimary,
      textSecondary,
      accent,
      headlineFont,
      subtitleFont: headlineFont, // shared with headline
      dateFont,
      headlineWeight,
      headlineCase,
      headlineSize,
      subtitleSize,
      dateSize,
      headlineY,
      subtitleY,
      dateY,
      featuredImageY,
      featuredImageSize,
      glow: { color: glowColor, blur: glowBlur, passes: glowPasses },
      grain: grainIntensity,
      vignette: vignetteIntensity,
      showFrame,
      frameColor,
      frameWidth,
      showDivider,
      dividerColor,
      featuredBorder,
      featuredBorderColor,
      featuredShadowBlur,
      featuredRotation,
      swipePill,
    };
  }, [
    name, description, bg, useGradient, gradientAngle, gradientEnd,
    textPrimary, textSecondary, accent, headlineFont, dateFont,
    headlineWeight, headlineCase, headlineSize, subtitleSize, dateSize,
    headlineY, subtitleY, dateY, featuredImageY, featuredImageSize,
    glowColor, glowBlur, glowPasses, grainIntensity, vignetteIntensity,
    showFrame, frameColor, frameWidth, showDivider, dividerColor,
    featuredBorder, featuredBorderColor, featuredShadowBlur, featuredRotation,
    swipePill, initial?.id,
  ]);

  const buildTemplate = useCallback(() => {
    return isGrid ? buildGridTemplate() : buildTitleTemplate();
  }, [isGrid, buildGridTemplate, buildTitleTemplate]);

  /* ================================================================ */
  /*  "Start from" base template loader                                */
  /* ================================================================ */

  const loadBaseTemplate = useCallback((id: string) => {
    if (!id) return;
    setBaseTemplateId(id);

    if (isGrid) {
      const t = TEMPLATES.find(tpl => tpl.id === id) || TEMPLATES[0];
      setBg(t.background);
      setAccent(t.accent);
      setTextPrimary(t.textPrimary);
      setTextSecondary(t.textSecondary);
      setScriptFont(t.scriptFont);
      setBodyFont(t.bodyFont);
      setGridGap(t.grid.gap);
      setRotation(Math.abs(t.grid.rotations[0] || 0));
      setCellBorder(t.grid.cellBorder);
      setCellBorderColor(t.grid.cellBorderColor);
      setCellShadow(t.grid.cellShadow);
      setShowNotes(t.decorations.showNotes);
      setShowSparkles(t.decorations.showSparkles);
      setNoteSize(t.decorations.noteSize);
      setSparkleSize(t.decorations.sparkleSize);
      setShowVinyl(t.cover.vinylOverlay);
      setVinylOpacity(t.cover.vinylOpacity);
      setShowChevrons(t.cover.showChevrons);
      setGlowBlur(t.neon.outerBlur);
      setGlowColor(t.accent);
      if (t.headerFontSize) setHeaderFontSize(t.headerFontSize);
      if (t.grainIntensity !== undefined) setGrainIntensity(t.grainIntensity);
      if (t.vignetteIntensity !== undefined) setVignetteIntensity(t.vignetteIntensity);
      if (t.cellCornerRadius !== undefined) setCellCornerRadius(t.cellCornerRadius);
      if (t.letterSpacing !== undefined) setLetterSpacing(t.letterSpacing);
      if (t.textTransform) setTextTransform(t.textTransform);
      if (t.scanlineSpacing !== undefined) setScanlineSpacing(t.scanlineSpacing);
    } else {
      const t = getTitleTemplate(id);
      setBg(t.background);
      setAccent(t.accent);
      setTextPrimary(t.textPrimary);
      setTextSecondary(t.textSecondary);
      setHeadlineFont(t.headlineFont);
      setDateFont(t.dateFont);
      setHeadlineCase(t.headlineCase);
      setHeadlineWeight(t.headlineWeight);
      setHeadlineSize(t.headlineSize);
      setSubtitleSize(t.subtitleSize);
      setDateSize(t.dateSize);
      setHeadlineY(t.headlineY);
      setSubtitleY(t.subtitleY);
      setDateY(t.dateY);
      setFeaturedImageY(t.featuredImageY);
      setFeaturedImageSize(t.featuredImageSize);
      setFeaturedRotation(t.featuredRotation);
      setFeaturedBorder(t.featuredBorder);
      setFeaturedBorderColor(t.featuredBorderColor);
      setFeaturedShadowBlur(t.featuredShadowBlur);
      setGlowBlur(t.glow.blur);
      setGlowPasses(t.glow.passes);
      setGlowColor(t.glow.color.includes('#') ? t.glow.color : '#D4A843');
      setGrainIntensity(t.grain);
      setVignetteIntensity(t.vignette);
      setShowFrame(t.showFrame);
      setFrameColor(t.frameColor);
      setFrameWidth(t.frameWidth);
      setShowDivider(t.showDivider);
      setDividerColor(t.dividerColor);
      setSwipePill(t.swipePill);
    }
  }, [isGrid]);

  /* ================================================================ */
  /*  Debounced live preview (300ms)                                   */
  /* ================================================================ */

  useEffect(() => {
    clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(async () => {
      if (isGrid) {
        const t = buildGridTemplate();
        const url = generateTemplatePreview(t, 400);
        setPreviewUrl(url);
      } else {
        // Title mode: generate from the closest base template ID
        // since generateTitleSlide only accepts a template ID.
        // We render the base and the final save captures all edits.
        if (!coverFeature) {
          // Generate a placeholder colored canvas
          const canvas = document.createElement('canvas');
          const size = aspect === '3:4' ? { w: 400, h: 533 } : { w: 400, h: 400 };
          canvas.width = size.w;
          canvas.height = size.h;
          const ctx = canvas.getContext('2d')!;
          ctx.fillStyle = bg;
          ctx.fillRect(0, 0, size.w, size.h);
          // Draw some text indicators
          ctx.fillStyle = textPrimary;
          ctx.font = `bold ${Math.round(size.w * 0.04)}px system-ui`;
          ctx.textAlign = 'center';
          ctx.fillText('Title Slide Preview', size.w / 2, size.h * 0.5);
          ctx.fillStyle = textSecondary;
          ctx.font = `${Math.round(size.w * 0.025)}px system-ui`;
          ctx.fillText('Star an album for live preview', size.w / 2, size.h * 0.58);
          setPreviewUrl(canvas.toDataURL());
        } else {
          setRendering(true);
          try {
            // Use the selected base template for rendering
            const templateId = baseTemplateId || (initial?.id?.startsWith('custom_') ? 'vintage_press' : initial?.id) || 'vintage_press';
            const blob = await generateTitleSlide(coverFeature, weekDate || '', templateId, aspect);
            const url = URL.createObjectURL(blob);
            setPreviewUrl(prev => { if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev); return url; });
          } catch (e) {
            console.error('[UnifiedTemplateBuilder] title preview error:', e);
          } finally {
            setRendering(false);
          }
        }
      }
    }, 300);
    return () => clearTimeout(previewTimer.current);
  }, [buildGridTemplate, buildTitleTemplate, isGrid, coverFeature, weekDate, aspect, bg, textPrimary, textSecondary, baseTemplateId, initial?.id]);

  /* ================================================================ */
  /*  Keyboard shortcuts                                               */
  /* ================================================================ */

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        onSave(buildTemplate());
      }
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [buildTemplate, onSave, onCancel]);

  /* ================================================================ */
  /*  JSON import / export (grid mode)                                 */
  /* ================================================================ */

  const jsonImportRef = useRef<HTMLInputElement>(null);

  const handleExportJSON = () => {
    const t = buildTemplate();
    const blob = new Blob([JSON.stringify(t, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(t.name || 'template').replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then(text => {
      try {
        const t = JSON.parse(text);
        if (isGrid) {
          setName(t.name || 'Imported');
          setDescription(t.description || '');
          setBg(t.background);
          setAccent(t.accent);
          setTextPrimary(t.textPrimary);
          setTextSecondary(t.textSecondary);
          setScriptFont(t.scriptFont);
          setBodyFont(t.bodyFont);
          setGridGap(t.grid.gap);
          setRotation(Math.abs(t.grid.rotations[0] || 0));
          setCellBorder(t.grid.cellBorder);
          setCellBorderColor(t.grid.cellBorderColor);
          setCellShadow(t.grid.cellShadow);
          setShowNotes(t.decorations.showNotes);
          setShowSparkles(t.decorations.showSparkles);
          setShowVinyl(t.cover.vinylOverlay);
          setShowChevrons(t.cover.showChevrons);
          if (t.headerFontSize) setHeaderFontSize(t.headerFontSize);
          if (t.grainIntensity !== undefined) setGrainIntensity(t.grainIntensity);
          if (t.vignetteIntensity !== undefined) setVignetteIntensity(t.vignetteIntensity);
          if (t.cellCornerRadius !== undefined) setCellCornerRadius(t.cellCornerRadius);
          if (t.letterSpacing !== undefined) setLetterSpacing(t.letterSpacing);
          if (t.textTransform) setTextTransform(t.textTransform);
        } else {
          setName(t.name || 'Imported');
          setDescription(t.description || '');
          setBg(t.background);
          setAccent(t.accent);
          setTextPrimary(t.textPrimary);
          setTextSecondary(t.textSecondary);
          if (t.headlineFont) setHeadlineFont(t.headlineFont);
          if (t.dateFont) setDateFont(t.dateFont);
          if (t.headlineCase) setHeadlineCase(t.headlineCase);
          if (t.headlineWeight) setHeadlineWeight(t.headlineWeight);
          if (t.headlineSize) setHeadlineSize(t.headlineSize);
          if (t.dateSize) setDateSize(t.dateSize);
          if (t.headlineY !== undefined) setHeadlineY(t.headlineY);
          if (t.dateY !== undefined) setDateY(t.dateY);
          if (t.featuredImageY !== undefined) setFeaturedImageY(t.featuredImageY);
          if (t.featuredImageSize !== undefined) setFeaturedImageSize(t.featuredImageSize);
        }
      } catch { /* invalid JSON */ }
    });
  };

  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setBgFrameUrl(URL.createObjectURL(file));
  };

  /* ================================================================ */
  /*  Render                                                           */
  /* ================================================================ */

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      background: 'rgba(0,0,0,0.94)',
      display: 'flex',
      fontFamily: 'var(--font-body)',
    }}>
      {/* ============= LEFT: Controls ============= */}
      <div style={{
        flex: 1, minWidth: 0,
        display: 'flex', flexDirection: 'column',
        borderRight: '1px solid var(--midnight-border)',
      }}>
        {/* Header bar */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '16px 24px',
          borderBottom: '1px solid var(--midnight-border)',
          background: 'var(--midnight-raised)',
          flexShrink: 0,
        }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-2xl)', color: 'var(--gold)', margin: 0 }}>
            {isGrid ? 'Grid Template Builder' : 'Title Template Builder'}
          </h2>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-sm" onClick={handleExportJSON} title="Export template as JSON">Export</button>
            <button className="btn btn-sm" onClick={() => jsonImportRef.current?.click()} title="Import template from JSON">Import</button>
            <input ref={jsonImportRef} type="file" accept=".json" onChange={handleImportJSON} style={{ display: 'none' }} />
            <button className="btn btn-sm" onClick={onCancel}>Cancel</button>
          </div>
        </div>

        {/* Scrollable controls */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '16px 24px',
          display: 'flex', flexDirection: 'column', gap: 4,
        }}>

          {/* ---- Name + Base Template ---- */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
            <label style={{ ...labelStyle, flex: 2 }}>
              Name
              <input type="text" value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
            </label>
            <label style={{ ...labelStyle, flex: 3 }}>
              Start from
              <select
                value={baseTemplateId}
                onChange={e => {
                  if (e.target.value) loadBaseTemplate(e.target.value);
                }}
                style={selectStyle}
              >
                <option value="">Custom</option>
                {isGrid
                  ? TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)
                  : TITLE_TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)
                }
              </select>
            </label>
          </div>

          {/* ============================================= */}
          {/* COLORS & BACKGROUND                           */}
          {/* ============================================= */}
          <details open>
            <summary style={sectionHeader}>Colors &amp; Background</summary>
            <div style={sectionBody}>
              <p style={fieldLabel}>Background</p>
              <SwatchRow colors={PRESET_COLORS} selected={bg} onSelect={setBg} />

              <label style={toggleStyle}>
                <input type="checkbox" checked={useGradient} onChange={e => setUseGradient(e.target.checked)} />
                Gradient
              </label>
              {useGradient && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4, marginBottom: 8 }}>
                  <input type="color" value={gradientEnd} onChange={e => setGradientEnd(e.target.value)}
                    style={{ width: 26, height: 26, cursor: 'pointer' }} title="Gradient end color" />
                  <label style={{ ...labelStyle, flex: 1 }}>
                    Angle: {gradientAngle}&deg;
                    <input type="range" min="0" max="360" value={gradientAngle}
                      onChange={e => setGradientAngle(Number(e.target.value))} style={{ width: '100%' }} />
                  </label>
                </div>
              )}

              <p style={fieldLabel}>Accent</p>
              <SwatchRow colors={ACCENT_COLORS} selected={accent} onSelect={setAccent} />

              <div style={{ display: 'flex', gap: 10 }}>
                <ColorField label="Text Primary" value={textPrimary} onChange={setTextPrimary} />
                <ColorField label="Text Secondary" value={textSecondary} onChange={setTextSecondary} />
              </div>
            </div>
          </details>

          {/* ============================================= */}
          {/* TYPOGRAPHY                                     */}
          {/* ============================================= */}
          <details>
            <summary style={sectionHeader}>Typography</summary>
            <div style={sectionBody}>
              {isGrid ? (
                <>
                  <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                    <FontSelect label="Header Font" value={scriptFont} onChange={setScriptFont} />
                    <FontSelect label="Body Font" value={bodyFont} onChange={setBodyFont} />
                  </div>

                  <Slider label="Header Size" value={headerFontSize} min={28} max={72} step={1}
                    onChange={setHeaderFontSize} suffix="px" />

                  <Slider label="Letter Spacing" value={letterSpacing} min={-2} max={8} step={0.5}
                    onChange={setLetterSpacing} suffix="px" />

                  <label style={labelStyle}>
                    Text Transform
                    <select value={textTransform}
                      onChange={e => setTextTransform(e.target.value as 'none' | 'uppercase' | 'lowercase')}
                      style={selectStyle}>
                      <option value="none">None</option>
                      <option value="uppercase">UPPERCASE</option>
                      <option value="lowercase">lowercase</option>
                    </select>
                  </label>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                    <FontSelect label="Headline Font" value={headlineFont} onChange={setHeadlineFont} />
                    <FontSelect label="Date Font" value={dateFont} onChange={setDateFont} />
                  </div>

                  <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                    <label style={{ ...labelStyle, flex: 1 }}>
                      Case
                      <select value={headlineCase}
                        onChange={e => setHeadlineCase(e.target.value as 'capitalize' | 'uppercase' | 'none')}
                        style={selectStyle}>
                        <option value="capitalize">Title Case</option>
                        <option value="uppercase">UPPERCASE</option>
                        <option value="none">As-is</option>
                      </select>
                    </label>
                    <label style={{ ...labelStyle, flex: 1 }}>
                      Weight
                      <select value={headlineWeight}
                        onChange={e => setHeadlineWeight(parseInt(e.target.value))}
                        style={selectStyle}>
                        <option value="400">Regular</option>
                        <option value="600">Semi-Bold</option>
                        <option value="700">Bold</option>
                        <option value="900">Black</option>
                      </select>
                    </label>
                  </div>

                  <Slider label="Headline Size" value={headlineSize} min={0.02} max={0.08} step={0.002}
                    onChange={setHeadlineSize} />
                  <Slider label="Subtitle Size" value={subtitleSize} min={0.015} max={0.05} step={0.002}
                    onChange={setSubtitleSize} />
                  <Slider label="Date Size" value={dateSize} min={0.02} max={0.06} step={0.002}
                    onChange={setDateSize} />
                </>
              )}
            </div>
          </details>

          {/* ============================================= */}
          {/* EFFECTS                                        */}
          {/* ============================================= */}
          <details>
            <summary style={sectionHeader}>Effects</summary>
            <div style={sectionBody}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 4 }}>
                <div style={{ flex: 1 }}>
                  <Slider label="Glow Blur" value={glowBlur} min={0} max={60} step={2}
                    onChange={setGlowBlur} suffix="px" />
                </div>
                <label style={{ ...labelStyle, flex: 0, marginBottom: 6 }}>
                  Color
                  <input type="color" value={glowColor} onChange={e => setGlowColor(e.target.value)}
                    style={{ width: 26, height: 26, cursor: 'pointer' }} />
                </label>
              </div>

              {!isGrid && (
                <Slider label="Glow Passes" value={glowPasses} min={0} max={8} step={1}
                  onChange={setGlowPasses} />
              )}

              <Slider label="Film Grain" value={grainIntensity} min={0} max={0.5} step={0.01}
                onChange={setGrainIntensity} />

              <Slider label="Vignette" value={vignetteIntensity} min={0} max={0.6} step={0.02}
                onChange={setVignetteIntensity} />

              {isGrid && (
                <>
                  <Slider label="Scanlines" value={scanlineSpacing} min={0} max={8} step={1}
                    onChange={setScanlineSpacing} suffix={scanlineSpacing === 0 ? '' : 'px'} />

                  <label style={labelStyle}>
                    Color Overlay
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input type="color" value={colorOverlay || '#000000'}
                        onChange={e => setColorOverlay(e.target.value)}
                        style={{ width: 26, height: 26, cursor: 'pointer' }} />
                      <select value={colorOverlayBlend}
                        onChange={e => setColorOverlayBlend(e.target.value as 'screen' | 'multiply' | 'overlay')}
                        style={{ ...selectStyle, flex: 1 }}>
                        <option value="overlay">Overlay</option>
                        <option value="screen">Screen (lighten)</option>
                        <option value="multiply">Multiply (darken)</option>
                      </select>
                      {colorOverlay && (
                        <button className="btn btn-sm" onClick={() => setColorOverlay('')}
                          style={{ fontSize: 'var(--fs-3xs)', padding: '2px 6px' }}>Clear</button>
                      )}
                    </div>
                  </label>
                </>
              )}
            </div>
          </details>

          {/* ============================================= */}
          {/* GRID OPTIONS (grid mode only)                  */}
          {/* ============================================= */}
          {isGrid && (
            <details>
              <summary style={sectionHeader}>Grid Options</summary>
              <div style={sectionBody}>
                <Slider label={`Cell Gap: ${(gridGap * 100).toFixed(1)}%`}
                  value={gridGap} min={0} max={0.03} step={0.001}
                  onChange={setGridGap} />

                <Slider label={`Cell Rotation: \u00B1${rotation.toFixed(1)}\u00B0`}
                  value={rotation} min={0} max={5} step={0.1}
                  onChange={setRotation} suffix="\u00B0" />

                <Slider label="Rounded Corners" value={cellCornerRadius} min={0} max={30} step={1}
                  onChange={setCellCornerRadius} suffix="px" />

                <label style={toggleStyle}>
                  <input type="checkbox" checked={cellShadow} onChange={e => setCellShadow(e.target.checked)} />
                  Cell Shadow
                </label>
                {cellShadow && (
                  <Slider label="Shadow Blur" value={cellShadowBlur} min={0} max={40} step={1}
                    onChange={setCellShadowBlur} suffix="px" />
                )}

                <label style={toggleStyle}>
                  <input type="checkbox" checked={cellBorder} onChange={e => setCellBorder(e.target.checked)} />
                  Cell Border
                </label>
                {cellBorder && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                    <div style={{ flex: 1 }}>
                      <Slider label="Border Width" value={cellBorderWidth} min={1} max={6} step={1}
                        onChange={setCellBorderWidth} suffix="px" />
                    </div>
                    <label style={{ ...labelStyle, marginBottom: 6 }}>
                      Color
                      <input type="color" value={cellBorderColor}
                        onChange={e => setCellBorderColor(e.target.value)}
                        style={{ width: 26, height: 26, cursor: 'pointer' }} />
                    </label>
                  </div>
                )}
              </div>
            </details>
          )}

          {/* ============================================= */}
          {/* TITLE LAYOUT (title mode only)                 */}
          {/* ============================================= */}
          {!isGrid && (
            <details open>
              <summary style={sectionHeader}>Title Layout</summary>
              <div style={sectionBody}>
                <Slider label="Headline Y" value={headlineY} min={0.01} max={0.20} step={0.005}
                  onChange={setHeadlineY} />
                <Slider label="Subtitle Y" value={subtitleY} min={0.05} max={0.25} step={0.005}
                  onChange={setSubtitleY} />
                <Slider label="Date Y" value={dateY} min={0.70} max={0.98} step={0.005}
                  onChange={setDateY} />
                <Slider label="Album Art Y" value={featuredImageY} min={0.10} max={0.50} step={0.005}
                  onChange={setFeaturedImageY} />
                <Slider label="Album Art Size" value={featuredImageSize} min={0.20} max={0.65} step={0.01}
                  onChange={setFeaturedImageSize} />
                <Slider label="Image Rotation" value={featuredRotation} min={-8} max={8} step={0.5}
                  onChange={setFeaturedRotation} suffix="deg" />
                <Slider label="Image Border" value={featuredBorder} min={0} max={24} step={1}
                  onChange={setFeaturedBorder} suffix="px" />
                <Slider label="Image Shadow" value={featuredShadowBlur} min={0} max={60} step={2}
                  onChange={setFeaturedShadowBlur} suffix="px" />

                <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                  <label style={{ ...labelStyle, flex: 1 }}>
                    Border Color
                    <input type="color" value={featuredBorderColor}
                      onChange={e => setFeaturedBorderColor(e.target.value)}
                      style={{ width: '100%', height: 26, cursor: 'pointer' }} />
                  </label>
                </div>
              </div>
            </details>
          )}

          {/* ============================================= */}
          {/* DECORATIONS & FRAME                            */}
          {/* ============================================= */}
          <details>
            <summary style={sectionHeader}>Decorations &amp; Frame</summary>
            <div style={sectionBody}>
              {isGrid ? (
                <>
                  {/* Grid decorations */}
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
                    <label style={toggleStyle}>
                      <input type="checkbox" checked={showNotes} onChange={e => setShowNotes(e.target.checked)} />
                      Music Notes
                    </label>
                    <label style={toggleStyle}>
                      <input type="checkbox" checked={showSparkles} onChange={e => setShowSparkles(e.target.checked)} />
                      Sparkles
                    </label>
                    <label style={toggleStyle}>
                      <input type="checkbox" checked={showVinyl} onChange={e => setShowVinyl(e.target.checked)} />
                      Vinyl Overlay
                    </label>
                    <label style={toggleStyle}>
                      <input type="checkbox" checked={showChevrons} onChange={e => setShowChevrons(e.target.checked)} />
                      Chevrons
                    </label>
                  </div>

                  {showNotes && (
                    <Slider label="Note Size" value={noteSize} min={20} max={80} step={1}
                      onChange={setNoteSize} suffix="px" />
                  )}
                  {showSparkles && (
                    <Slider label="Sparkle Size" value={sparkleSize} min={12} max={60} step={1}
                      onChange={setSparkleSize} suffix="px" />
                  )}
                  {showVinyl && (
                    <Slider label="Vinyl Opacity" value={vinylOpacity} min={0} max={1} step={0.05}
                      onChange={setVinylOpacity} />
                  )}
                </>
              ) : (
                <>
                  {/* Title decorations */}
                  <label style={toggleStyle}>
                    <input type="checkbox" checked={showFrame} onChange={e => setShowFrame(e.target.checked)} />
                    Show Frame
                  </label>
                  {showFrame && (
                    <div style={{ paddingLeft: 8, marginBottom: 4 }}>
                      <Slider label="Frame Width" value={frameWidth} min={1} max={12} step={1}
                        onChange={setFrameWidth} suffix="px" />
                      <label style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)' }}>
                        Frame Color
                        <input type="color" value={frameColor}
                          onChange={e => setFrameColor(e.target.value)}
                          style={{ width: 20, height: 20, border: 'none', borderRadius: 3, cursor: 'pointer', verticalAlign: 'middle', marginLeft: 6 }} />
                      </label>
                    </div>
                  )}

                  <label style={toggleStyle}>
                    <input type="checkbox" checked={showDivider} onChange={e => setShowDivider(e.target.checked)} />
                    Show Divider
                  </label>

                  <label style={toggleStyle}>
                    <input type="checkbox" checked={swipePill} onChange={e => setSwipePill(e.target.checked)} />
                    Swipe Pill
                  </label>
                </>
              )}
            </div>
          </details>

          {/* ============================================= */}
          {/* BACKGROUND IMAGE (grid mode only)              */}
          {/* ============================================= */}
          {isGrid && (
            <details>
              <summary style={sectionHeader}>Background Image</summary>
              <div style={sectionBody}>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp"
                  onChange={handleBgUpload} style={{ fontSize: 'var(--fs-sm)' }} />
                {bgFrameUrl && (
                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <img src={bgFrameUrl} alt="Background" style={{ width: 48, height: 48, borderRadius: 4, objectFit: 'cover' }} />
                    <button className="btn btn-sm btn-danger" onClick={() => {
                      setBgFrameUrl(null);
                      if (fileRef.current) fileRef.current.value = '';
                    }}>
                      Remove
                    </button>
                  </div>
                )}
              </div>
            </details>
          )}

        </div>

        {/* Save bar (pinned to bottom of left panel) */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: 8,
          padding: '12px 24px',
          borderTop: '1px solid var(--midnight-border)',
          background: 'var(--midnight-raised)',
          flexShrink: 0,
        }}>
          <button className="btn btn-sm" onClick={onCancel}>Cancel</button>
          <button className="btn btn-gold btn-sm" onClick={() => onSave(buildTemplate())}
            title="Save template (Cmd+S)">
            {initial ? 'Update Template' : 'Save as Custom Template'}
          </button>
        </div>
      </div>

      {/* ============= RIGHT: Live Preview ============= */}
      <div style={{
        flex: 1, minWidth: 0,
        display: 'flex', flexDirection: 'column',
        background: 'var(--midnight)',
      }}>
        {/* Aspect toggle bar */}
        <div style={{
          display: 'flex', gap: 8, alignItems: 'center',
          padding: '16px 24px',
          borderBottom: '1px solid var(--midnight-border)',
          flexShrink: 0,
        }}>
          <button
            className={`filter-pill ${aspect === '1:1' ? 'active' : ''}`}
            onClick={() => setAspect('1:1')}
            style={{ fontSize: 'var(--fs-sm)' }}
          >
            1:1
          </button>
          <button
            className={`filter-pill ${aspect === '3:4' ? 'active' : ''}`}
            onClick={() => setAspect('3:4')}
            style={{ fontSize: 'var(--fs-sm)' }}
          >
            3:4
          </button>
          <span style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-3xs)', marginLeft: 'auto' }}>
            {rendering ? 'Rendering...' : 'Cmd+S to save \u2022 Esc to cancel'}
          </span>
        </div>

        {/* Preview canvas area */}
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 24, overflow: 'hidden',
        }}>
          {previewUrl ? (
            <img
              src={previewUrl}
              alt={`${isGrid ? 'Grid' : 'Title'} template preview`}
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                borderRadius: 8,
                border: '1px solid var(--midnight-border)',
                objectFit: 'contain',
              }}
            />
          ) : (
            <div style={{
              width: 400,
              aspectRatio: aspect === '3:4' ? '3/4' : '1',
              borderRadius: 12,
              background: bg,
              border: '1px solid var(--midnight-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: accent, fontSize: 'var(--fs-md)',
            }}>
              Loading preview...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Shared inline styles                                               */
/* ------------------------------------------------------------------ */

const labelStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 3,
  fontSize: 'var(--fs-xs)', color: 'var(--text-muted)',
};

const fieldLabel: React.CSSProperties = {
  fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600,
};

const sectionHeader: React.CSSProperties = {
  fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', fontWeight: 600,
  cursor: 'pointer', padding: '8px 0',
  borderBottom: '1px solid var(--midnight-border)',
};

const sectionBody: React.CSSProperties = {
  padding: '10px 0', display: 'flex', flexDirection: 'column', gap: 8,
};

const inputStyle: React.CSSProperties = {
  background: 'var(--midnight)', border: '1px solid var(--midnight-border)',
  borderRadius: 6, padding: '5px 8px', color: 'var(--text-primary)',
  fontSize: 'var(--fs-sm)', fontFamily: 'var(--font-body)',
};

const selectStyle: React.CSSProperties = {
  ...inputStyle, width: '100%',
};

const swatchStyle: React.CSSProperties = {
  width: 26, height: 26, borderRadius: 5, cursor: 'pointer',
};

const toggleStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 5,
  fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', cursor: 'pointer',
};
