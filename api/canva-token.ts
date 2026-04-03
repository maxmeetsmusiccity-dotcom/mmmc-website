import type { VercelRequest, VercelResponse } from '@vercel/node';

const CANVA_CLIENT_ID = 'OC-AZ1TvjSadyjJ';
const TOKEN_URL = 'https://api.canva.com/rest/v1/oauth/token';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const clientSecret = process.env.CANVA_CLIENT_SECRET;
  if (!clientSecret) {
    return res.status(500).json({ error: 'CANVA_CLIENT_SECRET not configured' });
  }

  const { code, code_verifier, redirect_uri } = req.body || {};
  if (!code) {
    return res.status(400).json({ error: 'Missing authorization code' });
  }

  const basicAuth = Buffer.from(`${CANVA_CLIENT_ID}:${clientSecret}`).toString('base64');

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirect_uri || 'https://maxmeetsmusiccity.com/newmusicfriday',
  });

  if (code_verifier) {
    body.set('code_verifier', code_verifier);
  }

  const tokenRes = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basicAuth}`,
    },
    body: body.toString(),
  });

  const data = await tokenRes.json();

  if (!tokenRes.ok) {
    return res.status(tokenRes.status).json({
      error: data.error || 'Token exchange failed',
      description: data.error_description,
    });
  }

  return res.status(200).json({
    access_token: data.access_token,
    expires_in: data.expires_in,
    token_type: data.token_type,
  });
}
