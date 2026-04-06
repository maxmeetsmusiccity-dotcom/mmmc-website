import { describe, it, expect } from 'vitest';
import { SOURCES, getSource } from '../../src/lib/sources/types';

describe('music sources', () => {
  it('has 4 sources', () => {
    expect(SOURCES).toHaveLength(4);
  });

  it('nashville is first source (zero-login default)', () => {
    expect(SOURCES[0].id).toBe('nashville');
    expect(SOURCES[0].requiresAuth).toBe(false);
  });

  it('all sources have required fields', () => {
    for (const s of SOURCES) {
      expect(s.id).toBeTruthy();
      expect(s.name).toBeTruthy();
      expect(s.icon).toBeTruthy();
      expect(s.description).toBeTruthy();
      expect(typeof s.requiresAuth).toBe('boolean');
    }
  });

  it('getSource returns correct source by id', () => {
    expect(getSource('spotify').name).toBe('Spotify');
    expect(getSource('nashville').name).toBe('Nashville');
    expect(getSource('manual').name).toBe('Artist List');
  });

  it('getSource returns first source for unknown id', () => {
    expect(getSource('unknown').id).toBe('nashville');
  });
});
