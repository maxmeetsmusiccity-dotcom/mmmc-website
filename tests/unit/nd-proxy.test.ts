import { beforeEach, describe, expect, it, vi } from 'vitest';
import handler, {
  isAllowedPath,
  isDeniedPath,
  isProxyRateLimited,
  resetProxyRateLimitForTests,
} from '../../api/nd-proxy';

function mockReq(path: string, ip = '203.0.113.10') {
  return {
    query: { path },
    method: 'GET',
    headers: { 'x-forwarded-for': ip },
    socket: { remoteAddress: ip },
  } as any;
}

function mockRes() {
  const res: any = {
    statusCode: 200,
    body: undefined,
    status: vi.fn((code: number) => {
      res.statusCode = code;
      return res;
    }),
    json: vi.fn((body: unknown) => {
      res.body = body;
      return res;
    }),
  };
  return res;
}

describe('NMF ND proxy path policy', () => {
  it('allows only NMF-safe profile endpoints', () => {
    expect(isAllowedPath('/api/profile/instagram')).toBe(true);
    expect(isAllowedPath('/api/profile/search?q=writer')).toBe(true);
    expect(isAllowedPath('/api/profile/research-agent/pg_123')).toBe(true);
  });

  it('denies sensitive profile endpoints', () => {
    expect(isDeniedPath('/api/profile/credit')).toBe(true);
    expect(isDeniedPath('/api/profile/royalty/pg_123')).toBe(true);
    expect(isDeniedPath('/api/profile/private?pg_id=123')).toBe(true);
    expect(isAllowedPath('/api/profile/credit')).toBe(false);
    expect(isAllowedPath('/api/profile/royalty/pg_123')).toBe(false);
    expect(isAllowedPath('/api/profile/private?pg_id=123')).toBe(false);
  });

  it('denies broad profile paths by default', () => {
    expect(isAllowedPath('/api/profile/pg_123')).toBe(false);
    expect(isAllowedPath('/api/profile/cowriters/pg_123')).toBe(false);
  });
});

describe('NMF ND proxy rate limit', () => {
  beforeEach(() => resetProxyRateLimitForTests());

  it('blocks the eleventh request in the 10/min burst window', () => {
    const now = 1_000_000;
    for (let i = 0; i < 10; i++) {
      expect(isProxyRateLimited('203.0.113.10', now + i)).toBe(false);
    }
    expect(isProxyRateLimited('203.0.113.10', now + 10)).toBe(true);
  });
});

describe('NMF ND proxy handler blocks denied paths before upstream fetch', () => {
  beforeEach(() => {
    resetProxyRateLimitForTests();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('returns 403 for denylisted profile paths', async () => {
    const res = mockRes();

    await handler(mockReq('/api/profile/royalty/pg_123'), res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body).toEqual({ error: 'Path not allowed' });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
