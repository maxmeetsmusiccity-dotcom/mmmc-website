import type { VercelRequest, VercelResponse } from '@vercel/node';
import { SignJWT, importPKCS8 } from 'jose';
import { createClient } from '@supabase/supabase-js';

const TEAM_ID = 'G46PBQ4ZQL';
const KEY_ID = 'XP4Q9YVKQU';
const TOKEN_TTL = 60 * 60 * 12; // 12 hours

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // ── Auth: require valid Supabase session ──
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (supabaseUrl && supabaseKey) {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: { user }, error } = await supabase.auth.getUser(authHeader.slice(7));
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid session' });
    }
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
    return res.status(500).json({ error: 'JWT generation failed', detail: (e as Error).message });
  }
}
