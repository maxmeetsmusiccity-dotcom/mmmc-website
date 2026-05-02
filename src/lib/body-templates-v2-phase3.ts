import { NMF_BRAND_TOKENS, V2_BODY_TEMPLATE_PRESETS, V2_PALETTES } from './brand-tokens';
import type { V2CarouselBodyTemplate } from './template-types-v2';

export type Phase3BodyTemplateBand = 'launch-4' | 'expansion-4' | 'reserve-3';

export interface Phase3BodyTemplateScaffold {
  band: Phase3BodyTemplateBand;
  template: V2CarouselBodyTemplate;
  activeInPhase2: boolean;
  primaryPhase3: boolean;
}

const activePresetById = new Map(V2_BODY_TEMPLATE_PRESETS.map(template => [template.id, template]));

function active(id: string, band: Phase3BodyTemplateBand, primaryPhase3 = true): Phase3BodyTemplateScaffold {
  const template = activePresetById.get(id);
  if (!template) throw new Error(`Missing active v2 body preset for Phase 3 scaffold: ${id}`);
  return { band, template, activeInPhase2: true, primaryPhase3 };
}

const ropeStage: V2CarouselBodyTemplate = {
  id: 'v2_rope_stage',
  name: 'Rope Stage',
  description: 'Deep stage backdrop with rope trim and lightly tilted covers',
  engine: 'v2',
  kind: 'body',
  palette: {
    bg: NMF_BRAND_TOKENS.color.inkPrimary,
    accent: NMF_BRAND_TOKENS.color.accentGold,
    accent2: NMF_BRAND_TOKENS.color.rust,
    text: NMF_BRAND_TOKENS.color.ivory,
    textMuted: NMF_BRAND_TOKENS.color.accentTeal,
  },
  fonts: {
    display: 'Playfair Display',
    body: 'Source Serif 4',
    mono: 'JetBrains Mono',
  },
  cellPadding: 14,
  cellRadius: 6,
  cellShadow: V2_BODY_TEMPLATE_PRESETS[1].cellShadow,
  cellRotate: [-1.2, 0.8, -0.7, 1.1, -0.9, 0.6, -1.4, 1, -0.5],
  decoration: 'rope-frame',
  showGrain: true,
  grainOpacity: 0.045,
};

const scriptWriter: V2CarouselBodyTemplate = {
  id: 'v2_script_writer',
  name: 'Script Writer',
  description: 'Ivory songwriter notebook with script flourish and editorial spacing',
  engine: 'v2',
  kind: 'body',
  palette: {
    bg: NMF_BRAND_TOKENS.color.ivory,
    accent: NMF_BRAND_TOKENS.color.inkPrimary,
    accent2: NMF_BRAND_TOKENS.color.turquoise,
    text: NMF_BRAND_TOKENS.color.inkPrimary,
    textMuted: NMF_BRAND_TOKENS.color.turquoise,
  },
  fonts: {
    display: 'Playfair Display',
    body: 'Source Serif 4',
    mono: 'JetBrains Mono',
    script: 'Dancing Script',
  },
  cellPadding: 16,
  cellRadius: 3,
  cellShadow: V2_BODY_TEMPLATE_PRESETS[0].cellShadow,
  cellRotate: [-0.6, 0.4, -0.3, 0.7, -0.5, 0.3, -0.8, 0.5, -0.2],
  decoration: 'script-flourish',
  showGrain: true,
  grainOpacity: 0.025,
};

const vinylAfterparty: V2CarouselBodyTemplate = {
  id: 'v2_vinyl_afterparty',
  name: 'Vinyl Afterparty',
  description: 'Midnight vinyl peek with warm club contrast',
  engine: 'v2',
  kind: 'body',
  palette: V2_PALETTES.stadiumLights,
  fonts: {
    display: 'DM Sans',
    body: 'DM Sans',
    mono: 'JetBrains Mono',
  },
  cellPadding: 12,
  cellRadius: 8,
  cellShadow: V2_BODY_TEMPLATE_PRESETS[4].cellShadow,
  cellRotate: [0.4, -0.4, 0.6, -0.6, 0.3, -0.3, 0.5, -0.5, 0],
  decoration: 'vinyl-disc',
  showVinyl: true,
  vinylOpacity: 0.22,
  showGrain: true,
  grainOpacity: 0.04,
};

