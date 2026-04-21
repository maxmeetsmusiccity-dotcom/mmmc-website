import { describe, it, expect } from 'vitest';
import { issueToken, verifyToken, hashTokenForStorage, ClaimTokenError }
  from '../../../src/lib/claim/token.js';

const SECRET = 'test-secret-do-not-use-in-prod-nqg35hVgfj';

describe('claim token', () => {
  it('issues a valid token', () => {
    const { token, exp_ts, nonce } = issueToken('pg_abc123', SECRET);
    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(exp_ts).toBeGreaterThan(Math.floor(Date.now() / 1000));
    expect(nonce.length).toBeGreaterThan(10);
  });

  it('round-trips issue -> verify', () => {
    const { token } = issueToken('pg_abc123', SECRET);
    const r = verifyToken(token, SECRET);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.payload.pg_id).toBe('pg_abc123');
      expect(r.payload.exp_ts).toBeGreaterThan(Math.floor(Date.now() / 1000));
    }
  });

  it('rejects tokens with a different secret', () => {
    const { token } = issueToken('pg_abc123', SECRET);
    const r = verifyToken(token, 'wrong-secret-vQp34sX8LfJd');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('bad_signature');
  });

  it('rejects expired tokens', () => {
    const in_the_past = Math.floor(Date.now() / 1000) - 1000;
    const { token } = issueToken('pg_abc123', SECRET, {
      ttl_seconds: 0,
      now_epoch: in_the_past,
    });
    const r = verifyToken(token, SECRET);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('expired');
  });

  it('rejects malformed tokens', () => {
    const r1 = verifyToken('not-a-token-at-all', SECRET);
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.reason).toBe('malformed_token');

    const r2 = verifyToken('aaa.bbb', SECRET);
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.reason).toMatch(/bad_|malformed_/);
  });

  it('rejects payload tampering (modified pg_id in payload)', () => {
    const { token } = issueToken('pg_abc123', SECRET);
    // Mutate the payload segment (first char before the dot) — this will
    // change the base64 string and break HMAC verification.
    const [payload, sig] = token.split('.');
    const tampered = `${payload.slice(0, -1)}X.${sig}`;
    const r = verifyToken(tampered, SECRET);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/bad_signature|bad_payload/);
  });

  it('generates distinct nonces for repeated calls', () => {
    const a = issueToken('pg_x', SECRET);
    const b = issueToken('pg_x', SECRET);
    expect(a.nonce).not.toBe(b.nonce);
    expect(a.token).not.toBe(b.token);
  });

  it('throws when pg_id or secret is missing', () => {
    expect(() => issueToken('', SECRET)).toThrow(ClaimTokenError);
    expect(() => issueToken('pg_x', '')).toThrow(ClaimTokenError);
  });

  it('returns missing_token/secret errors on verify without throwing', () => {
    const r1 = verifyToken('', SECRET);
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.reason).toBe('missing_token');
    const r2 = verifyToken('a.b', '');
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.reason).toBe('missing_secret');
  });

  it('hashTokenForStorage is deterministic and distinct from the raw token', () => {
    const { token } = issueToken('pg_abc123', SECRET);
    const h1 = hashTokenForStorage(token);
    const h2 = hashTokenForStorage(token);
    expect(h1).toBe(h2);
    expect(h1).not.toBe(token);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });

  it('hashTokenForStorage differs across different tokens', () => {
    const a = issueToken('pg_x', SECRET).token;
    const b = issueToken('pg_y', SECRET).token;
    expect(hashTokenForStorage(a)).not.toBe(hashTokenForStorage(b));
  });
});
