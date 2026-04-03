import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const baseUrl = process.env.ND_API_BASE_URL;
  const secret = process.env.ND_AUTH_TOKEN_SECRET;
  const username = process.env.ND_AUTH_USERNAME;

  if (!baseUrl || !secret || !username) {
    return res.status(500).json({ error: 'ND API not configured' });
  }

  // Generate HMAC daily token
  const today = new Date().toISOString().split('T')[0];
  const payload = `${today}:${username.toLowerCase()}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const token = [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);

  // Forward the request path
  const path = req.query.path as string;
  if (!path) {
    return res.status(400).json({ error: 'Missing path parameter' });
  }

  const url = `${baseUrl}${path}${path.includes('?') ? '&' : '?'}token=${token}`;

  try {
    const upstream = await fetch(url, {
      method: req.method,
      headers: { 'Content-Type': 'application/json' },
      ...(req.method === 'POST' && req.body ? { body: JSON.stringify(req.body) } : {}),
    });

    const data = await upstream.json().catch(() => ({}));
    return res.status(upstream.status).json(data);
  } catch (e) {
    return res.status(502).json({ error: 'ND API unreachable', detail: (e as Error).message });
  }
}
