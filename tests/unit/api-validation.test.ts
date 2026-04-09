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

describe('isRateLimited (Upstash-backed, async)', () => {
  // Without UPSTASH env vars, isRateLimited always returns false (permissive fallback)
  it('returns a Promise', () => {
    expect(isRateLimited('test-key', 5, 60000)).toBeInstanceOf(Promise);
  });

  it('allows all requests when Redis is not configured', async () => {
    expect(await isRateLimited('test-no-redis-1', 5, 60000)).toBe(false);
    expect(await isRateLimited('test-no-redis-2', 1, 60000)).toBe(false);
  });

  it('allows unlimited requests without Redis (no blocking)', async () => {
    for (let i = 0; i < 100; i++) {
      expect(await isRateLimited('test-flood', 1, 60000)).toBe(false);
    }
  });
});
