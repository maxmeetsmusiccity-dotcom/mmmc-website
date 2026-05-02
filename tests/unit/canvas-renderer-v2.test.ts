import { describe, expect, it } from 'vitest';
import {
  V2_BODY_TEMPLATE_PRESETS,
  V2_TITLE_TEMPLATE_PRESETS,
  NMF_BRAND_TOKENS,
  V2_PALETTES,
} from '../../src/lib/brand-tokens';
import {
  defaultV2Grid,
  isV2Template,
  normalizeV2TemplateId,
  radians,
  v2GridFromLegacy,
} from '../../src/lib/canvas-renderer-v2';
import {
  getTitleTemplate,
  getV2TitleTemplatePreset,
  getVisibleTitleTemplates,
} from '../../src/lib/title-templates';
import {
  PHASE3_BODY_TEMPLATE_SCAFFOLD,
  PHASE3_LIVE_BODY_TEMPLATE_PRESETS,
  PHASE3_PRIMARY_BODY_TEMPLATE_IDS,
  PHASE3_RESERVE_BODY_TEMPLATE_IDS,
} from '../../src/lib/body-templates-v2-phase3';
import {
  getTemplate,
  getV2BodyTemplatePreset,
  getVisibleTemplates,
} from '../../src/lib/carousel-templates';
import {
  PHASE4_LIVE_TITLE_TEMPLATE_PRESETS,
  PHASE4_TITLE_TEMPLATE_IDS,
  PHASE4_TITLE_TEMPLATE_SCAFFOLD,
} from '../../src/lib/title-templates-v2-phase4';
import {
  PHASE5_CLOSING_TEMPLATE_PRESET,
  PHASE5_CLOSING_TEMPLATE_SCAFFOLD,
} from '../../src/lib/closing-template-v2-phase5';

