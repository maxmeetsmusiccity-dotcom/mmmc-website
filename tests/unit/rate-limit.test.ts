import { describe, it, expect } from 'vitest';
import { isRateLimited, getClientIp } from '../../api/_rateLimit';

describe('rate limiter', () => {
  // Without UPSTASH env vars, isRateLimited always returns false (permissive fallback)
  it('allows requests when Redis is not configured', async () => {
    expect(await isRateLimited('test-ip-1', 5, 60000)).toBe(false);
  });

  it('allows multiple requests without Redis', async () => {
    for (let i = 0; i < 20; i++) {
      expect(await isRateLimited('test-ip-2', 5, 60000)).toBe(false);
    }
  });

  it('is async', () => {
    const result = isRateLimited('test-ip-3', 5, 60000);
    expect(result).toBeInstanceOf(Promise);
  });
});

describe('getClientIp', () => {
  it('extracts from x-forwarded-for', () => {
    expect(getClientIp({ headers: { 'x-forwarded-for': '1.2.3.4' } } as any)).toBe('1.2.3.4');
  });

  it('takes first IP from comma-separated list', () => {
    expect(getClientIp({ headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' } } as any)).toBe('1.2.3.4');
  });

  it('falls back to unknown', () => {
    expect(getClientIp({ headers: {}, socket: {} } as any)).toBe('unknown');
  });
});
