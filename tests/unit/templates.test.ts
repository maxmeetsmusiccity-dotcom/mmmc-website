import { describe, it, expect } from 'vitest';
import { TEMPLATES, getVisibleTemplates, MAX_ONLY_TEMPLATES, getTemplate } from '../../src/lib/carousel-templates';
import { TITLE_TEMPLATES, getTitleTemplate } from '../../src/lib/title-templates';

describe('carousel templates', () => {
  it('has at least 6 templates', () => {
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(6);
  });

  it('all templates have required fields', () => {
    for (const t of TEMPLATES) {
      expect(t.id).toBeTruthy();
      expect(t.name).toBeTruthy();
      expect(t.background).toBeTruthy();
      expect(t.scriptFont).toBeTruthy();
      expect(t.bodyFont).toBeTruthy();
    }
  });

  it('getTemplate returns fallback for unknown id', () => {
    const t = getTemplate('nonexistent_template_xyz');
    expect(t.id).toBe(TEMPLATES[0].id);
  });

  it('MAX_ONLY_TEMPLATES is a Set', () => {
    expect(MAX_ONLY_TEMPLATES).toBeInstanceOf(Set);
    expect(MAX_ONLY_TEMPLATES.size).toBeGreaterThan(0);
  });

  it('getVisibleTemplates hides Max-only templates for non-admin', () => {
    const visible = getVisibleTemplates('random@example.com');
    for (const t of visible) {
      expect(MAX_ONLY_TEMPLATES.has(t.id)).toBe(false);
    }
  });

  it('getVisibleTemplates shows all templates for Max', () => {
    const visible = getVisibleTemplates('maxmeetsmusiccity@gmail.com');
    expect(visible.length).toBe(TEMPLATES.length);
  });

  it('getVisibleTemplates shows all for maxblachman', () => {
    const visible = getVisibleTemplates('maxblachman@gmail.com');
    expect(visible.length).toBe(TEMPLATES.length);
  });
});

describe('title templates', () => {
  it('has exactly 10 title templates', () => {
    expect(TITLE_TEMPLATES.length).toBe(10);
  });

  it('all title templates have required fields', () => {
    for (const t of TITLE_TEMPLATES) {
      expect(t.id).toBeTruthy();
      expect(t.name).toBeTruthy();
      expect(t.background).toBeTruthy();
      expect(t.headlineFont).toBeTruthy();
      expect(t.subtitleFont).toBeTruthy();
      expect(t.dateFont).toBeTruthy();
      expect(typeof t.headlineWeight).toBe('number');
      expect(typeof t.headlineSize).toBe('number');
      expect(typeof t.grain).toBe('number');
      expect(typeof t.vignette).toBe('number');
    }
  });

  it('Nashville Neon and Dust & Gold are visually distinct', () => {
    const neon = getTitleTemplate('nashville_neon');
    const dust = getTitleTemplate('dust_gold');
    // Different backgrounds (one dark, one light)
    expect(neon.background).not.toBe(dust.background);
    // Different text colors
    expect(neon.textPrimary).not.toBe(dust.textPrimary);
    // Neon has glow, Dust & Gold does not
    expect(neon.glow.passes).toBeGreaterThan(0);
    expect(dust.glow.passes).toBe(0);
  });

  it('getTitleTemplate returns fallback for unknown id', () => {
    const t = getTitleTemplate('nonexistent_xyz');
    expect(t.id).toBe(TITLE_TEMPLATES[0].id);
  });
});
