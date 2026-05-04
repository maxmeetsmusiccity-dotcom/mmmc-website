import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import type { CarouselTemplate } from '../lib/carousel-templates';
import { TEMPLATES, registerTempTemplate, clearTempTemplate } from '../lib/carousel-templates';
import type { TitleSlideTemplate } from '../lib/title-templates';
import { getTitleTemplate, TITLE_TEMPLATES } from '../lib/title-templates';
import { generateTemplatePreview, generateTitleSlide, generateGridSlide, type CarouselAspect } from '../lib/canvas-grid';
import { buildSlots } from '../lib/selection';
import type { SelectionSlot } from '../lib/selection';
import {
  titleTemplateToElements, gridTemplateToElements, type EditorElement,
  createCustomText, createCustomImage, createCustomShape, type ShapeKind,
} from '../lib/editor-elements';
import KonvaEditor from './KonvaEditor';
import ErrorBoundary from './ErrorBoundary';

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
  selectedTracks?: import('../lib/spotify').TrackItem[]; // for grid preview with real album art
  logoUrl?: string; // for grid preview
  gridLayoutId?: string; // for grid preview
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const FONT_OPTIONS = [
  // Sans-serif
  { label: 'DM Sans', value: '"DM Sans", sans-serif', cat: 'sans' },
  { label: 'Inter', value: '"Inter", sans-serif', cat: 'sans' },
  { label: 'Montserrat', value: '"Montserrat", sans-serif', cat: 'sans' },
  { label: 'Poppins', value: '"Poppins", sans-serif', cat: 'sans' },
  { label: 'Raleway', value: '"Raleway", sans-serif', cat: 'sans' },
  { label: 'Space Grotesk', value: '"Space Grotesk", sans-serif', cat: 'sans' },
  { label: 'Oswald', value: '"Oswald", sans-serif', cat: 'sans' },
  { label: 'Roboto Condensed', value: '"Roboto Condensed", sans-serif', cat: 'sans' },
  { label: 'Barlow Condensed', value: '"Barlow Condensed", sans-serif', cat: 'sans' },
  // Serif
  { label: 'Playfair Display', value: '"Playfair Display", Georgia, serif', cat: 'serif' },
  { label: 'Source Serif', value: '"Source Serif 4", Georgia, serif', cat: 'serif' },
  { label: 'Lora', value: '"Lora", serif', cat: 'serif' },
  { label: 'Merriweather', value: '"Merriweather", serif', cat: 'serif' },
  { label: 'Roboto Slab', value: '"Roboto Slab", serif', cat: 'serif' },
  { label: 'Cormorant Garamond', value: '"Cormorant Garamond", serif', cat: 'serif' },
  { label: 'Cinzel', value: '"Cinzel", serif', cat: 'serif' },
  // Display
  { label: 'Bebas Neue', value: '"Bebas Neue", sans-serif', cat: 'display' },
  { label: 'Abril Fatface', value: '"Abril Fatface", serif', cat: 'display' },
  { label: 'Alfa Slab One', value: '"Alfa Slab One", serif', cat: 'display' },
  { label: 'Anton', value: '"Anton", sans-serif', cat: 'display' },
  { label: 'Archivo Black', value: '"Archivo Black", sans-serif', cat: 'display' },
  { label: 'Righteous', value: '"Righteous", sans-serif', cat: 'display' },
  { label: 'Permanent Marker', value: '"Permanent Marker", cursive', cat: 'display' },
  // Handwriting / Script
  { label: 'Dancing Script', value: '"Dancing Script", cursive', cat: 'script' },
  { label: 'Caveat', value: '"Caveat", cursive', cat: 'script' },
  { label: 'Great Vibes', value: '"Great Vibes", cursive', cat: 'script' },
  { label: 'Satisfy', value: '"Satisfy", cursive', cat: 'script' },
  { label: 'Pacifico', value: '"Pacifico", cursive', cat: 'script' },
  // Mono
  { label: 'JetBrains Mono', value: '"JetBrains Mono", monospace', cat: 'mono' },
  { label: 'DM Mono', value: '"DM Mono", "Courier New", monospace', cat: 'mono' },
  // System
  { label: 'System', value: 'system-ui, sans-serif', cat: 'sans' },
];

