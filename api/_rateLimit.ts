import type { VercelRequest } from '@vercel/node';

/**
 * Simple in-memory rate limiter for serverless functions.
 * Not shared across instances, but blocks burst abuse from a single instance.
 * For persistent rate limiting, replace with Upstash Redis.
 */
const store = new Map<string, { count: number; reset: number }>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of store) {
    if (now > val.reset) store.delete(key);
  }
}, 5 * 60 * 1000);

export function getClientIp(req: VercelRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

/**
 * Returns true if the request should be BLOCKED (rate exceeded).
 * @param key - unique identifier (usually IP)
 * @param maxRequests - max requests per window
 * @param windowMs - window size in milliseconds
 */
export function isRateLimited(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.reset) {
    store.set(key, { count: 1, reset: now + windowMs });
    return false;
  }

  entry.count++;
  if (entry.count > maxRequests) return true;
  return false;
}
