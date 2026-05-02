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

  it('centralizes BB v2.1-adjacent brand colors for renderer presets', () => {
    expect(NMF_BRAND_TOKENS.color.inkPrimary).toBe('#0F1B33');
    expect(NMF_BRAND_TOKENS.color.accentTeal).toBe('#3EE6C3');
    expect(NMF_BRAND_TOKENS.color.accentGold).toBe('#F5C453');
    expect(V2_PALETTES.mmmcClassic.accent).toBe(NMF_BRAND_TOKENS.color.inkPrimary);
  });
});
