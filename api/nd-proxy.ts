import type { VercelRequest, VercelResponse } from '@vercel/node';

// Strict whitelist — only NMF-safe endpoints allowed through the proxy
const ALLOWED_PATH_PREFIXES = [
  '/api/nmf/browse',
  '/api/nmf/collaborators',
  '/api/nmf/instagram',
  '/api/nmf/releases',
  '/api/search',
  '/api/profile/',
  '/api/research/',
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // ── Path validation (BEFORE any proxy logic) ──
  const path = req.query.path as string;
  if (!path || typeof path !== 'string') {
    return res.status(400).json({ error: 'Missing path parameter' });
  }

  // Block path traversal attempts — decode first to catch %2e%2e etc.
  const decoded = decodeURIComponent(path);
  if (decoded.includes('..') || decoded.includes('//') || decoded.includes('\\')) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Whitelist check — path must start with an allowed prefix
  const isAllowed = ALLOWED_PATH_PREFIXES.some(p => path.startsWith(p));
  if (!isAllowed) {
    return res.status(403).json({ error: 'Path not allowed' });
  }

  // ── Proxy logic ──
  const baseUrl = process.env.ND_API_BASE_URL;
  const secret = process.env.ND_AUTH_TOKEN_SECRET;
  const username = process.env.ND_AUTH_USERNAME;

  if (!baseUrl || !secret || !username) {
    return res.status(500).json({ error: 'ND API not configured' });
  }

  // Generate api-access HMAC token (matches Workers auth middleware format)
  const ts = Date.now().toString();
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode('api-access:' + ts));
  const token = ts + ':' + [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');

  const url = `${baseUrl}${path}`;

  try {
    const upstream = await fetch(url, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'X-ND-Token': token,
      },
      ...(req.method === 'POST' && req.body ? { body: JSON.stringify(req.body) } : {}),
    });

    const data = await upstream.json().catch(() => ({}));
    return res.status(upstream.status).json(data);
  } catch (e) {
    console.error('[nd-proxy] Error:', e);
    return res.status(502).json({ error: 'Upstream API unreachable' });
  }
}
