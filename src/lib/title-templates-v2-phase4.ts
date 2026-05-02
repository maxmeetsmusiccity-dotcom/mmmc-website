import { NMF_BRAND_TOKENS, V2_PALETTES, V2_TITLE_TEMPLATE_PRESETS } from './brand-tokens';
import type { V2TitleSlideTemplate } from './template-types-v2';

export type Phase4TitleTemplateBand = 'launch-3' | 'expansion-4' | 'reserve-4';

export interface Phase4TitleTemplateScaffold {
  band: Phase4TitleTemplateBand;
  template: V2TitleSlideTemplate;
  activeInPhase2: boolean;
}

const activePresetById = new Map(V2_TITLE_TEMPLATE_PRESETS.map(template => [template.id, template]));

function active(id: string, band: Phase4TitleTemplateBand): Phase4TitleTemplateScaffold {
  const template = activePresetById.get(id);
  if (!template) throw new Error(`Missing active v2 title preset for Phase 4 scaffold: ${id}`);
  return { band, template, activeInPhase2: true };
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

const scriptFonts = {
  ...serifFonts,
  script: NMF_BRAND_TOKENS.font.script,
};

function planned(band: Phase4TitleTemplateBand, template: V2TitleSlideTemplate): Phase4TitleTemplateScaffold {
  return { band, template, activeInPhase2: false };
}

export const PHASE4_TITLE_TEMPLATE_SCAFFOLD: Phase4TitleTemplateScaffold[] = [
  active('v2_marquee', 'launch-3'),
  active('v2_neon_glow', 'launch-3'),
  active('v2_pearl_magazine', 'launch-3'),
  planned('expansion-4', {
    id: 'v2_rope_overture',
    name: 'Rope Overture',
    description: 'Rope-trimmed cover overture with warm theater hierarchy',
    engine: 'v2',
    kind: 'title',
    palette: V2_PALETTES.honkyTonk,
    fonts: serifFonts,
    layout: 'mosaic-overture',
    featuredSize: 0.48,
    featuredRadius: 6,
    featuredRotate: -2,
    showSwipePill: true,
    swipePillStyle: 'rope-tag',
    titleStyle: 'serif-italic-display',
    subtitleStyle: 'allcaps-spaced',
    decoration: 'rope-frame',
    showGrain: true,
    grainOpacity: 0.04,
  }),
  planned('expansion-4', {
    id: 'v2_script_spotlight',
    name: 'Script Spotlight',
    description: 'Songwriter-script title over a restrained spotlight feature',
    engine: 'v2',
    kind: 'title',
    palette: V2_PALETTES.pearlSnap,
    fonts: scriptFonts,
    layout: 'script-overlay',
    featuredSize: 0.5,
    featuredRadius: 3,
    featuredRotate: 1,
    showSwipePill: true,
    swipePillStyle: 'script-tag',
    titleStyle: 'mixed-script',
    subtitleStyle: 'allcaps-spaced',
    decoration: 'script-flourish',
    showGrain: true,
    grainOpacity: 0.025,
  }),
  planned('expansion-4', {
    id: 'v2_stadium_poster',
    name: 'Stadium Poster',
    description: 'Arena poster title with high-contrast centered stack',
    engine: 'v2',
    kind: 'title',
    palette: V2_PALETTES.stadiumLights,
    fonts: sansFonts,
    layout: 'poster-stamped',
    featuredSize: 0.46,
    featuredRadius: 4,
    featuredRotate: 0,
    showSwipePill: true,
    swipePillStyle: 'gold-pill',
    titleStyle: 'sans-bold',
    subtitleStyle: 'mono-spaced',
    decoration: 'spotlight',
    postProcess: 'spotlight',
    showGrain: true,
    grainOpacity: 0.035,
  }),
  planned('expansion-4', {
    id: 'v2_sunburst_countdown',
    name: 'Sunburst Countdown',
    description: 'Radial release-week energy with bright swipe CTA',
    engine: 'v2',
    kind: 'title',
    palette: {
      bg: NMF_BRAND_TOKENS.color.inkPrimary,
      accent: NMF_BRAND_TOKENS.color.accentGold,
      accent2: NMF_BRAND_TOKENS.color.rose,
      text: NMF_BRAND_TOKENS.color.ivory,
      textMuted: NMF_BRAND_TOKENS.color.warmGold,
    },
    fonts: sansFonts,
    layout: 'radial-burst',
    featuredSize: 0.44,
    featuredRadius: 4,
    featuredRotate: -1,
    showSwipePill: true,
    swipePillStyle: 'sunburst-pill',
    titleStyle: 'sans-bold',
    subtitleStyle: 'allcaps-spaced',
    decoration: 'sunburst-rays',
    showGrain: true,
    grainOpacity: 0.035,
  }),
  planned('reserve-4', {
    id: 'v2_vinyl_disc',
    name: 'Vinyl Disc',
    description: 'Record-disc title treatment with cover locked into the groove',
    engine: 'v2',
    kind: 'title',
    palette: V2_PALETTES.mmmcClassic,
    fonts: scriptFonts,
    layout: 'vinyl-disc',
    featuredSize: 0.42,
    featuredRadius: 999,
    featuredRotate: 0,
    showSwipePill: false,
    swipePillStyle: 'gold-pill',
    titleStyle: 'italic-script',
    subtitleStyle: 'allcaps-spaced',
    decoration: 'vinyl-disc',
    showVinyl: true,
    vinylOpacity: 0.24,
    showGrain: true,
    grainOpacity: 0.04,
  }),
  planned('reserve-4', {
    id: 'v2_tape_frame',
    name: 'Tape Frame',
    description: 'Archival tape-label frame for catalog-forward weeks',
    engine: 'v2',
    kind: 'title',
    palette: {
      bg: NMF_BRAND_TOKENS.color.inkPrimary,
      accent: NMF_BRAND_TOKENS.color.ivory,
      accent2: NMF_BRAND_TOKENS.color.rust,
      text: NMF_BRAND_TOKENS.color.ivory,
      textMuted: NMF_BRAND_TOKENS.color.warmGold,
    },
    fonts: serifFonts,
    layout: 'tape-frame',
    featuredSize: 0.48,
    featuredRadius: 1,
    featuredRotate: 0,
    showSwipePill: true,
    swipePillStyle: 'tape-label',
    titleStyle: 'serif-italic-display',
    subtitleStyle: 'mono-spaced',
    decoration: 'gold-frame',
    postProcess: 'sepia',
    showGrain: true,
    grainOpacity: 0.06,
  }),
  planned('reserve-4', {
    id: 'v2_honky_tonk_stamp',
    name: 'Honky Tonk Stamp',
    description: 'Stamped bar-poster title with modest cover tilt',
    engine: 'v2',
    kind: 'title',
    palette: V2_PALETTES.honkyTonk,
    fonts: serifFonts,
    layout: 'poster-stamped',
    featuredSize: 0.43,
    featuredRadius: 0,
    featuredRotate: 2,
    showSwipePill: true,
    swipePillStyle: 'ink-stamp',
    titleStyle: 'serif-italic-display',
    subtitleStyle: 'allcaps-spaced',
    decoration: 'halftone-banner',
    postProcess: 'halftone',
    showGrain: true,
    grainOpacity: 0.045,
  }),
  planned('reserve-4', {
    id: 'v2_mosaic_overture',
    name: 'Mosaic Overture',
    description: 'Multi-panel opening title for oversized release weeks',
    engine: 'v2',
    kind: 'title',
    palette: V2_PALETTES.neonCity,
    fonts: sansFonts,
    layout: 'mosaic-overture',
    featuredSize: 0.5,
    featuredRadius: 2,
    featuredRotate: 0,
    showSwipePill: true,
    swipePillStyle: 'neon-pill',
    titleStyle: 'neon-glow',
    subtitleStyle: 'mono-spaced',
    decoration: 'neon-grid',
    postProcess: 'scanlines',
  }),
];

export const PHASE4_TITLE_TEMPLATE_IDS = PHASE4_TITLE_TEMPLATE_SCAFFOLD.map(item => item.template.id);

export const PHASE4_LIVE_TITLE_TEMPLATE_PRESETS = PHASE4_TITLE_TEMPLATE_SCAFFOLD.map(item => item.template);
