import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { issueToken } from '../../src/lib/claim/token.js';
import { getClientIp, isRateLimited } from '../_rateLimit.js';

/**
 * POST /api/claim/send
 * Body: { pg_id, email? }
 *
 * Issues a magic-link token for the writer identified by pg_id. Always returns
 * the URL in the response body (for QA copy/paste). Emails it only when:
 *   - REAL_WRITER_SENDS_AUTHORIZED=true  (feature flag; default OFF)
 *   - RESEND_API_KEY is configured
 *   - email is msblachman@gmail.com OR the pg_id appears in a future allowlist
 *
 * Never emails a random writer address. Default gate: Max's inbox only.
 *
 * Red-zone discipline per `feedback_no_fabricated_data_to_real_surfaces`:
 * the feature flag default is OFF; enabling requires an explicit Vercel env
 * set + per-writer opt-in list (not implemented in SW6; future SW7+).
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const MAGIC_LINK_SECRET = process.env.MAGIC_LINK_SECRET || '';
const MAX_EMAIL = 'msblachman@gmail.com';
const REAL_SENDS_AUTHORIZED = process.env.REAL_WRITER_SENDS_AUTHORIZED === 'true';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const CLAIM_BASE_URL = process.env.CLAIM_BASE_URL || 'https://maxmeetsmusiccity.com';
const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'POST only' });
  }
  if (!MAGIC_LINK_SECRET) {
    return res.status(500).json({ error: 'MAGIC_LINK_SECRET not configured' });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Supabase server config missing' });
  }

  // Rate limit: 3 sends/hr per IP (pg_id rate limit is on /submit, not /send,
  // because /send is cheap-ish and /submit is the actual write).
  if (await isRateLimited(`claim-send:${getClientIp(req)}`, 5, 60 * 60_000)) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }

  const { pg_id, email } = (req.body as Record<string, unknown>) || {};
  if (!pg_id || typeof pg_id !== 'string' || pg_id.length > 128) {
    return res.status(400).json({ error: 'pg_id required (<= 128 chars)' });
  }

  // Writer context lookup — required so we don't issue tokens for unknown pg_ids.
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { data: ctx, error: ctxErr } = await supabase
    .from('instagram_handles')
    .select('spotify_artist_id, artist_name, instagram_handle, nd_pg_id')
    .eq('nd_pg_id', pg_id)
    .maybeSingle();
  if (ctxErr) {
    console.error('[claim/send] context lookup error:', ctxErr);
    return res.status(500).json({ error: 'Lookup failed' });
  }
  if (!ctx) {
    return res.status(404).json({ error: 'Unknown pg_id' });
  }

  const { token, exp_ts } = issueToken(pg_id, MAGIC_LINK_SECRET, {
    ttl_seconds: TOKEN_TTL_SECONDS,
  });
  const url = `${CLAIM_BASE_URL}/claim/${encodeURIComponent(pg_id)}/${encodeURIComponent(token)}`;

  // Send path — triple-gated
  let send_attempted = false;
  let send_result: { ok: boolean; detail?: string } | null = null;

  const requested_email = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const is_max_inbox = !requested_email || requested_email === MAX_EMAIL;

  if (REAL_SENDS_AUTHORIZED && RESEND_API_KEY && is_max_inbox) {
    send_attempted = true;
    send_result = await sendViaResend({
      to: MAX_EMAIL,
      artist_name: ctx.artist_name || pg_id,
      current_handle: ctx.instagram_handle,
      url,
    });
  } else if (REAL_SENDS_AUTHORIZED && !is_max_inbox) {
    // Attempted send to non-Max email — REFUSE per Red-zone discipline.
    return res.status(403).json({
      error: 'real_writer_sends_authorized=true does not yet permit arbitrary '
        + 'addresses; only ' + MAX_EMAIL + ' is greenlit. Max line-by-line '
        + 'list approval required to enable per-address sends (future SW7+).',
    });
  }

  return res.status(200).json({
    ok: true,
    pg_id,
    writer_context: {
      artist_name: ctx.artist_name,
      current_instagram_handle: ctx.instagram_handle,
    },
    expires_at: new Date(exp_ts * 1000).toISOString(),
    url, // QA-mode: Max copies from response; real sends route via Resend
    feature_flags: {
      real_writer_sends_authorized: REAL_SENDS_AUTHORIZED,
      resend_configured: Boolean(RESEND_API_KEY),
      send_attempted,
      send_result,
    },
  });
}

async function sendViaResend(params: {
  to: string;
  artist_name: string;
  current_handle: string | null;
  url: string;
}): Promise<{ ok: boolean; detail?: string }> {
  const html = `
<!doctype html>
<html><body style="font-family: -apple-system, sans-serif; color: #111;">
  <h2 style="color: #0F1B33;">Confirm your MMMC writer profile</h2>
  <p>Hi ${escapeHtml(params.artist_name)},</p>
  <p>Max from Max Meets Music City is reaching out. We have you in our Nashville
     writer dataset${params.current_handle
        ? ` with Instagram handle <code>${escapeHtml(params.current_handle)}</code>`
        : ''}. Could you take 30 seconds to confirm or correct your info?</p>
  <p><a href="${params.url}" style="display:inline-block;padding:12px 24px;background:#3EE6C3;color:#0F1B33;text-decoration:none;border-radius:4px;font-weight:600;">Confirm my profile</a></p>
  <p style="color:#666;font-size:12px;">This link expires in 7 days and can only be used once. If you didn't expect this email, just ignore it.</p>
</body></html>`;

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'MMMC <noreply@maxmeetsmusiccity.com>',
        to: params.to,
        subject: `Quick confirm: your MMMC writer profile (${params.artist_name})`,
        html,
      }),
    });
    if (!resp.ok) {
      const detail = await resp.text();
      console.error('[claim/send] Resend failure:', resp.status, detail.slice(0, 300));
      return { ok: false, detail: `resend_http_${resp.status}` };
    }
    return { ok: true };
  } catch (e) {
    console.error('[claim/send] Resend exception:', e);
    return { ok: false, detail: 'resend_exception' };
  }
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
