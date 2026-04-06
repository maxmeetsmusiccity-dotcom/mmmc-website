/**
 * 10 Title Slide Templates for New Music Friday carousels.
 * Based on research of country music media visual trends (2025-2026).
 * Each template defines colors, fonts, layout, and decorative elements
 * for the cover/title slide of a carousel.
 */

export interface TitleSlideTemplate {
  id: string;
  name: string;
  description: string;

  // Colors
  background: string;
  backgroundGradient?: string;  // CSS gradient if applicable
  textPrimary: string;
  textSecondary: string;
  accent: string;

  // Fonts
  headlineFont: string;
  subtitleFont: string;
  dateFont: string;

  // Text style
  headlineWeight: number;
  headlineCase: 'uppercase' | 'capitalize' | 'none';
  headlineSize: number;   // fraction of canvas width
  subtitleSize: number;
  dateSize: number;

  // Layout
  headlineY: number;      // fraction of canvas height
  subtitleY: number;
  dateY: number;
  featuredImageY: number;
  featuredImageSize: number;  // fraction of canvas width

  // Effects
  glow: {
    color: string;
    blur: number;
    passes: number;
  };
  grain: number;          // 0-1, noise intensity
  vignette: number;       // 0-1, edge darkening
  overlay?: string;       // overlay color with alpha

  // Decorations
  showFrame: boolean;
  frameColor: string;
  frameWidth: number;
  showDivider: boolean;
  dividerColor: string;

  // Featured image style
  featuredBorder: number;
  featuredBorderColor: string;
  featuredShadowBlur: number;
  featuredRotation: number;  // degrees

  // Unique per-template
  texture?: 'grain' | 'halftone' | 'leather' | 'denim' | 'none';
  swipePill: boolean;
  vinylRecord?: boolean;
}

