import { PHASE3_LIVE_BODY_TEMPLATE_PRESETS } from './body-templates-v2-phase3';
import type { TemplateEngine, V2CarouselBodyTemplate } from './template-types-v2';

export interface CarouselTemplate {
  id: string;
  name: string;
  description: string;
  engine?: TemplateEngine;
  v2PresetId?: string;

  // Colors
  background: string;
  textPrimary: string;
  textSecondary: string;
  accent: string;
  accentGlow: string;

  // Fonts
  scriptFont: string;
  bodyFont: string;

  // Neon effect
  neon: {
    outerGlow: string;
    outerBlur: number;
    outerAlpha: number;
    midGlow: string;
    midBlur: number;
    midAlpha: number;
    coreColor: string;
    coreBlur: number;
  };

  // Grid
  grid: {
    gap: number; // fraction of gridSize
    rotations: number[]; // degrees per cell, 8 values
    cellShadow: boolean;
    cellBorder: boolean;
    cellBorderColor: string;
  };

  // Cover slide
  cover: {
    vinylOverlay: boolean;
    vinylOpacity: number;
    grooveCount: number;
    frameBorder: number;
    frameColor: string;
    frameShadowBlur: number;
    showChevrons: boolean;
    showArtistName: boolean;
    showTrackName: boolean;
    subtitleText: string;
  };

  // Decorations
  decorations: {
    showNotes: boolean;
    showSparkles: boolean;
    noteSize: number;
    sparkleSize: number;
  };

  // Asset overrides (optional PNGs in /public/assets/templates/{id}/)
  assets?: {
    background?: string;
    vinyl?: string;
    noteVariants?: string[];
    sparkle?: string;
    overlay?: string;
  };

  // Extended fields (optional — backward compatible)
  backgroundGradient?: string;
  headerFontSize?: number;
  letterSpacing?: number;
  textTransform?: 'none' | 'uppercase' | 'lowercase';
  cellCornerRadius?: number;
  cellShadowBlur?: number;
  cellBorderWidth?: number;
  grainIntensity?: number;
  vignetteIntensity?: number;
  scanlineSpacing?: number;
  colorOverlay?: string;
  colorOverlayBlend?: 'screen' | 'multiply' | 'overlay';
  backgroundBlur?: number;
  /** Custom user-added elements (text banners, images, shapes) */
  customElements?: import('./editor-elements').EditorElement[];
}

