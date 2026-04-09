import type { VercelRequest } from '@vercel/node';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

/**
 * Persistent rate limiter using Upstash Redis.
 * Shared across all serverless instances — a request counted on one
 * instance is visible to all others. Prevents API abuse.
 *
 * Falls back to permissive (no blocking) if Upstash is not configured.
 */

const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null;

// Pre-built limiters for different endpoint tiers
const limiters = redis ? {
  strict: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, '60 s'), prefix: 'rl:strict' }),
  moderate: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, '60 s'), prefix: 'rl:moderate' }),
  relaxed: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, '60 s'), prefix: 'rl:relaxed' }),
} : null;

export function getClientIp(req: VercelRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

/**
 * Returns true if the request should be BLOCKED (rate exceeded).
 * Uses Upstash Redis sliding window if configured, otherwise allows all.
 */
export async function isRateLimited(key: string, maxRequests: number, _windowMs: number): Promise<boolean> {
  if (!limiters) return false; // No Redis = no rate limiting (dev/fallback)

  // Pick the limiter tier based on maxRequests
  const limiter = maxRequests <= 5 ? limiters.strict
    : maxRequests <= 20 ? limiters.moderate
    : limiters.relaxed;

  const { success } = await limiter.limit(key);
  return !success; // limit() returns success=true if allowed, we return true if BLOCKED
}
