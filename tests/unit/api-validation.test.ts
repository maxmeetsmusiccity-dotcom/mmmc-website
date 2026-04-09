import { describe, it, expect, beforeEach } from 'vitest';
import { isRateLimited, getClientIp } from '../../api/_rateLimit';
import type { VercelRequest } from '@vercel/node';

// ---------- Helper to create minimal VercelRequest stubs ----------

function makeReq(headers: Record<string, string | string[] | undefined> = {}, remoteAddress?: string): VercelRequest {
  return {
    headers,
    socket: remoteAddress ? { remoteAddress } : undefined,
  } as unknown as VercelRequest;
}

// ---------- Tests ----------

describe('getClientIp', () => {
  it('extracts IP from x-forwarded-for header (single IP)', () => {
    const req = makeReq({ 'x-forwarded-for': '1.2.3.4' });
    expect(getClientIp(req)).toBe('1.2.3.4');
  });

  it('extracts first IP from x-forwarded-for with multiple IPs', () => {
    const req = makeReq({ 'x-forwarded-for': '10.0.0.1, 192.168.1.1, 172.16.0.1' });
    expect(getClientIp(req)).toBe('10.0.0.1');
  });

  it('trims whitespace from x-forwarded-for', () => {
    const req = makeReq({ 'x-forwarded-for': '  203.0.113.50  , 192.168.1.1' });
    expect(getClientIp(req)).toBe('203.0.113.50');
  });

  it('falls back to socket.remoteAddress when no x-forwarded-for', () => {
    const req = makeReq({}, '127.0.0.1');
    expect(getClientIp(req)).toBe('127.0.0.1');
  });

  it('returns "unknown" when no IP info is available', () => {
    const req = makeReq({});
    expect(getClientIp(req)).toBe('unknown');
  });

  it('ignores x-forwarded-for when it is an array (non-string)', () => {
    // Vercel types allow string | string[] | undefined
    const req = makeReq({ 'x-forwarded-for': ['1.1.1.1', '2.2.2.2'] as unknown as string }, '9.9.9.9');
    expect(getClientIp(req)).toBe('9.9.9.9');
  });
});

describe('isRateLimited', () => {
  // Use a unique key prefix for each test to avoid cross-test contamination
  // (the rate limiter uses an in-memory Map that persists across tests)
  let keyBase: string;
  beforeEach(() => {
    keyBase = `test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  });

  it('returns false for the very first request', () => {
    expect(isRateLimited(`${keyBase}-first`, 5, 60000)).toBe(false);
  });

  it('returns false for requests within the limit', () => {
    const key = `${keyBase}-within`;
    for (let i = 0; i < 5; i++) {
      expect(isRateLimited(key, 5, 60000)).toBe(false);
    }
  });

  it('returns true after max requests exceeded', () => {
    const key = `${keyBase}-exceed`;
    // First 3 are allowed (count 1, 2, 3 — limit is 3)
    expect(isRateLimited(key, 3, 60000)).toBe(false); // count 1
    expect(isRateLimited(key, 3, 60000)).toBe(false); // count 2
    expect(isRateLimited(key, 3, 60000)).toBe(false); // count 3
    // 4th exceeds the max of 3
    expect(isRateLimited(key, 3, 60000)).toBe(true);
  });

  it('continues to block after limit is exceeded', () => {
    const key = `${keyBase}-block`;
    // Exhaust limit of 1
    expect(isRateLimited(key, 1, 60000)).toBe(false);
    expect(isRateLimited(key, 1, 60000)).toBe(true);
    expect(isRateLimited(key, 1, 60000)).toBe(true);
    expect(isRateLimited(key, 1, 60000)).toBe(true);
  });

  it('resets after window expires (simulated by using a very short window)', async () => {
    const key = `${keyBase}-reset`;
    // Use a 50ms window
    expect(isRateLimited(key, 1, 50)).toBe(false);
    expect(isRateLimited(key, 1, 50)).toBe(true);
    // Wait for window to expire
    await new Promise(r => setTimeout(r, 60));
    // Should be allowed again (window reset)
    expect(isRateLimited(key, 1, 50)).toBe(false);
  });

  it('different keys are independent', () => {
    const keyA = `${keyBase}-A`;
    const keyB = `${keyBase}-B`;
    // Exhaust keyA
    expect(isRateLimited(keyA, 1, 60000)).toBe(false);
    expect(isRateLimited(keyA, 1, 60000)).toBe(true);
    // keyB is unaffected
    expect(isRateLimited(keyB, 1, 60000)).toBe(false);
  });

  it('max=0 blocks immediately on second request', () => {
    // Edge case: maxRequests = 0 means first call sets count to 1 which is > 0
    // Actually looking at the code: first call sets count=1, then returns false.
    // Second call: count becomes 2 > 0, returns true.
    // Wait — re-read: if !entry, set count=1, return false. Then count++ makes 2, 2>0 = true.
    // So with max=0, first is allowed, second is blocked.
    const key = `${keyBase}-zero`;
    expect(isRateLimited(key, 0, 60000)).toBe(false);
    expect(isRateLimited(key, 0, 60000)).toBe(true);
  });
});