const LEGACY_TEMPLATES: CarouselTemplate[] = [
  {
    id: 'mmmc_classic',
    name: 'MMMC Classic',
    description: 'Gold neon on midnight navy — the Nashville original',
    background: '#0F1B33',
    textPrimary: '#F5E6B8',
    textSecondary: '#FFFFFF',
    accent: '#D4A843',
    accentGlow: 'rgba(212, 168, 67, ',
    scriptFont: '"Dancing Script", cursive',
    bodyFont: '"DM Sans", sans-serif',
    neon: {
      outerGlow: 'rgba(212, 168, 67, 0.25)', outerBlur: 45, outerAlpha: 0.3,
      midGlow: 'rgba(212, 168, 67, 0.5)', midBlur: 20, midAlpha: 0.7,
      coreColor: '#F5E6B8', coreBlur: 6,
    },
    grid: {
      gap: 0.005, rotations: [-0.6, 0.4, -0.3, 0.5, 0, -0.7, 0.3, -0.5],
      cellShadow: true, cellBorder: false, cellBorderColor: '',
    },
    cover: {
      vinylOverlay: true, vinylOpacity: 0.5, grooveCount: 60, frameBorder: 14,
      frameColor: '#FFFFFF', frameShadowBlur: 32,
      showChevrons: true, showArtistName: true, showTrackName: true,
      subtitleText: 'Max Meets Music City',
    },
    decorations: { showNotes: true, showSparkles: true, noteSize: 52, sparkleSize: 36 },
  },
  {
    id: 'midnight_minimal',
    name: 'Midnight Minimal',
    description: 'Clean and modern — white on charcoal',
    background: '#1A1A2E',
    textPrimary: '#FFFFFF',
    textSecondary: '#CCCCCC',
    accent: '#E8E8E8',
    accentGlow: 'rgba(255, 255, 255, ',
    scriptFont: '"DM Sans", sans-serif',
    bodyFont: '"DM Sans", sans-serif',
    neon: {
      outerGlow: 'rgba(255, 255, 255, 0.15)', outerBlur: 30, outerAlpha: 0.2,
      midGlow: 'rgba(255, 255, 255, 0.3)', midBlur: 12, midAlpha: 0.5,
      coreColor: '#FFFFFF', coreBlur: 4,
    },
    grid: {
      gap: 0.003, rotations: [0, 0, 0, 0, 0, 0, 0, 0],
      cellShadow: true, cellBorder: false, cellBorderColor: '',
    },
    cover: {
      vinylOverlay: false, vinylOpacity: 0, grooveCount: 0, frameBorder: 2,
      frameColor: '#333333', frameShadowBlur: 20,
      showChevrons: false, showArtistName: true, showTrackName: true,
      subtitleText: 'New Music Friday',
    },
    decorations: { showNotes: false, showSparkles: false, noteSize: 0, sparkleSize: 0 },
  },
  {
    id: 'neon_rose',
    name: 'Neon Rose',
    description: 'Hot pink neon on deep purple — pop & indie vibes',
    background: '#1A0A2E',
    textPrimary: '#FFB8D0',
    textSecondary: '#E0C0FF',
    accent: '#FF69B4',
    accentGlow: 'rgba(255, 105, 180, ',
    scriptFont: '"Dancing Script", cursive',
    bodyFont: '"DM Sans", sans-serif',
    neon: {
      outerGlow: 'rgba(255, 105, 180, 0.3)', outerBlur: 50, outerAlpha: 0.3,
      midGlow: 'rgba(255, 140, 200, 0.5)', midBlur: 22, midAlpha: 0.6,
      coreColor: '#FFD0E8', coreBlur: 6,
    },
    grid: {
      gap: 0.004, rotations: [-0.4, 0.3, -0.2, 0.4, 0, -0.3, 0.2, -0.4],
      cellShadow: true, cellBorder: false, cellBorderColor: '',
    },
    cover: {
      vinylOverlay: true, vinylOpacity: 0.3, grooveCount: 40, frameBorder: 12,
      frameColor: '#FFD0E8', frameShadowBlur: 28,
      showChevrons: true, showArtistName: true, showTrackName: true,
      subtitleText: 'New Music Friday',
    },
    decorations: { showNotes: true, showSparkles: true, noteSize: 44, sparkleSize: 32 },
  },
  {
    id: 'concrete_jungle',
    name: 'Concrete Jungle',
    description: 'Raw urban edge — hip-hop & R&B curators',
    background: '#0D0D0D',
    textPrimary: '#FF4500',
    textSecondary: '#AAAAAA',
    accent: '#FF4500',
    accentGlow: 'rgba(255, 69, 0, ',
    scriptFont: '"DM Sans", sans-serif',
    bodyFont: '"DM Sans", sans-serif',
    neon: {
      outerGlow: 'rgba(255, 69, 0, 0.25)', outerBlur: 40, outerAlpha: 0.3,
      midGlow: 'rgba(255, 100, 50, 0.5)', midBlur: 18, midAlpha: 0.6,
      coreColor: '#FFB088', coreBlur: 5,
    },
    grid: {
      gap: 0.002, rotations: [0, 0, 0, 0, 0, 0, 0, 0],
      cellShadow: false, cellBorder: true, cellBorderColor: 'rgba(255,69,0,0.2)',
    },
    cover: {
      vinylOverlay: false, vinylOpacity: 0, grooveCount: 0, frameBorder: 4,
      frameColor: '#FF4500', frameShadowBlur: 24,
      showChevrons: false, showArtistName: true, showTrackName: true,
      subtitleText: 'New Music Friday',
    },
    decorations: { showNotes: false, showSparkles: false, noteSize: 0, sparkleSize: 0 },
  },
  {
    id: 'golden_hour',
    name: 'Golden Hour',
    description: 'Warm amber gradients — aesthetic & mood-board accounts',
    background: '#1C1208',
    textPrimary: '#FFD700',
    textSecondary: '#E8C675',
    accent: '#FFB347',
    accentGlow: 'rgba(255, 179, 71, ',
    scriptFont: '"Dancing Script", cursive',
    bodyFont: '"DM Sans", sans-serif',
    neon: {
      outerGlow: 'rgba(255, 215, 0, 0.2)', outerBlur: 50, outerAlpha: 0.25,
      midGlow: 'rgba(255, 200, 50, 0.45)', midBlur: 24, midAlpha: 0.55,
      coreColor: '#FFF5CC', coreBlur: 7,
    },
    grid: {
      gap: 0.006, rotations: [-0.8, 0.6, -0.4, 0.7, 0, -0.9, 0.5, -0.6],
      cellShadow: true, cellBorder: false, cellBorderColor: '',
    },
    cover: {
      vinylOverlay: true, vinylOpacity: 0.4, grooveCount: 50, frameBorder: 16,
      frameColor: '#FFF5E0', frameShadowBlur: 36,
      showChevrons: true, showArtistName: true, showTrackName: true,
      subtitleText: 'New Music Friday',
    },
    decorations: { showNotes: true, showSparkles: true, noteSize: 48, sparkleSize: 40 },
  },
  {
    id: 'editorial_mono',
    name: 'Editorial',
    description: 'Magazine-style — serif type, clean lines, journalism meets music',
    background: '#F5F0E8',
    textPrimary: '#1A1A1A',
    textSecondary: '#666666',
    accent: '#1A1A1A',
    accentGlow: 'rgba(26, 26, 26, ',
    scriptFont: '"Source Serif 4", Georgia, serif',
    bodyFont: '"DM Sans", sans-serif',
    neon: {
      outerGlow: 'rgba(0, 0, 0, 0.05)', outerBlur: 20, outerAlpha: 0.1,
      midGlow: 'rgba(0, 0, 0, 0.1)', midBlur: 8, midAlpha: 0.3,
      coreColor: '#1A1A1A', coreBlur: 0,
    },
    grid: {
      gap: 0.008, rotations: [0, 0, 0, 0, 0, 0, 0, 0],
      cellShadow: true, cellBorder: true, cellBorderColor: 'rgba(0,0,0,0.08)',
    },
    cover: {
      vinylOverlay: false, vinylOpacity: 0, grooveCount: 0, frameBorder: 1,
      frameColor: '#1A1A1A', frameShadowBlur: 16,
      showChevrons: false, showArtistName: true, showTrackName: true,
      subtitleText: 'NEW MUSIC FRIDAY',
    },
    decorations: { showNotes: false, showSparkles: false, noteSize: 0, sparkleSize: 0 },
  },
  // --- NEW DIVERSE TEMPLATES ---

  {
    id: 'retro_vinyl',
    name: 'Retro Vinyl',
    description: 'Warm sepia & brown — 70s record store vibes',
    background: '#2A1810',
    textPrimary: '#E8D0A8',
    textSecondary: '#C4A882',
    accent: '#D4A060',
    accentGlow: 'rgba(212, 160, 96, ',
    scriptFont: '"Source Serif 4", Georgia, serif',
    bodyFont: '"DM Sans", sans-serif',
    neon: {
      outerGlow: 'rgba(212, 160, 96, 0.15)', outerBlur: 30, outerAlpha: 0.2,
      midGlow: 'rgba(212, 160, 96, 0.3)', midBlur: 14, midAlpha: 0.4,
      coreColor: '#E8D0A8', coreBlur: 4,
    },
    grid: {
      gap: 0.006, rotations: [-1.2, 0.8, -0.5, 1.0, 0, -0.9, 0.6, -0.7],
      cellShadow: true, cellBorder: false, cellBorderColor: '',
    },
    cover: {
      vinylOverlay: true, vinylOpacity: 0.6, grooveCount: 80, frameBorder: 18,
      frameColor: '#F5E6D0', frameShadowBlur: 28,
      showChevrons: false, showArtistName: true, showTrackName: true,
      subtitleText: 'New Music Friday',
    },
    decorations: { showNotes: false, showSparkles: false, noteSize: 0, sparkleSize: 0 },
  },
  {
    id: 'neon_city',
    name: 'Neon City',
    description: 'Cyan & magenta on black — synthwave aesthetic',
    background: '#050510',
    textPrimary: '#00FFD4',
    textSecondary: '#FF00FF',
    accent: '#00FFD4',
    accentGlow: 'rgba(0, 255, 212, ',
    scriptFont: '"DM Sans", sans-serif',
    bodyFont: '"DM Sans", sans-serif',
    neon: {
      outerGlow: 'rgba(0, 255, 212, 0.3)', outerBlur: 55, outerAlpha: 0.35,
      midGlow: 'rgba(255, 0, 255, 0.4)', midBlur: 25, midAlpha: 0.5,
      coreColor: '#FFFFFF', coreBlur: 8,
    },
    grid: {
      gap: 0.004, rotations: [0, 0, 0, 0, 0, 0, 0, 0],
      cellShadow: false, cellBorder: true, cellBorderColor: 'rgba(0,255,212,0.3)',
    },
    cover: {
      vinylOverlay: false, vinylOpacity: 0, grooveCount: 0, frameBorder: 3,
      frameColor: '#00FFD4', frameShadowBlur: 40,
      showChevrons: false, showArtistName: true, showTrackName: true,
      subtitleText: 'New Music Friday',
    },
    decorations: { showNotes: false, showSparkles: true, noteSize: 0, sparkleSize: 24 },
  },
  {
    id: 'earthy_acoustic',
    name: 'Earthy Acoustic',
    description: 'Forest green & cream — organic, handcrafted feel',
    background: '#1A2E1A',
    textPrimary: '#E8E0C8',
    textSecondary: '#A8C4A0',
    accent: '#7BA87A',
    accentGlow: 'rgba(123, 168, 122, ',
    scriptFont: '"Dancing Script", cursive',
    bodyFont: '"DM Sans", sans-serif',
    neon: {
      outerGlow: 'rgba(123, 168, 122, 0.2)', outerBlur: 35, outerAlpha: 0.25,
      midGlow: 'rgba(168, 196, 160, 0.4)', midBlur: 16, midAlpha: 0.5,
      coreColor: '#E8E0C8', coreBlur: 5,
    },
    grid: {
      gap: 0.007, rotations: [-0.3, 0.2, -0.4, 0.3, 0, -0.2, 0.4, -0.3],
      cellShadow: true, cellBorder: false, cellBorderColor: '',
    },
    cover: {
      vinylOverlay: false, vinylOpacity: 0, grooveCount: 0, frameBorder: 10,
      frameColor: '#E8E0C8', frameShadowBlur: 20,
      showChevrons: false, showArtistName: true, showTrackName: true,
      subtitleText: 'New Music Friday',
    },
    decorations: { showNotes: true, showSparkles: false, noteSize: 40, sparkleSize: 0 },
  },
  {
    id: 'stadium_lights',
    name: 'Stadium Lights',
    description: 'Dark navy & bright white — arena energy',
    background: '#0A0E1E',
    textPrimary: '#FFFFFF',
    textSecondary: '#B0C4E8',
    accent: '#FFFFFF',
    accentGlow: 'rgba(255, 255, 255, ',
    scriptFont: '"DM Sans", sans-serif',
    bodyFont: '"DM Sans", sans-serif',
    neon: {
      outerGlow: 'rgba(255, 255, 255, 0.25)', outerBlur: 60, outerAlpha: 0.3,
      midGlow: 'rgba(200, 220, 255, 0.5)', midBlur: 28, midAlpha: 0.6,
      coreColor: '#FFFFFF', coreBlur: 10,
    },
    grid: {
      gap: 0.003, rotations: [0, 0, 0, 0, 0, 0, 0, 0],
      cellShadow: true, cellBorder: true, cellBorderColor: 'rgba(255,255,255,0.1)',
    },
    cover: {
      vinylOverlay: false, vinylOpacity: 0, grooveCount: 0, frameBorder: 6,
      frameColor: '#FFFFFF', frameShadowBlur: 50,
      showChevrons: true, showArtistName: true, showTrackName: true,
      subtitleText: 'New Music Friday',
    },
    decorations: { showNotes: false, showSparkles: true, noteSize: 0, sparkleSize: 44 },
  },
];

