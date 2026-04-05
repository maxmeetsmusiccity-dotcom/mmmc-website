import { describe, it, expect } from 'vitest';
import { getPlatform, PLATFORMS } from '../../src/lib/platforms';

describe('platforms', () => {
  it('has at least 8 social platforms', () => {
    expect(PLATFORMS.filter(p => p.category === 'social').length).toBeGreaterThanOrEqual(8);
  });
  it('has ratio presets', () => {
    expect(PLATFORMS.filter(p => p.category === 'ratio').length).toBeGreaterThan(0);
  });
  it('getPlatform returns ig-post by default', () => {
    expect(getPlatform('ig-post').id).toBe('ig-post');
  });
  it('getPlatform falls back for unknown id', () => {
    const p = getPlatform('nonexistent');
    expect(p.id).toBe('ig-post');
  });
  it('instagram post is 1080x1080', () => {
    const p = getPlatform('ig-post');
    expect(p.width).toBe(1080);
    expect(p.height).toBe(1080);
  });
  it('tiktok is 1080x1920', () => {
    const p = getPlatform('tiktok');
    expect(p.width).toBe(1080);
    expect(p.height).toBe(1920);
  });
});
