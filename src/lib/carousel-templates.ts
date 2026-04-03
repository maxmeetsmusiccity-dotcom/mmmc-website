export interface CarouselTemplate {
  id: string;
  name: string;
  description: string;

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
}

export const TEMPLATES: CarouselTemplate[] = [
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
];

export function getTemplate(id: string): CarouselTemplate {
  return TEMPLATES.find(t => t.id === id) || TEMPLATES[0];
}