export const TITLE_TEMPLATES: TitleSlideTemplate[] = [
  // 1. Nashville Neon
  {
    id: 'nashville_neon',
    name: 'Nashville Neon',
    description: 'Hot neon on dark — late-night Broadway energy',
    background: '#0A0E1A',
    textPrimary: '#FF69B4',
    textSecondary: '#00D4FF',
    accent: '#FF69B4',
    headlineFont: '"DM Sans", sans-serif',
    subtitleFont: '"DM Sans", sans-serif',
    dateFont: '"DM Sans", sans-serif',
    headlineWeight: 900,
    headlineCase: 'uppercase',
    headlineSize: 0.065,
    subtitleSize: 0.028,
    dateSize: 0.042,
    headlineY: 0.04,
    subtitleY: 0.12,
    dateY: 0.90,
    featuredImageY: 0.18,
    featuredImageSize: 0.52,
    glow: { color: 'rgba(255,105,180,0.4)', blur: 50, passes: 5 },
    grain: 0.15,
    vignette: 0.35,
    showFrame: false, frameColor: '', frameWidth: 0,
    showDivider: true, dividerColor: 'rgba(0,212,255,0.4)',
    featuredBorder: 0, featuredBorderColor: '', featuredShadowBlur: 40, featuredRotation: 0,
    texture: 'grain',
    swipePill: true,
  },

  // 2. Vintage Press
  {
    id: 'vintage_press',
    name: 'Vintage Press',
    description: 'Cream & ink — letterpress authenticity',
    background: '#F5F0E0',
    textPrimary: '#1A1A1A',
    textSecondary: '#8B7355',
    accent: '#C4572A',
    headlineFont: '"Source Serif 4", Georgia, serif',
    subtitleFont: '"JetBrains Mono", monospace',
    dateFont: '"Source Serif 4", Georgia, serif',
    headlineWeight: 700,
    headlineCase: 'uppercase',
    headlineSize: 0.055,
    subtitleSize: 0.022,
    dateSize: 0.038,
    headlineY: 0.04,
    subtitleY: 0.11,
    dateY: 0.91,
    featuredImageY: 0.17,
    featuredImageSize: 0.50,
    glow: { color: 'rgba(0,0,0,0.05)', blur: 8, passes: 1 },
    grain: 0.25,
    vignette: 0.15,
    showFrame: true, frameColor: '#1A1A1A', frameWidth: 3,
    showDivider: true, dividerColor: 'rgba(26,26,26,0.3)',
    featuredBorder: 6, featuredBorderColor: '#1A1A1A', featuredShadowBlur: 12, featuredRotation: -1.5,
    texture: 'halftone',
    swipePill: false,
  },

  // 3. Dust & Gold — warm parchment/sepia, vintage Western poster aesthetic
  {
    id: 'dust_gold',
    name: 'Dust & Gold',
    description: 'Warm parchment & sepia — vintage country poster',
    background: '#F5E6C8',
    backgroundGradient: 'linear-gradient(180deg, #FAF0DC 0%, #F5E6C8 40%, #E8D4AA 100%)',
    textPrimary: '#3B2512',
    textSecondary: '#7A5C3A',
    accent: '#C4882A',
    headlineFont: '"Source Serif 4", Georgia, serif',
    subtitleFont: '"Source Serif 4", Georgia, serif',
    dateFont: '"Dancing Script", cursive',
    headlineWeight: 700,
    headlineCase: 'capitalize',
    headlineSize: 0.058,
    subtitleSize: 0.022,
    dateSize: 0.042,
    headlineY: 0.04,
    subtitleY: 0.11,
    dateY: 0.90,
    featuredImageY: 0.17,
    featuredImageSize: 0.50,
    glow: { color: 'rgba(0,0,0,0)', blur: 0, passes: 0 },
    grain: 0.28,
    vignette: 0.12,
    showFrame: true, frameColor: '#7A5C3A', frameWidth: 4,
    showDivider: true, dividerColor: 'rgba(59,37,18,0.25)',
    featuredBorder: 10, featuredBorderColor: '#FFF8EE', featuredShadowBlur: 16, featuredRotation: -2,
    texture: 'grain',
    swipePill: false,
  },

  // 4. Studio Clean
  {
    id: 'studio_clean',
    name: 'Studio Clean',
    description: 'White & minimal — Apple Music energy',
    background: '#FFFFFF',
    textPrimary: '#1A1A1A',
    textSecondary: '#666666',
    accent: '#FF3B30',
    headlineFont: '"DM Sans", sans-serif',
    subtitleFont: '"DM Sans", sans-serif',
    dateFont: '"DM Sans", sans-serif',
    headlineWeight: 800,
    headlineCase: 'uppercase',
    headlineSize: 0.050,
    subtitleSize: 0.022,
    dateSize: 0.030,
    headlineY: 0.05,
    subtitleY: 0.11,
    dateY: 0.92,
    featuredImageY: 0.18,
    featuredImageSize: 0.55,
    glow: { color: 'rgba(0,0,0,0)', blur: 0, passes: 0 },
    grain: 0,
    vignette: 0,
    showFrame: false, frameColor: '', frameWidth: 0,
    showDivider: false, dividerColor: '',
    featuredBorder: 0, featuredBorderColor: '', featuredShadowBlur: 24, featuredRotation: 0,
    texture: 'none',
    swipePill: true,
  },

  // 5. Honky Tonk Poster
  {
    id: 'honky_tonk',
    name: 'Honky Tonk Poster',
    description: 'Bold playbill — Hatch Show Print vibes',
    background: '#F5E6B8',
    textPrimary: '#CC1100',
    textSecondary: '#1A1A1A',
    accent: '#CC1100',
    headlineFont: '"DM Sans", sans-serif',
    subtitleFont: '"DM Sans", sans-serif',
    dateFont: '"DM Sans", sans-serif',
    headlineWeight: 900,
    headlineCase: 'uppercase',
    headlineSize: 0.070,
    subtitleSize: 0.028,
    dateSize: 0.040,
    headlineY: 0.03,
    subtitleY: 0.12,
    dateY: 0.90,
    featuredImageY: 0.18,
    featuredImageSize: 0.50,
    glow: { color: 'rgba(0,0,0,0)', blur: 0, passes: 0 },
    grain: 0.30,
    vignette: 0.10,
    showFrame: true, frameColor: '#CC1100', frameWidth: 6,
    showDivider: true, dividerColor: '#1A1A1A',
    featuredBorder: 8, featuredBorderColor: '#1A1A1A', featuredShadowBlur: 0, featuredRotation: 2,
    texture: 'halftone',
    swipePill: false,
  },

  // 6. Chrome & Denim
  {
    id: 'chrome_denim',
    name: 'Chrome & Denim',
    description: 'Steel blue & chrome — tough country-rock',
    background: '#0F1822',
    textPrimary: '#C0C8D4',
    textSecondary: '#7A8B9D',
    accent: '#A8B8CC',
    headlineFont: '"DM Sans", sans-serif',
    subtitleFont: '"DM Sans", sans-serif',
    dateFont: '"DM Sans", sans-serif',
    headlineWeight: 900,
    headlineCase: 'uppercase',
    headlineSize: 0.060,
    subtitleSize: 0.024,
    dateSize: 0.035,
    headlineY: 0.04,
    subtitleY: 0.12,
    dateY: 0.91,
    featuredImageY: 0.18,
    featuredImageSize: 0.52,
    glow: { color: 'rgba(168,184,204,0.2)', blur: 30, passes: 3 },
    grain: 0.18,
    vignette: 0.25,
    showFrame: false, frameColor: '', frameWidth: 0,
    showDivider: true, dividerColor: 'rgba(168,184,204,0.3)',
    featuredBorder: 3, featuredBorderColor: '#4A6080', featuredShadowBlur: 20, featuredRotation: 0,
    texture: 'denim',
    swipePill: true,
  },

  // 7. Editorial Mag
  {
    id: 'editorial_mag',
    name: 'Editorial Mag',
    description: 'Muted tones & serif — magazine sophistication',
    background: '#F0EBE3',
    textPrimary: '#2C2C2C',
    textSecondary: '#8C7B6B',
    accent: '#C4A882',
    headlineFont: '"Source Serif 4", Georgia, serif',
    subtitleFont: '"DM Sans", sans-serif',
    dateFont: '"DM Sans", sans-serif',
    headlineWeight: 400,
    headlineCase: 'capitalize',
    headlineSize: 0.055,
    subtitleSize: 0.020,
    dateSize: 0.028,
    headlineY: 0.05,
    subtitleY: 0.12,
    dateY: 0.92,
    featuredImageY: 0.18,
    featuredImageSize: 0.54,
    glow: { color: 'rgba(0,0,0,0)', blur: 0, passes: 0 },
    grain: 0.08,
    vignette: 0.05,
    showFrame: true, frameColor: '#2C2C2C', frameWidth: 1,
    showDivider: true, dividerColor: 'rgba(44,44,44,0.2)',
    featuredBorder: 1, featuredBorderColor: '#2C2C2C', featuredShadowBlur: 16, featuredRotation: 0,
    texture: 'none',
    swipePill: false,
  },

  // 8. Saturated Block
  {
    id: 'saturated_block',
    name: 'Saturated Block',
    description: 'Bold flat color — Spotify-coded, maximum impact',
    background: '#E83E8C',
    textPrimary: '#FFFFFF',
    textSecondary: '#FFD0E8',
    accent: '#FFFFFF',
    headlineFont: '"DM Sans", sans-serif',
    subtitleFont: '"DM Sans", sans-serif',
    dateFont: '"DM Sans", sans-serif',
    headlineWeight: 900,
    headlineCase: 'uppercase',
    headlineSize: 0.075,
    subtitleSize: 0.025,
    dateSize: 0.038,
    headlineY: 0.03,
    subtitleY: 0.13,
    dateY: 0.90,
    featuredImageY: 0.19,
    featuredImageSize: 0.48,
    glow: { color: 'rgba(255,255,255,0.15)', blur: 20, passes: 2 },
    grain: 0,
    vignette: 0,
    showFrame: false, frameColor: '', frameWidth: 0,
    showDivider: false, dividerColor: '',
    featuredBorder: 0, featuredBorderColor: '', featuredShadowBlur: 30, featuredRotation: 0,
    texture: 'none',
    swipePill: true,
  },

  // 9. (Removed — duplicate polaroid_stack, kept version in Max-only section)

  // 10. Dark Cinematic
  {
    id: 'dark_cinematic',
    name: 'Dark Cinematic',
    description: 'Moody & atmospheric — prestige music journalism',
    background: '#0A0A0A',
    backgroundGradient: 'linear-gradient(180deg, #141414 0%, #0A0A0A 40%, #050505 100%)',
    textPrimary: '#E8E0D0',
    textSecondary: '#8A8070',
    accent: '#C8A050',
    headlineFont: '"DM Sans", sans-serif',
    subtitleFont: '"Source Serif 4", Georgia, serif',
    dateFont: '"DM Sans", sans-serif',
    headlineWeight: 300,
    headlineCase: 'uppercase',
    headlineSize: 0.048,
    subtitleSize: 0.022,
    dateSize: 0.028,
    headlineY: 0.05,
    subtitleY: 0.12,
    dateY: 0.92,
    featuredImageY: 0.18,
    featuredImageSize: 0.54,
    glow: { color: 'rgba(200,160,80,0.15)', blur: 30, passes: 3 },
    grain: 0.22,
    vignette: 0.40,
    showFrame: false, frameColor: '', frameWidth: 0,
    showDivider: true, dividerColor: 'rgba(200,160,80,0.2)',
    featuredBorder: 0, featuredBorderColor: '', featuredShadowBlur: 40, featuredRotation: 0,
    texture: 'grain',
    swipePill: true,
  },

  // 11. Gold Frame — minimal luxury, thin gold inset border, clean editorial
  {
    id: 'gold_frame',
    name: 'Gold Frame',
    description: 'Thin gold frame, centered album art, elegant serif — minimal luxury',
    background: '#0F1B33',
    textPrimary: '#F5E6B8',
    textSecondary: '#A8B4C8',
    accent: '#D4A843',
    headlineFont: '"Playfair Display", "Georgia", serif',
    subtitleFont: '"DM Sans", sans-serif',
    dateFont: '"Playfair Display", "Georgia", serif',
    headlineWeight: 600,
    headlineCase: 'uppercase',
    headlineSize: 0.038,
    subtitleSize: 0.022,
    dateSize: 0.032,
    headlineY: 0.06,
    subtitleY: 0.11,
    dateY: 0.90,
    featuredImageY: 0.22,
    featuredImageSize: 0.50,
    glow: { color: 'rgba(212,168,67,0.1)', blur: 8, passes: 1 },
    grain: 0.08,
    vignette: 0.20,
    showFrame: true, frameColor: '#D4A843', frameWidth: 3,
    showDivider: true, dividerColor: 'rgba(212,168,67,0.3)',
    featuredBorder: 10, featuredBorderColor: '#FFFFFF', featuredShadowBlur: 30, featuredRotation: 0,
    swipePill: false,
  },

  // 12. Spotlight — radial gradient, floating album art, modern/technical feel
  {
    id: 'spotlight',
    name: 'Spotlight',
    description: 'Radial gradient, floating album art with deep shadow — modern feel',
    background: '#0F1B33',
    backgroundGradient: 'linear-gradient(180deg, #162544 0%, #0A1225 100%)',
    textPrimary: '#FFFFFF',
    textSecondary: '#A8B4C8',
    accent: '#D4A843',
    headlineFont: '"DM Sans", sans-serif',
    subtitleFont: '"DM Sans", sans-serif',
    dateFont: '"DM Mono", "Courier New", monospace',
    headlineWeight: 700,
    headlineCase: 'uppercase',
    headlineSize: 0.042,
    subtitleSize: 0.020,
    dateSize: 0.028,
    headlineY: 0.05,
    subtitleY: 0.10,
    dateY: 0.91,
    featuredImageY: 0.24,
    featuredImageSize: 0.48,
    glow: { color: 'rgba(255,255,255,0.05)', blur: 4, passes: 0 },
    grain: 0.14,
    vignette: 0.35,
    showFrame: false, frameColor: '', frameWidth: 0,
    showDivider: false, dividerColor: '',
    featuredBorder: 0, featuredBorderColor: '', featuredShadowBlur: 50, featuredRotation: 0,
    swipePill: true,
  },

  // 13. Polaroid Stack — playful, Instagram-native, tilted white-framed photo
  {
    id: 'polaroid_stack',
    name: 'Polaroid Stack',
    description: 'Album art as a tilted Polaroid photo — playful, Instagram-native',
    background: '#0F1B33',
    textPrimary: '#F5E6B8',
    textSecondary: '#FFFFFF',
    accent: '#D4A843',
    headlineFont: '"Dancing Script", cursive',
    subtitleFont: '"DM Sans", sans-serif',
    dateFont: '"Dancing Script", cursive',
    headlineWeight: 700,
    headlineCase: 'capitalize',
    headlineSize: 0.058,
    subtitleSize: 0.024,
    dateSize: 0.040,
    headlineY: 0.04,
    subtitleY: 0.11,
    dateY: 0.90,
    featuredImageY: 0.22,
    featuredImageSize: 0.46,
    glow: { color: 'rgba(212,168,67,0.3)', blur: 30, passes: 3 },
    grain: 0.10,
    vignette: 0.25,
    showFrame: false, frameColor: '', frameWidth: 0,
    showDivider: false, dividerColor: '',
    featuredBorder: 16, featuredBorderColor: '#FFFFFF', featuredShadowBlur: 35, featuredRotation: -3,
    swipePill: false,
  },

  // 14. Vinyl Classic — Max's original cover slide: vinyl record + gold neon
  {
    id: 'vinyl_classic',
    name: 'Vinyl Classic',
    description: 'Dark navy vinyl record with gold neon — the Nashville original',
    background: '#0F1B33',
    textPrimary: '#F5E6B8',
    textSecondary: '#FFFFFF',
    accent: '#D4A843',
    headlineFont: '"Dancing Script", cursive',
    subtitleFont: '"DM Sans", sans-serif',
    dateFont: '"Dancing Script", cursive',
    headlineWeight: 700,
    headlineCase: 'capitalize',
    headlineSize: 0.052,
    subtitleSize: 0.026,
    dateSize: 0.044,
    headlineY: 0.03,
    subtitleY: 0.10,
    dateY: 0.90,
    featuredImageY: 0.28,
    featuredImageSize: 0.42,
    glow: { color: 'rgba(212,168,67,0.4)', blur: 45, passes: 5 },
    grain: 0.15,
    vignette: 0.30,
    showFrame: false, frameColor: '', frameWidth: 0,
    showDivider: true, dividerColor: 'rgba(212,168,67,0.4)',
    featuredBorder: 0, featuredBorderColor: '', featuredShadowBlur: 0, featuredRotation: 0,
    texture: 'grain',
    swipePill: false,
    vinylRecord: true,
  },
];