function carouselShellFromV2(template: V2CarouselBodyTemplate): CarouselTemplate {
  return {
    id: template.id,
    name: template.name,
    description: template.description,
    engine: 'v2',
    v2PresetId: template.id,
    background: template.palette.bg,
    textPrimary: template.palette.text,
    textSecondary: template.palette.textMuted ?? template.palette.text,
    accent: template.palette.accent,
    accentGlow: 'rgba(245, 196, 83, ',
    scriptFont: `"${template.fonts.display}", serif`,
    bodyFont: `"${template.fonts.body}", sans-serif`,
    neon: {
      outerGlow: 'rgba(245, 196, 83, 0.15)',
      outerBlur: 30,
      outerAlpha: 0.2,
      midGlow: 'rgba(245, 196, 83, 0.3)',
      midBlur: 14,
      midAlpha: 0.4,
      coreColor: template.palette.text,
      coreBlur: 4,
    },
    grid: {
      gap: 0.005,
      rotations: template.cellRotate.slice(0, 8),
      cellShadow: Boolean(template.cellShadow),
      cellBorder: false,
      cellBorderColor: '',
    },
    cover: {
      vinylOverlay: Boolean(template.showVinyl),
      vinylOpacity: template.vinylOpacity ?? 0,
      grooveCount: 60,
      frameBorder: Math.max(2, Math.round(template.cellPadding * 0.5)),
      frameColor: template.palette.accent,
      frameShadowBlur: 24,
      showChevrons: false,
      showArtistName: true,
      showTrackName: true,
      subtitleText: 'New Music Friday',
    },
    decorations: {
      showNotes: false,
      showSparkles: template.decoration === 'sunburst-rays',
      noteSize: 0,
      sparkleSize: 24,
    },
    grainIntensity: template.grainOpacity ?? 0.04,
    vignetteIntensity: 0.18,
  };
}

