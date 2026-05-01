import type { VercelRequest, VercelResponse } from '@vercel/node';
import { SignJWT, importPKCS8 } from 'jose';
import { getClientIp, isRateLimited } from './_rateLimit.js';

const TEAM_ID = process.env.APPLE_MUSIC_TEAM_ID || '';
const KEY_ID = process.env.APPLE_MUSIC_KEY_ID || '';
const TOKEN_TTL = 60 * 60 * 12; // 12 hours

const ALLOWED_ORIGINS = new Set([
  'https://newmusicfriday.app',
  'https://maxmeetsmusiccity.com',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5199',
]);

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  // Origin check — exact-match allowlist (matches scan-artists, search-apple, resolve-handle)
  const origin = _req.headers.origin || '';
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    // Also check referer as fallback
    const referer = _req.headers.referer || '';
    try { if (!referer || !ALLOWED_ORIGINS.has(new URL(referer).origin)) return res.status(403).json({ error: 'Forbidden' }); } catch { return res.status(403).json({ error: 'Forbidden' }); }
  }

  if (await isRateLimited(getClientIp(_req), 20, 60_000)) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }
  if (!TEAM_ID || !KEY_ID) {
    console.error('[apple-token] APPLE_MUSIC_TEAM_ID or APPLE_MUSIC_KEY_ID not configured');
    return res.status(500).json({ error: 'Server misconfigured' });
  }
  const privateKeyPem = process.env.APPLE_MUSIC_PRIVATE_KEY;
  if (!privateKeyPem) {
    return res.status(500).json({ error: 'APPLE_MUSIC_PRIVATE_KEY not configured' });
  }

  try {
    const privateKey = await importPKCS8(privateKeyPem, 'ES256');
    const now = Math.floor(Date.now() / 1000);

    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'ES256', kid: KEY_ID })
      .setIssuer(TEAM_ID)
      .setIssuedAt(now)
      .setExpirationTime(now + TOKEN_TTL)
      .sign(privateKey);

    // Cache the token for 11 hours (just under the 12hr TTL)
    res.setHeader('Cache-Control', 's-maxage=39600, stale-while-revalidate');
    return res.status(200).json({ token, expires_in: TOKEN_TTL });
  } catch (e) {
    console.error('[apple-token] JWT generation failed:', e);
    return res.status(500).json({ error: 'Token generation failed' });
  }
}