/** Title templates that are exclusive to Max's account */
export const MAX_ONLY_TITLE_TEMPLATES = new Set(['nashville_neon', 'vinyl_classic', 'gold_frame', 'spotlight', 'polaroid_stack']);

export function getTitleTemplate(id: string): TitleSlideTemplate {
  return TITLE_TEMPLATES.find(t => t.id === id) || TITLE_TEMPLATES[0];
}

/** Get title templates visible to a user (filters out Max-only for other users) */
export function getVisibleTitleTemplates(userEmail?: string): TitleSlideTemplate[] {
  const isMax = userEmail === 'maxmeetsmusiccity@gmail.com' || userEmail === 'maxblachman@gmail.com';
  if (isMax) {
    // Max-only templates first, then the rest
    const maxOnly = TITLE_TEMPLATES.filter(t => MAX_ONLY_TITLE_TEMPLATES.has(t.id));
    const rest = TITLE_TEMPLATES.filter(t => !MAX_ONLY_TITLE_TEMPLATES.has(t.id));
    return [...maxOnly, ...rest];
  }
  return TITLE_TEMPLATES.filter(t => !MAX_ONLY_TITLE_TEMPLATES.has(t.id));
}

/** Get the default title template ID for a user */
export function getDefaultTitleTemplateId(userEmail?: string): string {
  const isMax = userEmail === 'maxmeetsmusiccity@gmail.com' || userEmail === 'maxblachman@gmail.com';
  if (isMax) return 'vinyl_classic';
  const firstVisible = TITLE_TEMPLATES.find(t => !MAX_ONLY_TITLE_TEMPLATES.has(t.id));
  return firstVisible?.id || TITLE_TEMPLATES[0].id;
}
