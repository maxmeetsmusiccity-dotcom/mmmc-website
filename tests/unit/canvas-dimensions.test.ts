import { describe, it, expect } from 'vitest';
import { getDimensions } from '../../src/lib/canvas-grid';

describe('getDimensions', () => {
  it('returns 1080x1080 for 1:1', () => {
    const d = getDimensions('1:1');
    expect(d.w).toBe(1080);
    expect(d.h).toBe(1080);
  });
  it('returns 1080x1440 for 3:4', () => {
    const d = getDimensions('3:4');
    expect(d.w).toBe(1080);
    expect(d.h).toBe(1440);
  });
  it('gridY is defined for 1:1', () => {
    expect(getDimensions('1:1').gridY).toBeGreaterThan(0);
  });
  it('gridY is defined for 3:4', () => {
    expect(getDimensions('3:4').gridY).toBeGreaterThan(0);
  });
  it('gridH is larger for 3:4 than 1:1', () => {
    expect(getDimensions('3:4').gridH).toBeGreaterThan(getDimensions('1:1').gridH);
  });
  it('defaults to 1:1 with no argument', () => {
    const d = getDimensions();
    expect(d.w).toBe(1080);
    expect(d.h).toBe(1080);
  });
  it('fontScale is 1.0 for both aspects', () => {
    expect(getDimensions('1:1').fontScale).toBe(1.0);
    expect(getDimensions('3:4').fontScale).toBe(1.0);
  });
  it('3:4 gridH is 1200', () => {
    expect(getDimensions('3:4').gridH).toBe(1200);
  });
});
