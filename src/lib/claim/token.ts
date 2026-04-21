/**
 * Writer-claim magic-link token signing + verification.
 *
 * HMAC-SHA256 over `{pg_id, exp_ts, nonce}`, encoded as base64url.
 *
 * Format: base64url(payload_json) + '.' + base64url(hmac_sha256(payload_json, secret))
 *
 * Used by:
 *   - /api/claim/send       — sign + embed in magic-link URL
 *   - /api/claim/submit     — verify before writing writer_claim_submission
 *   - /claim/:pg_id/:token  — verify + server-component-render confirm UI
 *
 * Secret: MAGIC_LINK_SECRET (Vercel env; rotatable independently of Supabase service key).
 *
 * Security moat:
 *   - HMAC prevents token forgery (attacker cannot construct a valid token
 *     without the secret)
 *   - 7d expiry caps replay window
 *   - Single-use via claim_token_used table (enforced in /api/claim/submit)
 *   - Rate limit 3 submissions/hr per pg_id (enforced by caller)
 *
 * Timing-safe comparison uses crypto.timingSafeEqual to avoid side-channel
 * discovery of the secret via response-time analysis.
 */

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export interface ClaimTokenPayload {
  pg_id: string;
  exp_ts: number; // unix epoch seconds
  nonce: string;
}

export class ClaimTokenError extends Error {
  readonly reason: string;
  constructor(message: string, reason: string) {
    super(message);
    this.name = 'ClaimTokenError';
    this.reason = reason;
  }
}

function base64urlEncode(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const b64 = (s + pad).replace(/-/g, '+').replace(/_/g, '/');
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

export function issueToken(
  pg_id: string,
  secret: string,
  {
    ttl_seconds = 7 * 24 * 60 * 60, // 7 days
    now_epoch = Math.floor(Date.now() / 1000),
    nonce,
  }: { ttl_seconds?: number; now_epoch?: number; nonce?: string } = {},
): { token: string; exp_ts: number; nonce: string } {
  if (!pg_id || typeof pg_id !== 'string') {
    throw new ClaimTokenError('pg_id required', 'missing_pg_id');
  }
  if (!secret) {
    throw new ClaimTokenError('secret required', 'missing_secret');
  }
  const n = nonce ?? base64urlEncode(randomBytes(16));
  const exp_ts = now_epoch + ttl_seconds;
  const payload: ClaimTokenPayload = { pg_id, exp_ts, nonce: n };
  const payload_json = JSON.stringify(payload);
  const payload_b64 = base64urlEncode(new TextEncoder().encode(payload_json));
  const sig = createHmac('sha256', secret).update(payload_b64).digest();
  const sig_b64 = base64urlEncode(sig);
  return { token: `${payload_b64}.${sig_b64}`, exp_ts, nonce: n };
}

export function verifyToken(
  token: string,
  secret: string,
  { now_epoch = Math.floor(Date.now() / 1000) }: { now_epoch?: number } = {},
): { ok: true; payload: ClaimTokenPayload } | { ok: false; reason: string } {
  if (!token || typeof token !== 'string') {
    return { ok: false, reason: 'missing_token' };
  }
  if (!secret) {
    return { ok: false, reason: 'missing_secret' };
  }
  const parts = token.split('.');
  if (parts.length !== 2) {
    return { ok: false, reason: 'malformed_token' };
  }
  const [payload_b64, sig_b64] = parts;
  const expected_sig = createHmac('sha256', secret).update(payload_b64).digest();
  let presented_sig: Buffer;
  try {
    presented_sig = Buffer.from(base64urlDecode(sig_b64));
  } catch {
    return { ok: false, reason: 'malformed_sig' };
  }
  if (presented_sig.length !== expected_sig.length
      || !timingSafeEqual(presented_sig, expected_sig)) {
    return { ok: false, reason: 'bad_signature' };
  }
  let payload: ClaimTokenPayload;
  try {
    const json = new TextDecoder().decode(base64urlDecode(payload_b64));
    const parsed = JSON.parse(json);
    if (typeof parsed.pg_id !== 'string'
        || typeof parsed.exp_ts !== 'number'
        || typeof parsed.nonce !== 'string') {
      return { ok: false, reason: 'bad_payload_shape' };
    }
    payload = parsed;
  } catch {
    return { ok: false, reason: 'bad_payload_json' };
  }
  if (payload.exp_ts <= now_epoch) {
    return { ok: false, reason: 'expired' };
  }
  return { ok: true, payload };
}

/**
 * Hash a token for storage in claim_token_used (never store raw tokens in the
 * DB; hash instead so a DB leak cannot be replayed as a valid magic-link).
 */
export function hashTokenForStorage(token: string): string {
  // Using HMAC with a well-known prefix, not HMAC over the secret — the
  // purpose here is pseudonymization for the DB, not authentication.
  // SHA-256 is also fine but HMAC gives future flexibility.
  return createHmac('sha256', 'claim_token_used_v1').update(token).digest('hex');
}
