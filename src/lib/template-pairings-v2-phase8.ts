import { PHASE7_CURATOR_BODY_TEMPLATE_IDS } from './body-templates-v2-phase7';
import { PHASE5_CLOSING_TEMPLATE_PRESET } from './closing-template-v2-phase5';
import { PHASE4_TITLE_TEMPLATE_IDS } from './title-templates-v2-phase4';

export type Phase8CuratorJourney =
  | 'discovery-stack'
  | 'playlist-pitch'
  | 'writer-credit'
  | 'weekly-recap';

export interface Phase8TemplatePairingScaffold {
  id: string;
  journey: Phase8CuratorJourney;
  titleTemplateId: string;
  bodyTemplateId: string;
  closingTemplateId: string;
  editorialCue: string;
  liveInPhase8: false;
  readyForPhase8Activation: true;
}

function pairing(
  journey: Phase8CuratorJourney,
  titleTemplateId: string,
  bodyTemplateId: string,
  editorialCue: string,
): Phase8TemplatePairingScaffold {
  return {
    id: `phase8_${journey}`,
    journey,
    titleTemplateId,
    bodyTemplateId,
    closingTemplateId: PHASE5_CLOSING_TEMPLATE_PRESET.id,
    editorialCue,
    liveInPhase8: false,
    readyForPhase8Activation: true,
  };
}

export const PHASE8_TEMPLATE_PAIRING_SCAFFOLD: Phase8TemplatePairingScaffold[] = [
  pairing(
    'discovery-stack',
    'v2_script_spotlight',
    'v2_curator_spotlight',
    'Lead with the curator reason to listen before the release grid.',
  ),
  pairing(
    'playlist-pitch',
    'v2_stadium_poster',
    'v2_pitch_room',
    'Frame the carousel as a playlist-placement pitch with a clear save cue.',
  ),
  pairing(
    'writer-credit',
    'v2_rope_overture',
    'v2_writer_board',
    'Give songwriter credit visible space before the closing save reminder.',
  ),
  pairing(
    'weekly-recap',
    'v2_sunburst_countdown',
    'v2_recap_wall',
    'Use the recap wall for dense weeks and keep the opening title count-forward.',
  ),
];

export const PHASE8_TEMPLATE_PAIRING_IDS = PHASE8_TEMPLATE_PAIRING_SCAFFOLD
  .map(item => item.id);

export const PHASE8_TEMPLATE_PAIRING_BODY_IDS = PHASE8_TEMPLATE_PAIRING_SCAFFOLD
  .map(item => item.bodyTemplateId);

export const PHASE8_TEMPLATE_PAIRING_TITLE_IDS = PHASE8_TEMPLATE_PAIRING_SCAFFOLD
  .map(item => item.titleTemplateId);

export function isPhase8PairingResolvable(pairingItem: Phase8TemplatePairingScaffold): boolean {
  return PHASE7_CURATOR_BODY_TEMPLATE_IDS.includes(pairingItem.bodyTemplateId)
    && PHASE4_TITLE_TEMPLATE_IDS.includes(pairingItem.titleTemplateId)
    && pairingItem.closingTemplateId === PHASE5_CLOSING_TEMPLATE_PRESET.id;
}
