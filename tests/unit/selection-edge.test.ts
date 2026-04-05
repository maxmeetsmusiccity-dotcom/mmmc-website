import { describe, it, expect } from 'vitest';
import { buildSlots, getSlideGroup, getPositionInSlide, shuffleSlideGroup } from '../../src/lib/selection';

describe('selection edge cases', () => {
  const mockSlot = (n: number) => ({
    track: { track_id: `t${n}`, track_name: `Track ${n}`, artist_names: `Artist ${n}` } as never,
    albumId: `a${n}`,
    selectionNumber: n,
    slideGroup: getSlideGroup(n),
    positionInSlide: getPositionInSlide(n),
    isCoverFeature: false,
  });

  it('buildSlots with empty array returns empty', () => {
    expect(buildSlots([])).toEqual([]);
  });

  it('buildSlots renumbers sequentially', () => {
    const slots = [mockSlot(5), mockSlot(3), mockSlot(1)];
    const result = buildSlots(slots);
    expect(result[0].selectionNumber).toBe(1);
    expect(result[1].selectionNumber).toBe(2);
    expect(result[2].selectionNumber).toBe(3);
  });

  it('getSlideGroup wraps at 8', () => {
    expect(getSlideGroup(1)).toBe(1);
    expect(getSlideGroup(8)).toBe(1);
    expect(getSlideGroup(9)).toBe(2);
    expect(getSlideGroup(16)).toBe(2);
    expect(getSlideGroup(17)).toBe(3);
  });

  it('getPositionInSlide cycles 1-8', () => {
    expect(getPositionInSlide(1)).toBe(1);
    expect(getPositionInSlide(8)).toBe(8);
    expect(getPositionInSlide(9)).toBe(1);
  });

  it('shuffleSlideGroup preserves length', () => {
    const slots = Array.from({ length: 16 }, (_, i) => mockSlot(i + 1));
    const built = buildSlots(slots);
    const shuffled = shuffleSlideGroup(built, 1);
    expect(shuffled.length).toBe(16);
  });

  it('buildSlots with 50 selections assigns correct groups', () => {
    const slots = Array.from({ length: 50 }, (_, i) => mockSlot(i + 1));
    const result = buildSlots(slots);
    expect(result[49].slideGroup).toBe(7); // 50th track in group 7
  });
});
