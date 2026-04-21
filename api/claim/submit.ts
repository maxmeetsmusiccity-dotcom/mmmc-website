import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { verifyToken, hashTokenForStorage } from '../../src/lib/claim/token.js';
import { getClientIp, isRateLimited } from '../_rateLimit.js';

/**
 * POST /api/claim/submit
 * Body: {
 *   pg_id,
 *   token,
 *   confirmed_instagram_handle,
 *   corrected_instagram_handle?,
 *   notes?
 * }
 *
 * Verification ladder (all must pass):
 *   1. HMAC signature + pg_id match + not expired         (verifyToken)
 *   2. Token not already used                             (claim_token_used lookup)
 *   3. Rate limit 3 submissions/hr per pg_id              (Upstash)
 *
 * On success, writes the submission + token_hash atomically (from the caller's
 * perspective — two sequential inserts; if claim_token_used fails, the writer
 * submission is still persisted and Max's weekly review will see a duplicate
 * that can be manually deduplicated).
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const MAGIC_LINK_SECRET = process.env.MAGIC_LINK_SECRET || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'POST only' });
  }
  if (!MAGIC_LINK_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Server config missing' });
  }

  const { pg_id, token, confirmed_instagram_handle, corrected_instagram_handle, notes } =
    (req.body as Record<string, unknown>) || {};

  if (typeof pg_id !== 'string' || !pg_id || pg_id.length > 128) {
    return res.status(400).json({ error: 'pg_id required' });
  }
  if (typeof token !== 'string' || !token) {
    return res.status(400).json({ error: 'token required' });
  }
  if (typeof confirmed_instagram_handle !== 'string' || confirmed_instagram_handle.length > 256) {
    return res.status(400).json({ error: 'confirmed_instagram_handle required (<=256 chars)' });
  }
  if (corrected_instagram_handle !== undefined
      && (typeof corrected_instagram_handle !== 'string'
          || corrected_instagram_handle.length > 256)) {
    return res.status(400).json({ error: 'corrected_instagram_handle must be string <=256' });
  }
  if (notes !== undefined && (typeof notes !== 'string' || notes.length > 2000)) {
    return res.status(400).json({ error: 'notes must be string <=2000' });
  }

  // Rate limit BEFORE HMAC check so a token-brute-force attack also hits the limit.
  if (await isRateLimited(`claim-submit:${pg_id}`, 3, 60 * 60_000)) {
    return res.status(429).json({ error: 'Too many submissions for this pg_id (3/hr)' });
  }

  const result = verifyToken(token, MAGIC_LINK_SECRET);
  if (!result.ok) {
    return res.status(400).json({ error: 'Invalid token', reason: result.reason });
  }
  if (result.payload.pg_id !== pg_id) {
    return res.status(400).json({ error: 'Invalid token', reason: 'pg_id_mismatch' });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const token_hash = hashTokenForStorage(token);

  // Single-use check — fail loud if already used.
  const { data: used, error: usedErr } = await supabase
    .from('claim_token_used')
    .select('used_at')
    .eq('token_hash', token_hash)
    .maybeSingle();
  if (usedErr) {
    console.error('[claim/submit] used lookup error:', usedErr);
    return res.status(500).json({ error: 'Lookup failed' });
  }
  if (used) {
    return res.status(410).json({ error: 'Token already used', used_at: used.used_at });
  }

  const submission_ip = getClientIp(req);
  const user_agent = typeof req.headers['user-agent'] === 'string'
    ? req.headers['user-agent'].slice(0, 512) : null;

  const { data: inserted, error: insertErr } = await supabase
    .from('writer_claim_submission')
    .insert({
      pg_id,
      submission_ip,
      user_agent,
      confirmed_instagram_handle,
      corrected_instagram_handle: corrected_instagram_handle || null,
      notes: notes || null,
    })
    .select('id, submitted_at')
    .single();
  if (insertErr) {
    console.error('[claim/submit] insert error:', insertErr);
    return res.status(500).json({ error: 'Submit failed' });
  }

  // Mark token used. If this fails, submission is still persisted; weekly
  // review will notice multiple rows for same pg_id and dedupe manually.
  const { error: markErr } = await supabase
    .from('claim_token_used')
    .insert({
      token_hash,
      pg_id,
      used_from_ip: submission_ip,
    });
  if (markErr) {
    console.warn('[claim/submit] mark-used failure (submission persisted):', markErr);
  }

  return res.status(201).json({
    ok: true,
    submission_id: inserted.id,
    submitted_at: inserted.submitted_at,
  });
}
