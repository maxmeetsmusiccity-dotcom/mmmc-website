import { describe, it, expect } from 'vitest';
import { getDefaultTitleTemplateId, getVisibleTitleTemplates, MAX_ONLY_TITLE_TEMPLATES } from '../../src/lib/title-templates';

describe('title template defaults', () => {
  it('returns vinyl_classic for maxmeetsmusiccity@gmail.com', () => {
    expect(getDefaultTitleTemplateId('maxmeetsmusiccity@gmail.com')).toBe('vinyl_classic');
  });
  it('treats maxblachman@gmail.com as non-Max', () => {
    expect(MAX_ONLY_TITLE_TEMPLATES.has(getDefaultTitleTemplateId('maxblachman@gmail.com'))).toBe(false);
  });
  it('returns first visible (non-Max-only) template for non-Max users', () => {
    const defaultId = getDefaultTitleTemplateId('user@example.com');
    expect(MAX_ONLY_TITLE_TEMPLATES.has(defaultId)).toBe(false);
  });
  it('returns first visible (non-Max-only) template for undefined email', () => {
    const defaultId = getDefaultTitleTemplateId(undefined);
    expect(MAX_ONLY_TITLE_TEMPLATES.has(defaultId)).toBe(false);
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
