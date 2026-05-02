import type { VercelRequest, VercelResponse } from '@vercel/node';

const NMF_SAFE_PROFILE_PATHS = [
  '/api/profile/instagram',
  '/api/profile/search',
  '/api/profile/research-agent',
] as const;

const DENIED_PROFILE_PATH_PREFIXES = [
  '/api/profile/credit',
  '/api/profile/royalty',
  '/api/profile/private',
] as const;

const ALLOWED_PATH_PREFIXES = [
  '/api/nmf/browse',
  '/api/nmf/collaborators',
  '/api/nmf/instagram',
  '/api/nmf/releases',
  '/api/search',
  '/api/research/',
] as const;

const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const hourlyHits = new Map<string, number[]>();
const burstHits = new Map<string, number[]>();

function startsWithPath(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`);
}

export function isDeniedPath(path: string): boolean {
  return DENIED_PROFILE_PATH_PREFIXES.some((prefix) => startsWithPath(path, prefix));
}

export function isAllowedPath(path: string): boolean {
  if (isDeniedPath(path)) return false;
  if (NMF_SAFE_PROFILE_PATHS.some((prefix) => startsWithPath(path, prefix))) {
    return true;
  }
  if (path.startsWith('/api/profile/')) return false;
  return ALLOWED_PATH_PREFIXES.some((prefix) => startsWithPath(path, prefix));
}

function clientIp(req: VercelRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  if (Array.isArray(forwarded)) return forwarded[0]?.split(',')[0]?.trim() ?? 'unknown';
  return req.socket?.remoteAddress ?? 'unknown';
}

function recordHit(
  store: Map<string, number[]>,
  key: string,
  now: number,
  windowMs: number,
  maxHits: number
): boolean {
  const hits = (store.get(key) ?? []).filter((ts) => now - ts < windowMs);
  hits.push(now);
  store.set(key, hits);
  return hits.length > maxHits;
}

export function resetProxyRateLimitForTests(): void {
  hourlyHits.clear();
  burstHits.clear();
}

export function isProxyRateLimited(ip: string, now = Date.now()): boolean {
  const hourlyLimited = recordHit(hourlyHits, ip, now, HOUR_MS, 60);
  const burstLimited = recordHit(burstHits, ip, now, MINUTE_MS, 10);
  return hourlyLimited || burstLimited;
}

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

  if (!isAllowedPath(path)) {
    return res.status(403).json({ error: 'Path not allowed' });
  }

  if (isProxyRateLimited(clientIp(req))) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
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