const PRESET_COLORS = [
  '#0F1B33', '#1A1A2E', '#1A0A2E', '#0D0D0D',
  '#1C1208', '#F5F0E8', '#0B1622', '#2C1810',
  '#FFFFFF', '#050510', '#1A2E1A', '#0A0E1E',
];

const ACCENT_COLORS = [
  '#F5C453', '#FFFFFF', '#FF69B4', '#FF4500',
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
  const [open, setOpen] = useState(false);
  const current = FONT_OPTIONS.find(f => f.value === value) || FONT_OPTIONS[0];
  return (
    <label style={{ ...labelStyle, flex: 1, position: 'relative' }}>
      {label}
      <button
        onClick={() => setOpen(!open)}
        style={{
          ...selectStyle, textAlign: 'left', cursor: 'pointer',
          fontFamily: current.value, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}
      >
        <span>{current.label}</span>
        <span style={{ fontSize: 10 }}>{open ? '\u25B2' : '\u25BC'}</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20,
          background: 'var(--midnight-raised)', border: '1px solid var(--midnight-border)',
          borderRadius: 6, maxHeight: 320, overflowY: 'auto',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        }}>
          {(['sans', 'serif', 'display', 'script', 'mono'] as const).map(cat => {
            const fonts = FONT_OPTIONS.filter(f => f.cat === cat);
            if (fonts.length === 0) return null;
            const catLabel = { sans: 'Sans-Serif', serif: 'Serif', display: 'Display', script: 'Script', mono: 'Monospace' }[cat];
            return (
              <div key={cat}>
                <div style={{ padding: '6px 12px 2px', fontSize: 'var(--fs-3xs)', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
                  {catLabel}
                </div>
                {fonts.map(f => (
                  <button key={f.value}
                    onClick={() => { onChange(f.value); setOpen(false); }}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left', padding: '6px 12px',
                      background: f.value === value ? 'var(--midnight-hover)' : 'transparent',
                      border: 'none', cursor: 'pointer',
                      fontFamily: f.value, fontSize: 'var(--fs-md)',
                      color: f.value === value ? 'var(--gold)' : 'var(--text-primary)',
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}
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

export default function UnifiedTemplateBuilder({ mode, onSave, onCancel, initial, coverFeature, weekDate, selectedTracks, logoUrl, gridLayoutId }: Props) {
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
      return gc.includes('#') ? gc : '#F5C453';
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
  const [headlineX, setHeadlineX] = useState(titleInit?.headlineX ?? 0.5);
  const [headlineY, setHeadlineY] = useState(titleInit?.headlineY ?? 0.04);
  const [subtitleX, setSubtitleX] = useState(titleInit?.subtitleX ?? 0.5);
  const [subtitleY, setSubtitleY] = useState(titleInit?.subtitleY ?? 0.12);
  const [dateX, setDateX] = useState(titleInit?.dateX ?? 0.5);
  const [dateY, setDateY] = useState(titleInit?.dateY ?? 0.90);
  const [featuredImageX, setFeaturedImageX] = useState(titleInit?.featuredImageX ?? 0.5);
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
  const [frameColor, setFrameColor] = useState(titleInit?.frameColor || '#F5C453');
  const [frameWidth, setFrameWidth] = useState(titleInit?.frameWidth ?? 4);
  const [showDivider, setShowDivider] = useState(titleInit?.showDivider ?? false);
  const [dividerColor, setDividerColor] = useState(titleInit?.dividerColor || 'rgba(255,255,255,0.3)');
  const [swipePill, setSwipePill] = useState(titleInit?.swipePill ?? true);

  /* ---------- background image ---------- */
  const [bgFrameUrl, setBgFrameUrl] = useState<string | null>(null);
  const [titleBgImage, setTitleBgImage] = useState<string>(initial?.backgroundImage || '');
  const [titleBgBlur, setTitleBgBlur] = useState(initial?.backgroundBlur ?? 0);
  const [titleBgDarken, setTitleBgDarken] = useState(initial?.backgroundDarken ?? 0.4);
  const fileRef = useRef<HTMLInputElement>(null);

  /* ---------- preview ---------- */
  const [previewUrl, setPreviewUrl] = useState('');
  const [aspect, setAspect] = useState<CarouselAspect>('1:1');
  const [rendering, setRendering] = useState(false);
  const previewTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  /* ---------- undo/redo ---------- */
  const undoStack = useRef<EditorElement[][]>([]);
  const redoStack = useRef<EditorElement[][]>([]);
  const pushUndo = useCallback((elements: EditorElement[]) => {
    undoStack.current.push(JSON.parse(JSON.stringify(elements)));
    if (undoStack.current.length > 30) undoStack.current.shift();
    redoStack.current = []; // clear redo on new action
  }, []);

  /* ---------- canvas overlay + layers ---------- */
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  // previewRect removed — KonvaEditor handles its own sizing
  const [layerOverrides] = useState<Record<string, { visible?: boolean; locked?: boolean }>>({});
  const [layerOrder] = useState<string[] | null>(null);
  const [customElements, setCustomElements] = useState<EditorElement[]>([]);

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
      customElements: customElements.length > 0 ? customElements : undefined,
    };
  }, [
    name, description, bg, accent, textPrimary, textSecondary, scriptFont, bodyFont,
    gridGap, rotation, cellBorder, cellBorderWidth, cellBorderColor, cellCornerRadius,
    cellShadow, cellShadowBlur, showNotes, showSparkles, showVinyl, vinylOpacity,
    showChevrons, noteSize, sparkleSize, grainIntensity, vignetteIntensity,
    scanlineSpacing, colorOverlay, colorOverlayBlend, bgFrameUrl, useGradient, customElements,
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
      headlineX, headlineY,
      subtitleX, subtitleY,
      dateX, dateY,
      featuredImageX, featuredImageY,
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
      backgroundImage: titleBgImage || undefined,
      backgroundBlur: titleBgBlur || undefined,
      backgroundDarken: titleBgDarken || undefined,
      customElements: customElements.length > 0 ? customElements : undefined,
    };
  }, [
    name, description, bg, useGradient, gradientAngle, gradientEnd, titleBgImage, titleBgBlur, titleBgDarken,
    textPrimary, textSecondary, accent, headlineFont, dateFont,
    headlineWeight, headlineCase, headlineSize, subtitleSize, dateSize,
    headlineX, headlineY, subtitleX, subtitleY, dateX, dateY, featuredImageX, featuredImageY, featuredImageSize,
    glowColor, glowBlur, glowPasses, grainIntensity, vignetteIntensity,
    showFrame, frameColor, frameWidth, showDivider, dividerColor,
    featuredBorder, featuredBorderColor, featuredShadowBlur, featuredRotation, customElements,
    swipePill, initial?.id,
  ]);

  const buildTemplate = useCallback(() => {
    return isGrid ? buildGridTemplate() : buildTitleTemplate();
  }, [isGrid, buildGridTemplate, buildTitleTemplate]);

  /* ================================================================ */
  /*  Editor elements (derived from current template state)            */
  /* ================================================================ */

  const editorElements = useMemo<EditorElement[]>(() => {
    const raw = isGrid ? gridTemplateToElements(buildGridTemplate()) : titleTemplateToElements(buildTitleTemplate());
    // Merge template-derived elements with custom user elements
    const all = [...raw, ...customElements];
    // Apply visibility/lock overrides from layer panel
    const withOverrides = all.map(el => {
      const ov = layerOverrides[el.id];
      if (!ov) return el;
      return { ...el, visible: ov.visible ?? el.visible, locked: ov.locked ?? el.locked };
    });
    // Apply custom ordering if set
    if (layerOrder) {
      const byId = new Map(withOverrides.map(el => [el.id, el]));
      const ordered: EditorElement[] = [];
      for (const id of layerOrder) { const el = byId.get(id); if (el) ordered.push(el); }
      for (const el of withOverrides) { if (!layerOrder.includes(el.id)) ordered.push(el); }
      return ordered;
    }
    return withOverrides;
  }, [isGrid, buildGridTemplate, buildTitleTemplate, layerOverrides, layerOrder, customElements]);

  void layerOverrides; void layerOrder; // reserved for future layer panel restoration

  const handleAddText = useCallback(() => {
    pushUndo(customElements);
    const el = createCustomText();
    setCustomElements(prev => [...prev, el]);
    setSelectedElementId(el.id);
  }, []);

  const handleAddImage = useCallback(() => {
    pushUndo(customElements);
    const el = createCustomImage();
    setCustomElements(prev => [...prev, el]);
    setSelectedElementId(el.id);
  }, []);

  const handleAddShape = useCallback((kind: ShapeKind) => {
    pushUndo(customElements);
    const el = createCustomShape(kind);
    setCustomElements(prev => [...prev, el]);
    setSelectedElementId(el.id);
  }, []);

  const handleDeleteElement = useCallback((id: string) => {
    setCustomElements(prev => prev.filter(el => el.id !== id));
    if (selectedElementId === id) setSelectedElementId(null);
  }, [selectedElementId]);

  // IDs that have dedicated state variables — never promote these to customElements
  const TITLE_STATE_IDS = new Set(['headline', 'subtitle', 'date', 'featured_image']);

  const handleElementUpdate = useCallback((id: string, patch: Partial<EditorElement>) => {
    // User-added custom elements: update directly
    if (customElements.some(el => el.id === id)) {
      setCustomElements(prev => prev.map(el => el.id === id ? { ...el, ...patch } : el));
      // For title elements that also have state vars, fall through (don't return)
      if (isGrid || !TITLE_STATE_IDS.has(id)) return;
    }

    // Title template elements: map to state variables so the canvas renderer picks them up
    if (!isGrid && TITLE_STATE_IDS.has(id)) {
      if (patch.x !== undefined) {
        switch (id) {
          case 'headline': setHeadlineX(patch.x); break;
          case 'subtitle': setSubtitleX(patch.x); break;
          case 'date': setDateX(patch.x); break;
          case 'featured_image': setFeaturedImageX(patch.x); break;
        }
      }
      if (patch.y !== undefined) {
        switch (id) {
          case 'headline': setHeadlineY(patch.y); break;
          case 'subtitle': setSubtitleY(patch.y); break;
          case 'date': setDateY(patch.y); break;
          case 'featured_image': setFeaturedImageY(patch.y); break;
        }
      }
      if (patch.width !== undefined && id === 'featured_image') {
        setFeaturedImageSize(patch.width);
      }
      if (patch.rotation !== undefined && id === 'featured_image') {
        setFeaturedRotation(patch.rotation);
      }
      return; // handled via state variables — don't promote
    }

    // Grid-derived or unknown elements: promote to customElements so changes persist
    if (!customElements.some(el => el.id === id)) {
      const templateEls = isGrid
        ? gridTemplateToElements(buildGridTemplate())
        : titleTemplateToElements(buildTitleTemplate());
      const base = templateEls.find(el => el.id === id);
      if (base) {
        setCustomElements(prev => [...prev, { ...base, ...patch, locked: false }]);
      }
    }
  }, [isGrid, customElements, buildGridTemplate, buildTitleTemplate]);

  // previewRect measurement removed — KonvaEditor handles its own layout

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
      setHeadlineX(t.headlineX ?? 0.5); setHeadlineY(t.headlineY);
      setSubtitleX(t.subtitleX ?? 0.5); setSubtitleY(t.subtitleY);
      setDateX(t.dateX ?? 0.5); setDateY(t.dateY);
      setFeaturedImageX(t.featuredImageX ?? 0.5); setFeaturedImageY(t.featuredImageY);
      setFeaturedImageSize(t.featuredImageSize);
      setFeaturedRotation(t.featuredRotation);
      setFeaturedBorder(t.featuredBorder);
      setFeaturedBorderColor(t.featuredBorderColor);
      setFeaturedShadowBlur(t.featuredShadowBlur);
      setGlowBlur(t.glow.blur);
      setGlowPasses(t.glow.passes);
      setGlowColor(t.glow.color.includes('#') ? t.glow.color : '#F5C453');
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

  // Clean up temp template on unmount
  useEffect(() => () => clearTempTemplate(), []);

  /* ================================================================ */
  /*  Debounced live preview (80ms — fast enough for drag feedback)     */
  /* ================================================================ */

  useEffect(() => {
    clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(async () => {
      if (isGrid) {
        const tpl = buildGridTemplate();
        // Register so generateGridSlide can find it by ID
        registerTempTemplate(tpl);
        if (selectedTracks && selectedTracks.length > 0) {
          // Use real album art when tracks are available
          setRendering(true);
          const slots = buildSlots(selectedTracks.slice(0, 8).map((t, i) => ({
            track: t, albumId: t.album_spotify_id,
            selectionNumber: i + 1, slideGroup: 1,
            positionInSlide: i + 1, isCoverFeature: false,
          })));
          const wd = weekDate || new Date().toISOString().split('T')[0];
          generateGridSlide(slots, wd, tpl.id, logoUrl || '/mmmc-logo.png', gridLayoutId, aspect)
            .then(blob => {
              const url = URL.createObjectURL(blob);
              setPreviewUrl(prev => { if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev); return url; });
            })
            .catch(() => {
              setPreviewUrl(generateTemplatePreview(tpl, 600));
            })
            .finally(() => setRendering(false));
        } else {
          setPreviewUrl(generateTemplatePreview(tpl, 600));
        }
      } else {
        // Title mode: render live preview with current template settings
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
            // Pass live template object so edits are reflected in preview
            const blob = await generateTitleSlide(coverFeature, weekDate || '', buildTitleTemplate(), aspect);
            const url = URL.createObjectURL(blob);
            setPreviewUrl(prev => { if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev); return url; });
          } catch (e) {
            console.error('[UnifiedTemplateBuilder] title preview error:', e);
          } finally {
            setRendering(false);
          }
        }
      }
    }, 80);
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
      // Undo: Cmd+Z
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        const prev = undoStack.current.pop();
        if (prev) { redoStack.current.push(JSON.parse(JSON.stringify(customElements))); setCustomElements(prev); }
      }
      // Redo: Cmd+Shift+Z
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'z') {
        e.preventDefault();
        const next = redoStack.current.pop();
        if (next) { undoStack.current.push(JSON.parse(JSON.stringify(customElements))); setCustomElements(next); }
      }
      // Delete/Backspace removes selected custom element
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedElementId) {
        const el = customElements.find(ce => ce.id === selectedElementId);
        if (el) { e.preventDefault(); pushUndo(customElements); handleDeleteElement(selectedElementId); }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [buildTemplate, onSave, onCancel, selectedElementId, customElements, handleDeleteElement, pushUndo]);

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

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'var(--midnight)',
      fontFamily: 'var(--font-body)',
      overflowY: 'auto',
    }}>
      {/* Shared header — always visible */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 16px',
        borderBottom: '1px solid var(--midnight-border)',
        background: 'var(--midnight-raised)',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={onCancel}
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 18, padding: '0 4px' }}
            aria-label="Go back">&larr;</button>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-xl)', color: 'var(--gold)', margin: 0 }}>
            {isGrid ? 'Grid Template' : 'Title Template'}
          </h2>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button className="btn btn-sm desktop-only" onClick={handleExportJSON} title="Export template as JSON">Export</button>
          <button className="btn btn-sm desktop-only" onClick={() => jsonImportRef.current?.click()} title="Import template from JSON">Import</button>
          <input ref={jsonImportRef} type="file" accept=".json" onChange={handleImportJSON} style={{ display: 'none' }} />
          <button className="btn btn-sm" onClick={onCancel} style={{ fontWeight: 600 }}>Close</button>
          <button className="btn btn-sm btn-gold" onClick={() => onSave(buildTemplate())} style={{ fontWeight: 600 }}>Save</button>
        </div>
      </div>

    {/* ============= DESKTOP: 3-column flex layout ============= */}
    <div className="desktop-only">
    <div style={{ display: 'flex', height: 'calc(100vh - 52px)' }}>
      {/* ============= LEFT: Controls ============= */}
      <div style={{
        flex: 1, minWidth: 0,
        display: 'flex', flexDirection: 'column',
        borderRight: '1px solid var(--midnight-border)',
      }}>

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
            {/* Eyedropper — pick color from preview */}
            {previewUrl && (
              <button onClick={() => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => {
                  const c = document.createElement('canvas');
                  c.width = img.width; c.height = img.height;
                  const cx = c.getContext('2d')!;
                  cx.drawImage(img, 0, 0);
                  // Pick center pixel as default, or let user click
                  const d = cx.getImageData(img.width / 2, img.height / 3, 1, 1).data;
                  const hex = '#' + [d[0], d[1], d[2]].map(v => v.toString(16).padStart(2, '0')).join('');
                  setAccent(hex);
                };
                img.src = previewUrl;
              }} style={{ fontSize: 'var(--fs-2xs)', color: 'var(--gold)', cursor: 'pointer', background: 'none', border: '1px solid var(--gold-dark)', borderRadius: 4, padding: '3px 8px', marginBottom: 8 }}>
                Pick accent from preview center
              </button>
            )}
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
            <details>
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
          {/* BACKGROUND IMAGE                               */}
          {/* ============================================= */}
          <details>
            <summary style={sectionHeader}>Background Image</summary>
            <div style={sectionBody}>
              {isGrid ? (
                <>
                  <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp"
                    onChange={handleBgUpload} style={{ fontSize: 'var(--fs-sm)' }} />
                  {bgFrameUrl && (
                    <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <img src={bgFrameUrl} alt="Background" style={{ width: 48, height: 48, borderRadius: 4, objectFit: 'cover' }} />
                      <button className="btn btn-sm btn-danger" onClick={() => {
                        setBgFrameUrl(null);
                        if (fileRef.current) fileRef.current.value = '';
                      }}>Remove</button>
                    </div>
                )}
                </>
              ) : (
                <>
                  <label style={labelStyle}>
                    Image URL
                    <input type="text" placeholder="Paste image URL..."
                      value={titleBgImage}
                      onChange={e => setTitleBgImage(e.target.value)} style={inputStyle} />
                  </label>
                  <label style={labelStyle}>
                    Upload
                    <input type="file" accept="image/*" onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) setTitleBgImage(URL.createObjectURL(file));
                    }} style={{ fontSize: 'var(--fs-2xs)' }} />
                  </label>
                  {titleBgImage && (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                        <img src={titleBgImage} alt="" style={{ width: 48, height: 48, borderRadius: 4, objectFit: 'cover' }} />
                        <button className="btn btn-sm btn-danger" onClick={() => setTitleBgImage('')}>Remove</button>
                      </div>
                      <Slider label="Blur" value={titleBgBlur} min={0} max={20} step={1} onChange={setTitleBgBlur} suffix="px" />
                      <Slider label="Darken" value={titleBgDarken} min={0} max={0.8} step={0.05} onChange={setTitleBgDarken} />
                    </>
                  )}
                </>
              )}
            </div>
          </details>

          {/* ============================================= */}
          {/* ADD ELEMENTS                                   */}
          {/* ============================================= */}
          <details>
            <summary style={sectionHeader}>Custom Elements</summary>
            <div style={sectionBody}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                <button className="btn btn-sm" onClick={handleAddText} style={{ flex: 1, justifyContent: 'center', fontSize: 'var(--fs-2xs)' }}>+ Text</button>
                <button className="btn btn-sm" onClick={handleAddImage} style={{ flex: 1, justifyContent: 'center', fontSize: 'var(--fs-2xs)' }}>+ Image</button>
                <button className="btn btn-sm" onClick={() => handleAddShape('rectangle')} style={{ flex: 1, justifyContent: 'center', fontSize: 'var(--fs-2xs)' }}>+ Shape</button>
              </div>
              {customElements.length > 0 && (
                <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)' }}>
                  {customElements.length} custom element{customElements.length !== 1 ? 's' : ''}
                  {selectedElementId && customElements.find(e => e.id === selectedElementId) && (
                    <button onClick={() => handleDeleteElement(selectedElementId!)}
                      style={{ marginLeft: 8, color: 'var(--mmmc-red)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--fs-2xs)' }}>
                      Delete Selected
                    </button>
                  )}
                </div>
              )}
            </div>
          </details>

          {/* ============================================= */}
          {/* SELECTED CUSTOM ELEMENT PROPERTIES             */}
          {/* ============================================= */}
          {(() => {
            const sel = selectedElementId ? customElements.find(e => e.id === selectedElementId) : null;
            if (!sel) return null;
            const updateProp = (key: string, val: unknown) => {
              setCustomElements(prev => prev.map(el =>
                el.id === sel.id ? { ...el, props: { ...el.props, [key]: val } } : el
              ));
            };
            return (
              <details open>
                <summary style={sectionHeader}>{sel.label} Properties</summary>
                <div style={sectionBody}>
                  {/* Common: label */}
                  <label style={labelStyle}>
                    Label
                    <input type="text" value={sel.label}
                      onChange={e => setCustomElements(prev => prev.map(el => el.id === sel.id ? { ...el, label: e.target.value } : el))}
                      style={inputStyle} />
                  </label>

                  {/* Text element properties */}
                  {sel.type === 'text' && (
                    <>
                      <label style={labelStyle}>
                        Text
                        <input type="text" value={(sel.props.text as string) || ''}
                          onChange={e => updateProp('text', e.target.value)} style={inputStyle} />
                      </label>
                      <FontSelect label="Font" value={(sel.props.font as string) || '"DM Sans", sans-serif'}
                        onChange={v => updateProp('font', v)} />
                      <Slider label="Font Size" value={(sel.props.fontSize as number) || 0.035}
                        min={0.015} max={0.08} step={0.002} onChange={v => updateProp('fontSize', v)} />
                      <label style={labelStyle}>
                        Weight
                        <select value={(sel.props.fontWeight as number) || 400}
                          onChange={e => updateProp('fontWeight', parseInt(e.target.value))} style={selectStyle}>
                          <option value="400">Regular</option>
                          <option value="600">Semi-Bold</option>
                          <option value="700">Bold</option>
                          <option value="900">Black</option>
                        </select>
                      </label>
                      <ColorField label="Color" value={(sel.props.color as string) || '#FFFFFF'}
                        onChange={v => updateProp('color', v)} />
                    </>
                  )}

                  {/* Image element properties */}
                  {sel.type === 'image' && (
                    <>
                      <label style={labelStyle}>
                        Image URL
                        <input type="text" placeholder="Paste image URL..."
                          value={(sel.props.src as string) || ''}
                          onChange={e => updateProp('src', e.target.value)} style={inputStyle} />
                      </label>
                      <label style={labelStyle}>
                        Upload
                        <input type="file" accept="image/*" onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) updateProp('src', URL.createObjectURL(file));
                        }} style={{ fontSize: 'var(--fs-2xs)' }} />
                      </label>
                      <Slider label="Width" value={sel.width} min={0.05} max={0.8} step={0.01}
                        onChange={v => setCustomElements(prev => prev.map(el => el.id === sel.id ? { ...el, width: v, height: v } : el))} />
                      <Slider label="Border" value={(sel.props.borderWidth as number) || 0}
                        min={0} max={20} step={1} onChange={v => updateProp('borderWidth', v)} suffix="px" />
                      <ColorField label="Border Color" value={(sel.props.borderColor as string) || '#FFFFFF'}
                        onChange={v => updateProp('borderColor', v)} />
                      <Slider label="Opacity" value={(sel.props.opacity as number) ?? 1}
                        min={0} max={1} step={0.05} onChange={v => updateProp('opacity', v)} />
                    </>
                  )}

                  {/* Shape element properties */}
                  {sel.type === 'shape' && (
                    <>
                      <Slider label="Width" value={sel.width} min={0.02} max={0.8} step={0.01}
                        onChange={v => setCustomElements(prev => prev.map(el => el.id === sel.id ? { ...el, width: v } : el))} />
                      <Slider label="Height" value={sel.height} min={0.002} max={0.8} step={0.005}
                        onChange={v => setCustomElements(prev => prev.map(el => el.id === sel.id ? { ...el, height: v } : el))} />
                      <ColorField label="Fill" value={(sel.props.fill as string) || 'transparent'}
                        onChange={v => updateProp('fill', v)} />
                      <ColorField label="Stroke" value={(sel.props.stroke as string) || '#F5C453'}
                        onChange={v => updateProp('stroke', v)} />
                      <Slider label="Stroke Width" value={(sel.props.strokeWidth as number) || 1}
                        min={0} max={10} step={1} onChange={v => updateProp('strokeWidth', v)} suffix="px" />
                      <Slider label="Rotation" value={sel.rotation} min={-180} max={180} step={1}
                        onChange={v => setCustomElements(prev => prev.map(el => el.id === sel.id ? { ...el, rotation: v } : el))} suffix="deg" />
                    </>
                  )}

                  {/* Position (all types) */}
                  <div style={{ borderTop: '1px solid var(--midnight-border)', paddingTop: 8, marginTop: 4 }}>
                    <Slider label="X Position" value={sel.x} min={0} max={1} step={0.005}
                      onChange={v => setCustomElements(prev => prev.map(el => el.id === sel.id ? { ...el, x: v } : el))} />
                    <Slider label="Y Position" value={sel.y} min={0} max={1} step={0.005}
                      onChange={v => setCustomElements(prev => prev.map(el => el.id === sel.id ? { ...el, y: v } : el))} />
                  </div>
                </div>
              </details>
            );
          })()}

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
        flex: 2, minWidth: 0,
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
          <span style={{ width: 1, height: 20, background: 'var(--midnight-border)', margin: '0 4px' }} />
          <button className="btn btn-sm" onClick={() => {
            const prev = undoStack.current.pop();
            if (prev) { redoStack.current.push(JSON.parse(JSON.stringify(customElements))); setCustomElements(prev); }
          }} disabled={undoStack.current.length === 0}
            title="Undo (Cmd+Z)" style={{ fontSize: 'var(--fs-sm)', padding: '4px 8px', opacity: undoStack.current.length === 0 ? 0.3 : 1 }}>
            Undo
          </button>
          <button className="btn btn-sm" onClick={() => {
            const next = redoStack.current.pop();
            if (next) { undoStack.current.push(JSON.parse(JSON.stringify(customElements))); setCustomElements(next); }
          }} disabled={redoStack.current.length === 0}
            title="Redo (Cmd+Shift+Z)" style={{ fontSize: 'var(--fs-sm)', padding: '4px 8px', opacity: redoStack.current.length === 0 ? 0.3 : 1 }}>
            Redo
          </button>
          <span style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-3xs)', marginLeft: 'auto' }}>
            {rendering ? 'Rendering...' : 'Cmd+S to save \u2022 Esc to cancel'}
          </span>
        </div>

        {/* Preview canvas area — Konva-based interactive editor */}
        <div ref={previewContainerRef} style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 24, overflow: 'hidden',
        }}>
          {(() => {
            // Compute stage dimensions to fit within the available space
            const maxW = 540;
            const maxH = typeof window !== 'undefined' ? window.innerHeight - 120 : 700;
            const ratio = aspect === '3:4' ? 3 / 4 : aspect === '9:16' ? 9 / 16 : 1;
            let stageW = maxW;
            let stageH = stageW / ratio;
            if (stageH > maxH) { stageH = maxH; stageW = stageH * ratio; }
            return (
              <ErrorBoundary fallbackMessage="Editor crashed — click Try Again">
              <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid var(--midnight-border)' }}>
                <KonvaEditor
                  elements={editorElements}
                  selectedId={selectedElementId}
                  onSelect={setSelectedElementId}
                  onElementUpdate={handleElementUpdate}
                  onTextEdit={(id, text) => {
                    setCustomElements(prev => prev.map(el =>
                      el.id === id ? { ...el, props: { ...el.props, text } } : el
                    ));
                  }}
                  backgroundSrc={previewUrl}
                  coverArtSrc={coverFeature?.track?.cover_art_640 || undefined}
                  canvasWidth={Math.round(stageW)}
                  canvasHeight={Math.round(stageH)}
                />
              </div>
              </ErrorBoundary>
            );
          })()}
        </div>
      </div>
    </div>
    </div>{/* end desktop-only layout */}

    {/* ============= MOBILE: desktop-only notice ============= */}
    <div className="mobile-only" style={{ padding: '32px 24px', textAlign: 'center' }}>
      <p style={{ fontSize: 'var(--fs-lg)', color: 'var(--text-secondary)', marginBottom: 12 }}>
        Template editing is available on desktop.
      </p>
      <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', marginBottom: 20 }}>
        Use a desktop browser to customize templates with the full visual editor.
      </p>
      <button className="btn btn-gold" onClick={onCancel} style={{ padding: '10px 24px' }}>
        Back
      </button>
    </div>

    </div>,
    document.body
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