const V1_TEMPLATES: CarouselTemplate[] = LEGACY_TEMPLATES.map(template => ({
  engine: 'v1',
  ...template,
}));

export const TEMPLATES: CarouselTemplate[] = [
  ...V1_TEMPLATES,
  ...PHASE3_LIVE_BODY_TEMPLATE_PRESETS.map(carouselShellFromV2),
];

const V2_BODY_TEMPLATE_PRESET_BY_ID = new Map(PHASE3_LIVE_BODY_TEMPLATE_PRESETS.map(template => [template.id, template]));

/** Templates that are exclusive to Max's account */
export const MAX_ONLY_TEMPLATES = new Set(['mmmc_classic', 'neon_rose', 'golden_hour']);

/** Runtime registry for custom templates (set by TemplateSelector when loading from storage) */
let _customTemplateRegistry: CarouselTemplate[] = [];
export function registerCustomTemplates(templates: CarouselTemplate[]) { _customTemplateRegistry = templates; }

/** Register a single ephemeral template for live preview (overwritten on each call) */
let _tempTemplate: CarouselTemplate | null = null;
export function registerTempTemplate(t: CarouselTemplate) { _tempTemplate = t; }
export function clearTempTemplate() { _tempTemplate = null; }

export function getTemplate(id: string): CarouselTemplate {
  if (_tempTemplate && _tempTemplate.id === id) return _tempTemplate;
  return TEMPLATES.find(t => t.id === id) || _customTemplateRegistry.find(t => t.id === id) || TEMPLATES[0];
}

export function getV2BodyTemplatePreset(template: CarouselTemplate): V2CarouselBodyTemplate | undefined {
  if (template.engine !== 'v2') return undefined;
  return V2_BODY_TEMPLATE_PRESET_BY_ID.get(template.v2PresetId || template.id);
}

/** Get templates visible to a user (filters out Max-only for other users) */
export function getVisibleTemplates(userEmail?: string): CarouselTemplate[] {
  const isMax = userEmail === 'maxmeetsmusiccity@gmail.com';
  if (isMax) return TEMPLATES;
  return TEMPLATES.filter(t => !MAX_ONLY_TEMPLATES.has(t.id));
}
