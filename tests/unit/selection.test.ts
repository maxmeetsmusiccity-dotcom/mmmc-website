import { describe, it, expect } from 'vitest';
import { buildSlots, shuffleSlideGroup, reorderInSlideGroup, getSlideGroup, getPositionInSlide } from '../../src/lib/selection';

const makeSlot = (i: number) => ({
  track: { track_id: `t${i}`, track_name: `Track ${i}`, artist_names: `Artist ${i}` } as any,
  albumId: `a${i}`,
  selectionNumber: i,
  slideGroup: getSlideGroup(i),
  positionInSlide: getPositionInSlide(i),
  isCoverFeature: false,
});

describe('buildSlots', () => {
  it('renumbers selection slots sequentially', () => {
    const slots = [makeSlot(5), makeSlot(2), makeSlot(9)];
    const built = buildSlots(slots);
    expect(built.map(s => s.selectionNumber)).toEqual([1, 2, 3]);
  });

  it('assigns correct slide groups', () => {
    const slots = Array.from({ length: 16 }, (_, i) => makeSlot(i + 1));
    const built = buildSlots(slots);
    // Slots 1-8 = group 1, 9-16 = group 2
    expect(built[0].slideGroup).toBe(1);
    expect(built[7].slideGroup).toBe(1);
    expect(built[8].slideGroup).toBe(2);
    expect(built[15].slideGroup).toBe(2);
  });

  it('preserves track references', () => {
    const slots = [makeSlot(1), makeSlot(2)];
    const built = buildSlots(slots);
    expect(built[0].track.track_id).toBe('t1');
    expect(built[1].track.track_id).toBe('t2');
  });
});

describe('shuffleSlideGroup', () => {
  it('only shuffles within the specified group', () => {
    const slots = Array.from({ length: 16 }, (_, i) => makeSlot(i + 1));
    const built = buildSlots(slots);
    const shuffled = shuffleSlideGroup(built, 1);
    // Group 2 should be unchanged
    const group2 = shuffled.filter(s => s.slideGroup === 2);
    const origGroup2 = built.filter(s => s.slideGroup === 2);
    expect(group2.map(s => s.track.track_id)).toEqual(origGroup2.map(s => s.track.track_id));
  });

  it('returns same length', () => {
    const slots = buildSlots(Array.from({ length: 8 }, (_, i) => makeSlot(i + 1)));
    const shuffled = shuffleSlideGroup(slots, 1);
    expect(shuffled.length).toBe(8);
  });
});

describe('reorderInSlideGroup', () => {
  it('moves a track within a group', () => {
    const slots = buildSlots(Array.from({ length: 8 }, (_, i) => makeSlot(i + 1)));
    // Move index 0 (t1) to index 2: [t1,t2,t3,...] -> [t2,t3,t1,...]
    const reordered = reorderInSlideGroup(slots, 1, 0, 2);
    expect(reordered[0].track.track_id).toBe('t2');
    expect(reordered[1].track.track_id).toBe('t3');
    expect(reordered[2].track.track_id).toBe('t1');
  });
});

describe('getSlideGroup', () => {
  it('returns 1 for selections 1-8', () => {
    for (let i = 1; i <= 8; i++) {
      expect(getSlideGroup(i)).toBe(1);
    }
  });

  it('returns 2 for selections 9-16', () => {
    for (let i = 9; i <= 16; i++) {
      expect(getSlideGroup(i)).toBe(2);
    }
  });
});

describe('getPositionInSlide', () => {
  it('wraps around at 8', () => {
    expect(getPositionInSlide(1)).toBe(1);
    expect(getPositionInSlide(8)).toBe(8);
    expect(getPositionInSlide(9)).toBe(1);
    expect(getPositionInSlide(16)).toBe(8);
  });
});