const sunburstRodeo: V2CarouselBodyTemplate = {
  id: 'v2_sunburst_rodeo',
  name: 'Sunburst Rodeo',
  description: 'High-energy radial burst for bigger release weeks',
  engine: 'v2',
  kind: 'body',
  palette: {
    bg: NMF_BRAND_TOKENS.color.inkPrimary,
    accent: NMF_BRAND_TOKENS.color.accentGold,
    accent2: NMF_BRAND_TOKENS.color.rose,
    text: NMF_BRAND_TOKENS.color.ivory,
    textMuted: NMF_BRAND_TOKENS.color.warmGold,
  },
  fonts: {
    display: 'DM Sans',
    body: 'DM Sans',
    mono: 'JetBrains Mono',
  },
  cellPadding: 10,
  cellRadius: 4,
  cellShadow: V2_BODY_TEMPLATE_PRESETS[4].cellShadow,
  cellRotate: [-1, 1, -1, 1, -0.5, 0.5, -1.5, 1.5, 0],
  decoration: 'sunburst-rays',
  showGrain: true,
  grainOpacity: 0.035,
};

const tapeArchive: V2CarouselBodyTemplate = {
  id: 'v2_tape_archive',
  name: 'Tape Archive',
  description: 'Sepia studio proof sheet with compact tape-label energy',
  engine: 'v2',
  kind: 'body',
  palette: {
    bg: NMF_BRAND_TOKENS.color.inkPrimary,
    accent: NMF_BRAND_TOKENS.color.ivory,
    accent2: NMF_BRAND_TOKENS.color.warmGold,
    text: NMF_BRAND_TOKENS.color.ivory,
    textMuted: NMF_BRAND_TOKENS.color.warmGold,
  },
  fonts: {
    display: 'Source Serif 4',
    body: 'Source Serif 4',
    mono: 'JetBrains Mono',
  },
  cellPadding: 10,
  cellRadius: 1,
  cellShadow: V2_BODY_TEMPLATE_PRESETS[3].cellShadow,
  cellRotate: [-0.4, 0.4, -0.6, 0.6, -0.2, 0.2, -0.5, 0.5, 0],
  decoration: 'gold-frame',
  postProcess: 'sepia',
  showGrain: true,
  grainOpacity: 0.06,
};

function planned(
  band: Phase3BodyTemplateBand,
  template: V2CarouselBodyTemplate,
  primaryPhase3 = true,
): Phase3BodyTemplateScaffold {
  return { band, template, activeInPhase2: false, primaryPhase3 };
}

export const PHASE3_BODY_TEMPLATE_SCAFFOLD: Phase3BodyTemplateScaffold[] = [
  active('v2_mmmc_classic', 'launch-4'),
  active('v2_velvet_room', 'launch-4'),
  active('v2_neon_city', 'launch-4'),
  active('v2_honky_tonk', 'launch-4'),
  active('v2_stadium_lights', 'expansion-4'),
  active('v2_pearl_snap', 'expansion-4'),
  planned('expansion-4', ropeStage),
  planned('expansion-4', scriptWriter),
  planned('reserve-3', vinylAfterparty),
  planned('reserve-3', sunburstRodeo),
  planned('reserve-3', tapeArchive, false),
];

export const PHASE3_PRIMARY_BODY_TEMPLATE_IDS = PHASE3_BODY_TEMPLATE_SCAFFOLD
  .filter(item => item.primaryPhase3)
  .map(item => item.template.id);

export const PHASE3_LIVE_BODY_TEMPLATE_PRESETS = PHASE3_BODY_TEMPLATE_SCAFFOLD
  .filter(item => item.primaryPhase3)
  .map(item => item.template);

export const PHASE3_RESERVE_BODY_TEMPLATE_IDS = PHASE3_BODY_TEMPLATE_SCAFFOLD
  .filter(item => !item.primaryPhase3)
  .map(item => item.template.id);
