import { describe, it, expect } from 'vitest';
import { toSlim, type HealthReport } from '../../api/scan-health';

describe('toSlim (M-Z19 public probe response shape)', () => {
  const fullHealthy: HealthReport = {
    spotify_ok: true,
    apple_ok: true,
    spotify: { ok: true, status: 200, latency_ms: 123 },
    apple: { ok: true, status: 200, latency_ms: 98 },
    tested_at: '2026-04-19T14:30:00.000Z',
  };

  it('strips latency_ms from both platforms', () => {
    const slim = toSlim(fullHealthy);
    expect(slim.spotify).not.toHaveProperty('latency_ms');
    expect(slim.apple).not.toHaveProperty('latency_ms');
  });

  it('strips error strings from slim response', () => {
    const withErrors: HealthReport = {
      ...fullHealthy,
      spotify: { ok: false, status: 429, latency_ms: 5000, error: 'http_429:token_scope_mismatch', retry_after_seconds: 17 },
      apple: { ok: false, status: 500, latency_ms: 2100, error: 'http_500:internal_detail_leak' },
    };
    const slim = toSlim(withErrors);
    expect(slim.spotify).not.toHaveProperty('error');
    expect(slim.apple).not.toHaveProperty('error');
  });

  it('preserves ok + status + retry_after_s', () => {
    const rateLimited: HealthReport = {
      ...fullHealthy,
      spotify: { ok: false, status: 429, latency_ms: 80, retry_after_seconds: 42 },
      apple: { ok: true, status: 200, latency_ms: 77 },
    };
    const slim = toSlim(rateLimited);
    expect(slim.spotify.ok).toBe(false);
    expect(slim.spotify.status).toBe(429);
    expect(slim.spotify.retry_after_s).toBe(42);
    expect(slim.apple.ok).toBe(true);
    expect(slim.apple.status).toBe(200);
    expect(slim.apple.retry_after_s).toBeUndefined();
  });

  it('preserves tested_at timestamp', () => {
    const slim = toSlim(fullHealthy);
    expect(slim.tested_at).toBe('2026-04-19T14:30:00.000Z');
  });

  it('handles null status (network error / token failure)', () => {
    const networkDown: HealthReport = {
      ...fullHealthy,
      spotify_ok: false,
      spotify: { ok: false, status: null, latency_ms: 5001, error: 'timeout' },
    };
    const slim = toSlim(networkDown);
    expect(slim.spotify.status).toBeNull();
    expect(slim.spotify.ok).toBe(false);
  });

  it('does not leak any top-level sensitive keys', () => {
    const slim = toSlim(fullHealthy);
    const keys = Object.keys(slim).sort();
    expect(keys).toEqual(['apple', 'spotify', 'tested_at']);
  });

  it('slim platform shapes have only ok + status + optional retry_after_s', () => {
    const slim = toSlim(fullHealthy);
    const spotifyKeys = Object.keys(slim.spotify).sort();
    expect(spotifyKeys.every(k => ['ok', 'status', 'retry_after_s'].includes(k))).toBe(true);
    const appleKeys = Object.keys(slim.apple).sort();
    expect(appleKeys.every(k => ['ok', 'status', 'retry_after_s'].includes(k))).toBe(true);
  });
});
