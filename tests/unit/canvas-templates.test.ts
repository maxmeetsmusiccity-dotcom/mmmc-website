import { describe, it, expect, beforeEach } from 'vitest';
import {
  TEMPLATES,
  MAX_ONLY_TEMPLATES,
  getTemplate,
  getVisibleTemplates,
  registerCustomTemplates,
  type CarouselTemplate,
} from '../../src/lib/carousel-templates';
import {
  TITLE_TEMPLATES,
  MAX_ONLY_TITLE_TEMPLATES,
  getTitleTemplate,
  getVisibleTitleTemplates,
  getDefaultTitleTemplateId,
} from '../../src/lib/title-templates';

// ---------- Carousel Template Tests ----------

describe('TEMPLATES array (carousel)', () => {
  it('has at least 5 built-in templates', () => {
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(5);
  });

  it.each(TEMPLATES)('template "$id" has all required fields', (t) => {
    expect(typeof t.id).toBe('string');
    expect(t.id.length).toBeGreaterThan(0);
    expect(typeof t.name).toBe('string');
    expect(typeof t.description).toBe('string');
    expect(typeof t.background).toBe('string');
    expect(typeof t.accent).toBe('string');
    expect(typeof t.textPrimary).toBe('string');
    expect(typeof t.textSecondary).toBe('string');
    expect(typeof t.scriptFont).toBe('string');
    expect(typeof t.bodyFont).toBe('string');
    expect(t.neon).toBeDefined();
    expect(t.grid).toBeDefined();
    expect(t.cover).toBeDefined();
    expect(t.decorations).toBeDefined();
  });

  it('template IDs are unique', () => {
    const ids = TEMPLATES.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('each template grid.rotations has 8 values', () => {
    for (const t of TEMPLATES) {
      expect(t.grid.rotations).toHaveLength(8);
    }
  });

  it('background colors are valid hex strings', () => {
    for (const t of TEMPLATES) {
      expect(t.background).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});

describe('getTemplate', () => {
  it('returns the correct template by ID', () => {
    const t = getTemplate('mmmc_classic');
    expect(t.id).toBe('mmmc_classic');
    expect(t.name).toBe('MMMC Classic');
  });

  it('returns a different template for a different ID', () => {
    const t = getTemplate('midnight_minimal');
    expect(t.id).toBe('midnight_minimal');
  });

  it('returns the first template (fallback) for an unknown ID', () => {
    const t = getTemplate('nonexistent_id_xyz');
    expect(t.id).toBe(TEMPLATES[0].id);
  });

  it('falls back gracefully for empty string', () => {
    const t = getTemplate('');
    expect(t.id).toBe(TEMPLATES[0].id);
  });

  it('finds custom-registered templates', () => {
    const custom: CarouselTemplate = {
      ...TEMPLATES[0],
      id: 'custom_test_001',
      name: 'Custom Test',
    };
    registerCustomTemplates([custom]);
    const t = getTemplate('custom_test_001');
    expect(t.id).toBe('custom_test_001');
    expect(t.name).toBe('Custom Test');
    // Clean up
    registerCustomTemplates([]);
  });
});

describe('getVisibleTemplates', () => {
  it('returns all templates for Max (maxmeetsmusiccity@gmail.com)', () => {
    const visible = getVisibleTemplates('maxmeetsmusiccity@gmail.com');
    expect(visible).toHaveLength(TEMPLATES.length);
  });

  it('returns all templates for Max (maxblachman@gmail.com)', () => {
    const visible = getVisibleTemplates('maxblachman@gmail.com');
    expect(visible).toHaveLength(TEMPLATES.length);
  });

  it('filters out Max-only templates for other users', () => {
    const visible = getVisibleTemplates('someone@example.com');
    const visibleIds = new Set(visible.map(t => t.id));
    for (const maxOnly of MAX_ONLY_TEMPLATES) {
      expect(visibleIds.has(maxOnly)).toBe(false);
    }
  });

  it('filters Max-only templates when userEmail is undefined', () => {
    const visible = getVisibleTemplates(undefined);
    expect(visible.length).toBe(TEMPLATES.length - MAX_ONLY_TEMPLATES.size);
  });

  it('non-Max users still get multiple templates', () => {
    const visible = getVisibleTemplates('other@gmail.com');
    expect(visible.length).toBeGreaterThanOrEqual(3);
  });
});

describe('MAX_ONLY_TEMPLATES', () => {
  it('contains known Max-exclusive template IDs', () => {
    expect(MAX_ONLY_TEMPLATES.has('mmmc_classic')).toBe(true);
    expect(MAX_ONLY_TEMPLATES.has('neon_rose')).toBe(true);
    expect(MAX_ONLY_TEMPLATES.has('golden_hour')).toBe(true);
  });

  it('does not include non-exclusive templates', () => {
    expect(MAX_ONLY_TEMPLATES.has('midnight_minimal')).toBe(false);
    expect(MAX_ONLY_TEMPLATES.has('concrete_jungle')).toBe(false);
  });
});

// ---------- Title Template Tests ----------

describe('TITLE_TEMPLATES array', () => {
  it('has at least 8 built-in title templates', () => {
    expect(TITLE_TEMPLATES.length).toBeGreaterThanOrEqual(8);
  });

  it.each(TITLE_TEMPLATES)('title template "$id" has all required fields', (t) => {
    expect(typeof t.id).toBe('string');
    expect(t.id.length).toBeGreaterThan(0);
    expect(typeof t.name).toBe('string');
    expect(typeof t.description).toBe('string');
    expect(typeof t.background).toBe('string');
    expect(typeof t.textPrimary).toBe('string');
    expect(typeof t.accent).toBe('string');
    expect(typeof t.headlineFont).toBe('string');
    expect(typeof t.headlineWeight).toBe('number');
    expect(t.glow).toBeDefined();
    expect(typeof t.grain).toBe('number');
    expect(typeof t.vignette).toBe('number');
    expect(typeof t.swipePill).toBe('boolean');
  });

  it('title template IDs are unique', () => {
    const ids = TITLE_TEMPLATES.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('headlineSize and subtitleSize are sensible fractions', () => {
    for (const t of TITLE_TEMPLATES) {
      expect(t.headlineSize).toBeGreaterThan(0);
      expect(t.headlineSize).toBeLessThan(1);
      expect(t.subtitleSize).toBeGreaterThan(0);
      expect(t.subtitleSize).toBeLessThan(1);
    }
  });
});

describe('getTitleTemplate', () => {
  it('returns correct template by ID', () => {
    const t = getTitleTemplate('nashville_neon');
    expect(t.id).toBe('nashville_neon');
  });

  it('returns fallback (first) for unknown ID', () => {
    const t = getTitleTemplate('does_not_exist');
    expect(t.id).toBe(TITLE_TEMPLATES[0].id);
  });

  it('returns fallback for empty string', () => {
    const t = getTitleTemplate('');
    expect(t.id).toBe(TITLE_TEMPLATES[0].id);
  });

  it('finds the vinyl_classic template', () => {
    const t = getTitleTemplate('vinyl_classic');
    expect(t.id).toBe('vinyl_classic');
    expect(t.vinylRecord).toBe(true);
  });

  it('returns a template with glow properties', () => {
    const t = getTitleTemplate('nashville_neon');
    expect(t.glow.blur).toBeGreaterThan(0);
    expect(t.glow.passes).toBeGreaterThan(0);
  });
});

describe('getVisibleTitleTemplates', () => {
  it('returns all title templates for Max', () => {
    const visible = getVisibleTitleTemplates('maxmeetsmusiccity@gmail.com');
    expect(visible).toHaveLength(TITLE_TEMPLATES.length);
  });

  it('filters Max-only title templates for other users', () => {
    const visible = getVisibleTitleTemplates('other@example.com');
    const visibleIds = new Set(visible.map(t => t.id));
    for (const maxOnly of MAX_ONLY_TITLE_TEMPLATES) {
      expect(visibleIds.has(maxOnly)).toBe(false);
    }
  });

  it('Max-only templates appear first for Max', () => {
    const visible = getVisibleTitleTemplates('maxblachman@gmail.com');
    const firstFew = visible.slice(0, MAX_ONLY_TITLE_TEMPLATES.size);
    for (const t of firstFew) {
      expect(MAX_ONLY_TITLE_TEMPLATES.has(t.id)).toBe(true);
    }
  });

  it('non-Max users get at least 5 templates', () => {
    const visible = getVisibleTitleTemplates(undefined);
    expect(visible.length).toBeGreaterThanOrEqual(5);
  });

  it('filters when email is undefined', () => {
    const visible = getVisibleTitleTemplates(undefined);
    expect(visible.length).toBe(TITLE_TEMPLATES.length - MAX_ONLY_TITLE_TEMPLATES.size);
  });
});

describe('getDefaultTitleTemplateId', () => {
  it('returns vinyl_classic for Max', () => {
    expect(getDefaultTitleTemplateId('maxmeetsmusiccity@gmail.com')).toBe('vinyl_classic');
    expect(getDefaultTitleTemplateId('maxblachman@gmail.com')).toBe('vinyl_classic');
  });

  it('returns a non-Max-only template for other users', () => {
    const id = getDefaultTitleTemplateId('someone@example.com');
    expect(MAX_ONLY_TITLE_TEMPLATES.has(id)).toBe(false);
  });

  it('returns a valid template ID for undefined email', () => {
    const id = getDefaultTitleTemplateId(undefined);
    const found = TITLE_TEMPLATES.find(t => t.id === id);
    expect(found).toBeDefined();
  });
});
