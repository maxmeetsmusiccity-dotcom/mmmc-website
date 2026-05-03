import { PHASE6_LIVE_BODY_TEMPLATE_PRESETS } from './body-templates-v2-phase6';
import { NMF_BRAND_TOKENS, V2_PALETTES } from './brand-tokens';
import type { V2CarouselBodyTemplate } from './template-types-v2';

export type Phase7CuratorTemplateMoment =
  | 'artist-discovery'
  | 'playlist-pitch'
  | 'songwriter-credit'
  | 'weekly-recap';

export interface Phase7CuratorBodyTemplateScaffold {
  moment: Phase7CuratorTemplateMoment;
  template: V2CarouselBodyTemplate;
  curatorEnrichment: 'phase-7';
  recommendedTrackCounts: readonly number[];
  liveInPhase7: true;
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

const curatorSpotlight: V2CarouselBodyTemplate = {
  id: 'v2_curator_spotlight',
  name: 'Curator Spotlight',
  description: 'Feature-forward wall for curator notes and first-listen picks',
  engine: 'v2',
  kind: 'body',
  palette: {
    bg: NMF_BRAND_TOKENS.color.inkPrimary,
    accent: NMF_BRAND_TOKENS.color.accentTeal,
    accent2: NMF_BRAND_TOKENS.color.accentGold,
    text: NMF_BRAND_TOKENS.color.paper,
    textMuted: NMF_BRAND_TOKENS.color.ivory,
  },
  fonts: sansFonts,
  cellPadding: 12,
  cellRadius: 4,
  cellRotate: [-0.7, 0.4, -0.2, 0.6, -0.4, 0.2, -0.6, 0.5, 0],
  decoration: 'spotlight',
  showGrain: true,
  grainOpacity: 0.035,
  postProcess: 'spotlight',
};

const pitchRoom: V2CarouselBodyTemplate = {
  id: 'v2_pitch_room',
  name: 'Pitch Room',
  description: 'Label-pitch grid with clean hierarchy for playlist placements',
  engine: 'v2',
  kind: 'body',
  palette: V2_PALETTES.mmmcClassic,
  fonts: serifFonts,
  cellPadding: 15,
  cellRadius: 3,
  cellRotate: [-0.4, 0.3, -0.2, 0.4, -0.3, 0.2, -0.5, 0.4, -0.1],
  decoration: 'gold-frame',
  showGrain: true,
  grainOpacity: 0.03,
};

const writerBoard: V2CarouselBodyTemplate = {
  id: 'v2_writer_board',
  name: 'Writer Board',
  description: 'Songwriter-credit proof sheet with editorial ivory spacing',
  engine: 'v2',
  kind: 'body',
  palette: V2_PALETTES.pearlSnap,
  fonts: scriptFonts,
  cellPadding: 14,
  cellRadius: 2,
  cellRotate: [-0.5, 0.5, -0.3, 0.3, -0.2, 0.2, -0.4, 0.4, 0],
  decoration: 'script-flourish',
  showGrain: true,
  grainOpacity: 0.025,
};

const recapWall: V2CarouselBodyTemplate = {
  id: 'v2_recap_wall',
  name: 'Recap Wall',
  description: 'Dense week-in-review grid for larger Friday release slates',
  engine: 'v2',
  kind: 'body',
  palette: V2_PALETTES.honkyTonk,
  fonts: serifFonts,
  cellPadding: 9,
  cellRadius: 1,
  cellRotate: [-1.2, 0.9, -0.7, 1, -0.8, 0.6, -1, 0.8, -0.5],
  decoration: 'halftone-banner',
  showGrain: true,
  grainOpacity: 0.05,
  postProcess: 'halftone',
};

function curator(
  moment: Phase7CuratorTemplateMoment,
  template: V2CarouselBodyTemplate,
  recommendedTrackCounts: readonly number[],
): Phase7CuratorBodyTemplateScaffold {
  return {
    moment,
    template,
    curatorEnrichment: 'phase-7',
    recommendedTrackCounts,
    liveInPhase7: true,
  };
}

export const PHASE7_CURATOR_BODY_TEMPLATE_SCAFFOLD: Phase7CuratorBodyTemplateScaffold[] = [
  curator('artist-discovery', curatorSpotlight, [4, 6, 8]),
  curator('playlist-pitch', pitchRoom, [6, 9]),
  curator('songwriter-credit', writerBoard, [4, 6]),
  curator('weekly-recap', recapWall, [9, 12]),
];

export const PHASE7_CURATOR_BODY_TEMPLATE_IDS = PHASE7_CURATOR_BODY_TEMPLATE_SCAFFOLD
  .map(item => item.template.id);

export const PHASE7_CURATOR_BODY_TEMPLATE_PRESETS = PHASE7_CURATOR_BODY_TEMPLATE_SCAFFOLD
  .map(item => item.template);

export const PHASE7_LIVE_BODY_TEMPLATE_PRESETS: V2CarouselBodyTemplate[] = [
  ...PHASE6_LIVE_BODY_TEMPLATE_PRESETS,
  ...PHASE7_CURATOR_BODY_TEMPLATE_PRESETS,
];
