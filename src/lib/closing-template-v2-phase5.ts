import { NMF_BRAND_TOKENS, V2_PALETTES } from './brand-tokens';
import type { V2TitleSlideTemplate } from './template-types-v2';

export interface Phase5ClosingTemplateScaffold {
  template: V2TitleSlideTemplate;
  requiredMoments: string[];
  liveInPhase5: boolean;
}

export const PHASE5_CLOSING_TEMPLATE_SCAFFOLD: Phase5ClosingTemplateScaffold = {
  template: {
    id: 'v2_closing_saved_stack',
    name: 'Saved Stack Closing',
    description: 'Closing slide for playlist save, share, and curator-credit CTA',
    engine: 'v2',
    kind: 'title',
    palette: V2_PALETTES.mmmcClassic,
    fonts: {
      display: NMF_BRAND_TOKENS.font.display,
      body: NMF_BRAND_TOKENS.font.body,
      mono: NMF_BRAND_TOKENS.font.mono,
      script: NMF_BRAND_TOKENS.font.script,
    },
    layout: 'edition-number',
    featuredSize: 0.38,
    featuredRadius: 8,
    featuredRotate: -2,
    showSwipePill: true,
    swipePillStyle: 'gold-pill',
    titleStyle: 'mixed-script',
    subtitleStyle: 'allcaps-spaced',
    decoration: 'gold-frame',
    showGrain: true,
    grainOpacity: 0.035,
  },
  requiredMoments: [
    'playlist-save',
    'curator-credit',
    'share-reminder',
    'next-friday-return',
  ],
  liveInPhase5: true,
};

export const PHASE5_CLOSING_TEMPLATE_PRESET = PHASE5_CLOSING_TEMPLATE_SCAFFOLD.template;
