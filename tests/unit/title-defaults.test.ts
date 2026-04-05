import { describe, it, expect } from 'vitest';
import { getDefaultTitleTemplateId, getVisibleTitleTemplates, MAX_ONLY_TITLE_TEMPLATES } from '../../src/lib/title-templates';

describe('title template defaults', () => {
  it('returns vinyl_classic for maxmeetsmusiccity@gmail.com', () => {
    expect(getDefaultTitleTemplateId('maxmeetsmusiccity@gmail.com')).toBe('vinyl_classic');
  });
  it('returns vinyl_classic for maxblachman@gmail.com', () => {
    expect(getDefaultTitleTemplateId('maxblachman@gmail.com')).toBe('vinyl_classic');
  });
  it('returns nashville_neon for non-Max users', () => {
    expect(getDefaultTitleTemplateId('user@example.com')).toBe('nashville_neon');
  });
  it('returns nashville_neon for undefined email', () => {
    expect(getDefaultTitleTemplateId(undefined)).toBe('nashville_neon');
  });
  it('visible templates exclude Max-only for non-Max', () => {
    const visible = getVisibleTitleTemplates('user@example.com');
    for (const t of visible) {
      expect(MAX_ONLY_TITLE_TEMPLATES.has(t.id)).toBe(false);
    }
  });
  it('visible templates include all for Max', () => {
    const all = getVisibleTitleTemplates('maxmeetsmusiccity@gmail.com');
    const nonMax = getVisibleTitleTemplates('user@example.com');
    expect(all.length).toBeGreaterThan(nonMax.length);
  });
});
