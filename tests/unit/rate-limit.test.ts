import { describe, it, expect } from 'vitest';
import { isRateLimited } from '../../api/_rateLimit';

describe('rate limiter', () => {
  it('allows first request', () => {
    expect(isRateLimited('test-ip-1', 5, 60000)).toBe(false);
  });

  it('allows requests up to the limit', () => {
    const key = 'test-ip-2';
    for (let i = 0; i < 5; i++) {
      expect(isRateLimited(key, 5, 60000)).toBe(false);
    }
  });

  it('blocks requests over the limit', () => {
    const key = 'test-ip-3';
    for (let i = 0; i < 5; i++) isRateLimited(key, 5, 60000);
    expect(isRateLimited(key, 5, 60000)).toBe(true);
  });

  it('different keys are independent', () => {
    const key1 = 'test-ip-4a';
    const key2 = 'test-ip-4b';
    for (let i = 0; i < 5; i++) isRateLimited(key1, 5, 60000);
    expect(isRateLimited(key1, 5, 60000)).toBe(true);
    expect(isRateLimited(key2, 5, 60000)).toBe(false);
  });

  it('resets after window expires', () => {
    const key = 'test-ip-5';
    // Use a very short window
    for (let i = 0; i < 3; i++) isRateLimited(key, 3, 1);
    expect(isRateLimited(key, 3, 1)).toBe(true);
    // After 2ms the window should have expired
    return new Promise<void>(resolve => {
      setTimeout(() => {
        expect(isRateLimited(key, 3, 1)).toBe(false);
        resolve();
      }, 5);
    });
  });
});
