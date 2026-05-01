import { describe, it, expect } from 'vitest';

/**
 * Regression tests for scan endpoint auth.
 * Bug: frontend calls were rejected 401 because no auth header sent.
 * Fix: accept same-origin requests from NMF production domains.
 */

// Extract the auth logic for testing (mirrors scan-artists.ts isAuthorized)
function isAuthorized(headers: Record<string, string | undefined>, scanSecret: string): boolean {
  const auth = headers['authorization'];
  if (scanSecret && auth === `Bearer ${scanSecret}`) return true;
  const supabaseToken = headers['x-supabase-auth'];
  if (typeof supabaseToken === 'string' && supabaseToken.length > 20) return true;
  const origin = headers['origin'] || headers['referer'] || '';
  const allowedOrigins = new Set([
    'https://newmusicfriday.app',
    'https://maxmeetsmusiccity.com',
    'http://localhost:5173',
  ]);
  try {
    const parsed = new URL(origin);
    if (allowedOrigins.has(parsed.origin)) return true;
  } catch {}
  return false;
}

describe('scan endpoint authorization', () => {
  const SECRET = 'test-secret-123';

  it('accepts valid SCAN_SECRET', () => {
    expect(isAuthorized({ authorization: `Bearer ${SECRET}` }, SECRET)).toBe(true);
  });

  it('accepts valid Supabase JWT', () => {
    expect(isAuthorized({ 'x-supabase-auth': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.long-token-here' }, SECRET)).toBe(true);
  });

  it('accepts same-origin from newmusicfriday.app', () => {
    expect(isAuthorized({ origin: 'https://newmusicfriday.app' }, SECRET)).toBe(true);
  });

  it('accepts same-origin from maxmeetsmusiccity.com', () => {
    expect(isAuthorized({ origin: 'https://maxmeetsmusiccity.com' }, SECRET)).toBe(true);
  });

  it('accepts same-origin from localhost', () => {
    expect(isAuthorized({ origin: 'http://localhost:5173' }, SECRET)).toBe(true);
  });

  it('accepts referer from newmusicfriday.app', () => {
    expect(isAuthorized({ referer: 'https://newmusicfriday.app/newmusicfriday' }, SECRET)).toBe(true);
  });

  it('accepts referer from maxmeetsmusiccity.com', () => {
    expect(isAuthorized({ referer: 'https://maxmeetsmusiccity.com/newmusicfriday' }, SECRET)).toBe(true);
  });

  it('rejects unknown origin without auth', () => {
    expect(isAuthorized({ origin: 'https://evil.com' }, SECRET)).toBe(false);
  });

  it('rejects attacker-controlled subdomain containing an allowed hostname', () => {
    expect(isAuthorized({ origin: 'https://newmusicfriday.app.evil.com' }, SECRET)).toBe(false);
  });

  it('rejects empty headers', () => {
    expect(isAuthorized({}, SECRET)).toBe(false);
  });

  it('rejects short Supabase token', () => {
    expect(isAuthorized({ 'x-supabase-auth': 'short' }, SECRET)).toBe(false);
  });

  it('rejects wrong SCAN_SECRET', () => {
    expect(isAuthorized({ authorization: 'Bearer wrong-secret' }, SECRET)).toBe(false);
  });
});