describe('canvas renderer v2 phase 1 surface', () => {
  it('normalizes design zip dash IDs to production-safe underscore IDs', () => {
    expect(normalizeV2TemplateId('velvet-room')).toBe('velvet_room');
    expect(normalizeV2TemplateId('neon-glow-title')).toBe('neon_glow_title');
  });

  it('identifies only v2 engine templates as v2', () => {
    expect(isV2Template(V2_BODY_TEMPLATE_PRESETS[0])).toBe(true);
    expect(isV2Template({ engine: 'v1' })).toBe(false);
    expect(isV2Template({})).toBe(false);
  });

  it('creates square default grids with cover cells', () => {
    const grid = defaultV2Grid(3, 2);
    expect(grid.cols).toBe(3);
    expect(grid.rows).toBe(2);
    expect(grid.cells).toHaveLength(6);
    expect(grid.cells.every((cell) => cell.type === 'cover')).toBe(true);
  });

  it('maps legacy grid logo index to a v2 logo cell', () => {
    const grid = v2GridFromLegacy({
      id: '3x3_logo',
      columns: 3,
      rows: 3,
      logoIndex: 4,
      cells: defaultV2Grid(3, 3).cells,
    });
    expect(grid.cols).toBe(3);
    expect(grid.rows).toBe(3);
    expect(grid.cells[4].type).toBe('logo');
    expect(grid.cells.filter((cell) => cell.type === 'cover')).toHaveLength(8);
  });

  it('ports design renderer angle math without degree/radian drift', () => {
    expect(radians(0)).toBe(0);
    expect(radians(180)).toBeCloseTo(Math.PI, 8);
    expect(radians(-90)).toBeCloseTo(-Math.PI / 2, 8);
  });

  it('ships v2 body and title presets behind engine=v2', () => {
    expect(V2_BODY_TEMPLATE_PRESETS.length).toBeGreaterThanOrEqual(5);
    expect(V2_TITLE_TEMPLATE_PRESETS.length).toBeGreaterThanOrEqual(3);
    expect(V2_BODY_TEMPLATE_PRESETS.every((template) => template.engine === 'v2')).toBe(true);
    expect(V2_TITLE_TEMPLATE_PRESETS.every((template) => template.kind === 'title')).toBe(true);
  });

  it('keeps the v2 marquee title available as the non-Max default candidate', () => {
    const marquee = V2_TITLE_TEMPLATE_PRESETS.find((template) => template.id === 'v2_marquee');
    expect(marquee).toBeDefined();
    expect(marquee?.layout).toBe('marquee-frame');
    expect(marquee?.swipePillStyle).toBe('rose-tag');
  });

  it('exposes Marquee v2 through the title registry with engine dispatch metadata', () => {
    const marquee = getTitleTemplate('v2_marquee');
    expect(marquee.engine).toBe('v2');
    expect(marquee.v2PresetId).toBe('v2_marquee');
    expect(getV2TitleTemplatePreset(marquee)?.layout).toBe('marquee-frame');
  });

  it('keeps Marquee v2 visible while retaining the Max-only HeroSingle gate', () => {
    const nonMax = getVisibleTitleTemplates('maxblachman@gmail.com').map(t => t.id);
    expect(nonMax).toContain('v2_marquee');
    expect(nonMax).not.toContain('vinyl_classic');
    expect(getVisibleTitleTemplates('maxmeetsmusiccity@gmail.com').map(t => t.id)).toContain('vinyl_classic');
  });

  it('centralizes BB v2.1-adjacent brand colors for renderer presets', () => {
    expect(NMF_BRAND_TOKENS.color.inkPrimary).toBe('#0F1B33');
    expect(NMF_BRAND_TOKENS.color.accentTeal).toBe('#3EE6C3');
    expect(NMF_BRAND_TOKENS.color.accentGold).toBe('#F5C453');
    expect(V2_PALETTES.mmmcClassic.accent).toBe(NMF_BRAND_TOKENS.color.inkPrimary);
  });

  it('prepares the Phase 3 body-template slate without activating it in Phase 2', () => {
    expect(PHASE3_PRIMARY_BODY_TEMPLATE_IDS).toHaveLength(10);
    expect(PHASE3_RESERVE_BODY_TEMPLATE_IDS).toEqual(['v2_tape_archive']);
    expect(PHASE3_BODY_TEMPLATE_SCAFFOLD.filter(item => item.band === 'launch-4')).toHaveLength(4);
    expect(PHASE3_BODY_TEMPLATE_SCAFFOLD.filter(item => item.band === 'expansion-4')).toHaveLength(4);
    expect(PHASE3_BODY_TEMPLATE_SCAFFOLD.filter(item => item.band === 'reserve-3')).toHaveLength(3);
    expect(PHASE3_BODY_TEMPLATE_SCAFFOLD.every(item => item.template.engine === 'v2')).toBe(true);
    expect(PHASE3_BODY_TEMPLATE_SCAFFOLD.every(item => item.template.kind === 'body')).toBe(true);
  });

  it('ships the Phase 3 primary body templates through the carousel registry', () => {
    expect(PHASE3_LIVE_BODY_TEMPLATE_PRESETS).toHaveLength(10);
    expect(PHASE3_LIVE_BODY_TEMPLATE_PRESETS.map(template => template.id)).toEqual(PHASE3_PRIMARY_BODY_TEMPLATE_IDS);
    expect(getVisibleTemplates('curator@example.com').map(template => template.id)).toEqual(
      expect.arrayContaining(PHASE3_PRIMARY_BODY_TEMPLATE_IDS),
    );
    expect(getVisibleTemplates('curator@example.com').map(template => template.id)).not.toContain('v2_tape_archive');

    const ropeStage = getTemplate('v2_rope_stage');
    expect(ropeStage.engine).toBe('v2');
    expect(getV2BodyTemplatePreset(ropeStage)?.decoration).toBe('rope-frame');
  });

  it('ships the Phase 4 11-title-template slate through the title registry', () => {
    expect(PHASE4_TITLE_TEMPLATE_IDS).toHaveLength(11);
    expect(new Set(PHASE4_TITLE_TEMPLATE_IDS).size).toBe(11);
    expect(PHASE4_LIVE_TITLE_TEMPLATE_PRESETS).toHaveLength(11);
    expect(PHASE4_TITLE_TEMPLATE_SCAFFOLD.filter(item => item.band === 'launch-3')).toHaveLength(3);
    expect(PHASE4_TITLE_TEMPLATE_SCAFFOLD.filter(item => item.band === 'expansion-4')).toHaveLength(4);
    expect(PHASE4_TITLE_TEMPLATE_SCAFFOLD.filter(item => item.band === 'reserve-4')).toHaveLength(4);
    expect(PHASE4_TITLE_TEMPLATE_SCAFFOLD.every(item => item.template.engine === 'v2')).toBe(true);
    expect(PHASE4_TITLE_TEMPLATE_SCAFFOLD.every(item => item.template.kind === 'title')).toBe(true);
    expect(getVisibleTitleTemplates('curator@example.com').map(template => template.id)).toEqual(
      expect.arrayContaining(PHASE4_TITLE_TEMPLATE_IDS),
    );
    expect(getV2TitleTemplatePreset(getTitleTemplate('v2_sunburst_countdown'))?.layout).toBe('radial-burst');
  });

  it('ships the Phase 5 closing-template preset', () => {
    expect(PHASE5_CLOSING_TEMPLATE_SCAFFOLD.liveInPhase5).toBe(true);
    expect(PHASE5_CLOSING_TEMPLATE_SCAFFOLD.template.id).toBe('v2_closing_saved_stack');
    expect(PHASE5_CLOSING_TEMPLATE_PRESET.id).toBe('v2_closing_saved_stack');
    expect(PHASE5_CLOSING_TEMPLATE_SCAFFOLD.template.kind).toBe('title');
    expect(PHASE5_CLOSING_TEMPLATE_SCAFFOLD.requiredMoments).toEqual([
      'playlist-save',
      'curator-credit',
      'share-reminder',
      'next-friday-return',
    ]);
  });
});
