import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { verifyToken, hashTokenForStorage } from '../../src/lib/claim/token.js';
import { getClientIp, isRateLimited } from '../_rateLimit.js';

/**
 * GET /api/claim/verify?pg_id=...&token=...
 *
 * Server-side HMAC verification + single-use check + writer-context return.
 * The /claim/:pg_id/:token React route calls this on mount to decide whether
 * to render the confirm UI or an error message.
 *
 * Never trusts client-side verification — HMAC requires MAGIC_LINK_SECRET
 * which is server-only.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const MAGIC_LINK_SECRET = process.env.MAGIC_LINK_SECRET || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'GET only' });
  }
  if (!MAGIC_LINK_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Server config missing' });
  }
  if (await isRateLimited(`claim-verify:${getClientIp(req)}`, 30, 60_000)) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }

  const pg_id = typeof req.query.pg_id === 'string' ? req.query.pg_id : '';
  const token = typeof req.query.token === 'string' ? req.query.token : '';
  if (!pg_id || !token) {
    return res.status(400).json({ error: 'pg_id + token required' });
  }

  const result = verifyToken(token, MAGIC_LINK_SECRET);
  if (!result.ok) {
    return res.status(400).json({ error: 'Invalid token', reason: result.reason });
  }
  if (result.payload.pg_id !== pg_id) {
    return res.status(400).json({ error: 'Invalid token', reason: 'pg_id_mismatch' });
  }

  // Check single-use — if already used, surface that distinctly so the UI
  // can render "This link was already used" without implying the token is forged.
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const token_hash = hashTokenForStorage(token);
  const { data: used, error: usedErr } = await supabase
    .from('claim_token_used')
    .select('used_at')
    .eq('token_hash', token_hash)
    .maybeSingle();
  if (usedErr) {
    console.error('[claim/verify] used lookup error:', usedErr);
    return res.status(500).json({ error: 'Lookup failed' });
  }
  if (used) {
    return res.status(410).json({
      error: 'Token already used',
      reason: 'single_use',
      used_at: used.used_at,
    });
  }

  // Writer context for the confirm UI.
  const { data: ctx, error: ctxErr } = await supabase
    .from('instagram_handles')
    .select('spotify_artist_id, artist_name, instagram_handle')
    .eq('nd_pg_id', pg_id)
    .maybeSingle();
  if (ctxErr) {
    console.error('[claim/verify] context lookup error:', ctxErr);
    return res.status(500).json({ error: 'Lookup failed' });
  }
  if (!ctx) {
    return res.status(404).json({ error: 'Unknown pg_id' });
  }

  return res.status(200).json({
    ok: true,
    pg_id,
    expires_at: new Date(result.payload.exp_ts * 1000).toISOString(),
    writer_context: {
      artist_name: ctx.artist_name,
      current_instagram_handle: ctx.instagram_handle,
      spotify_artist_id: ctx.spotify_artist_id,
    },
  });
}
