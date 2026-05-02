import { PHASE3_LIVE_BODY_TEMPLATE_PRESETS } from './body-templates-v2-phase3';
import { NMF_BRAND_TOKENS, V2_PALETTES } from './brand-tokens';
import type { V2CarouselBodyTemplate } from './template-types-v2';

export type Phase6MarqueeBodyBand = 'marquee-rev2-core' | 'marquee-rev2-range';

export interface Phase6MarqueeBodyTemplateScaffold {
  band: Phase6MarqueeBodyBand;
  template: V2CarouselBodyTemplate;
  marqueeRevision: 'rev-2';
  liveInPhase6: true;
}

const serifFonts = {
  display: NMF_BRAND_TOKENS.font.display,
  body: NMF_BRAND_TOKENS.font.body,
  mono: NMF_BRAND_TOKENS.font.mono,
};

const sansFonts = {
  display: NMF_BRAND_TOKENS.font.sans,
  body: NMF_BRAND_TOKENS.font.sans,
  mono: NMF_BRAND_TOKENS.font.mono,
};

const marqueeGoldRoom: V2CarouselBodyTemplate = {
  id: 'v2_marquee_gold_room',
  name: 'Marquee Gold Room',
  description: 'Deep theater body grid with gold bulbs, teal logo block, and editorial covers',
  engine: 'v2',
  kind: 'body',
  palette: {
    bg: NMF_BRAND_TOKENS.color.inkPrimary,
    accent: NMF_BRAND_TOKENS.color.accentGold,
    accent2: NMF_BRAND_TOKENS.color.accentTeal,
    text: NMF_BRAND_TOKENS.color.ivory,
    textMuted: NMF_BRAND_TOKENS.color.warmGold,
  },
  fonts: serifFonts,
  cellPadding: 13,
  cellRadius: 5,
  cellShadow: '0 16px 34px rgba(0,0,0,.5)',
  cellRotate: [-0.9, 0.7, -0.5, 0.9, -0.7, 0.5, -1.1, 0.8, -0.4],
  decoration: 'marquee-bulbs',
  showGrain: true,
  grainOpacity: 0.045,
};

const marqueeNeonBackline: V2CarouselBodyTemplate = {
  id: 'v2_marquee_neon_backline',
  name: 'Marquee Neon Backline',
  description: 'Black-box show grid with teal glow and warm marquee edges',
  engine: 'v2',
  kind: 'body',
  palette: {
    bg: NMF_BRAND_TOKENS.color.inkPrimary,
    accent: NMF_BRAND_TOKENS.color.accentTeal,
    accent2: NMF_BRAND_TOKENS.color.accentGold,
    text: NMF_BRAND_TOKENS.color.paper,
    textMuted: NMF_BRAND_TOKENS.color.accentTeal,
  },
  fonts: sansFonts,
  cellPadding: 11,
  cellRadius: 2,
  cellShadow: '0 0 32px rgba(62,230,195,.24)',
  cellRotate: [0, 0.25, -0.25, 0, 0.2, -0.2, 0, 0.15, -0.15],
  decoration: 'marquee-bulbs',
  neonGlow: { color: NMF_BRAND_TOKENS.color.accentTeal, size: 14, intensity: 0.75 },
  showGrain: true,
  grainOpacity: 0.035,
  postProcess: 'scanlines',
};

const marqueePosterStack: V2CarouselBodyTemplate = {
  id: 'v2_marquee_poster_stack',
  name: 'Marquee Poster Stack',
  description: 'Warm poster-wall treatment for dense weeks and release roundups',
  engine: 'v2',
  kind: 'body',
  palette: {
    ...V2_PALETTES.honkyTonk,
    accent: NMF_BRAND_TOKENS.color.rust,
    accent2: NMF_BRAND_TOKENS.color.accentGold,
  },
  fonts: serifFonts,
  cellPadding: 9,
  cellRadius: 1,
  cellShadow: '5px 5px 0 rgba(26,22,16,.72)',
  cellRotate: [-1.4, 1.1, -0.8, 1.3, -1, 0.8, -1.2, 1, -0.7],
  decoration: 'halftone-banner',
  showGrain: true,
  grainOpacity: 0.05,
  postProcess: 'halftone',
};

function marquee(
  band: Phase6MarqueeBodyBand,
  template: V2CarouselBodyTemplate,
): Phase6MarqueeBodyTemplateScaffold {
  return { band, template, marqueeRevision: 'rev-2', liveInPhase6: true };
}

export const PHASE6_MARQUEE_BODY_TEMPLATE_SCAFFOLD: Phase6MarqueeBodyTemplateScaffold[] = [
  marquee('marquee-rev2-core', marqueeGoldRoom),
  marquee('marquee-rev2-core', marqueeNeonBackline),
  marquee('marquee-rev2-range', marqueePosterStack),
];

export const PHASE6_MARQUEE_BODY_TEMPLATE_IDS = PHASE6_MARQUEE_BODY_TEMPLATE_SCAFFOLD
  .map(item => item.template.id);

export const PHASE6_MARQUEE_BODY_TEMPLATE_PRESETS = PHASE6_MARQUEE_BODY_TEMPLATE_SCAFFOLD
  .map(item => item.template);

export const PHASE6_LIVE_BODY_TEMPLATE_PRESETS: V2CarouselBodyTemplate[] = [
  ...PHASE3_LIVE_BODY_TEMPLATE_PRESETS,
  ...PHASE6_MARQUEE_BODY_TEMPLATE_PRESETS,
];
