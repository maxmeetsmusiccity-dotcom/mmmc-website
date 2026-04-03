import type { TrackItem } from './spotify';

export interface SelectionSlot {
  track: TrackItem;          // the representative track
  albumId: string;           // which release this came from
  selectionNumber: number;   // 1-based click order
  slideGroup: number;        // 1-based slide group (computed from selectionNumber)
  positionInSlide: number;   // 1-8 position within slide
  isCoverFeature: boolean;   // designated as carousel cover photo
}

export const TARGET_COUNTS = [8, 16, 24, 32, 40, 48] as const;
export type TargetCount = typeof TARGET_COUNTS[number];

export function getSlideGroup(selectionNumber: number): number {
  return Math.ceil(selectionNumber / 8);
}

export function getPositionInSlide(selectionNumber: number): number {
  return ((selectionNumber - 1) % 8) + 1;
}

/** Grid position labels for 3x3 with center logo */
export const GRID_POSITIONS = [
  'Top-Left', 'Top-Center', 'Top-Right',
  'Mid-Left', /* CENTER = LOGO */ 'Mid-Right',
  'Bottom-Left', 'Bottom-Center', 'Bottom-Right',
] as const;

export function buildSlots(selections: SelectionSlot[]): SelectionSlot[] {
  return selections.map((slot, i) => ({
    ...slot,
    selectionNumber: i + 1,
    slideGroup: getSlideGroup(i + 1),
    positionInSlide: getPositionInSlide(i + 1),
  }));
}

export function shuffleSlideGroup(selections: SelectionSlot[], slideGroup: number): SelectionSlot[] {
  const result = [...selections];
  const startIdx = (slideGroup - 1) * 8;
  const endIdx = Math.min(startIdx + 8, result.length);
  const group = result.slice(startIdx, endIdx);

  // Fisher-Yates shuffle
  for (let i = group.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [group[i], group[j]] = [group[j], group[i]];
  }

  result.splice(startIdx, group.length, ...group);
  return buildSlots(result);
}

export function reorderInSlideGroup(
  selections: SelectionSlot[],
  slideGroup: number,
  fromPos: number,  // 0-based index within group
  toPos: number,    // 0-based index within group
): SelectionSlot[] {
  const result = [...selections];
  const startIdx = (slideGroup - 1) * 8;
  const endIdx = Math.min(startIdx + 8, result.length);
  const group = result.slice(startIdx, endIdx);

  const [moved] = group.splice(fromPos, 1);
  group.splice(toPos, 0, moved);

  result.splice(startIdx, group.length, ...group);
  return buildSlots(result);
}
