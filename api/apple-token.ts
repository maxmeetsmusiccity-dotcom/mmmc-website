import type { VercelRequest, VercelResponse } from '@vercel/node';
import { SignJWT, importPKCS8 } from 'jose';
import { getClientIp, isRateLimited } from './_rateLimit';

const TEAM_ID = process.env.APPLE_MUSIC_TEAM_ID || 'G46PBQ4ZQL';
const KEY_ID = process.env.APPLE_MUSIC_KEY_ID || 'P4CJV5BNMH';
const TOKEN_TTL = 60 * 60 * 12; // 12 hours

const ALLOWED_ORIGINS = ['https://maxmeetsmusiccity.com', 'http://localhost:5173', 'http://localhost:5199'];

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  // Origin check — block casual cross-origin abuse
  const origin = _req.headers.origin || _req.headers.referer || '';
  if (origin && !ALLOWED_ORIGINS.some(o => origin.startsWith(o))) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (isRateLimited(getClientIp(_req), 20, 60_000)) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
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
