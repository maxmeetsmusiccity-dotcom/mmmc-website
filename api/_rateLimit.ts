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

let redis: InstanceType<typeof Redis> | null = null;
let limiters: {
  strict: InstanceType<typeof Ratelimit>;
  moderate: InstanceType<typeof Ratelimit>;
  relaxed: InstanceType<typeof Ratelimit>;
} | null = null;

try {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL.trim(),
      token: process.env.UPSTASH_REDIS_REST_TOKEN.trim(),
    });
    limiters = {
      strict: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, '60 s'), prefix: 'rl:strict' }),
      moderate: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, '60 s'), prefix: 'rl:moderate' }),
      relaxed: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, '60 s'), prefix: 'rl:relaxed' }),
    };
  }
} catch (e) {
  console.error('[rate-limit] Failed to initialize Upstash Redis:', e);
  // Fall back to permissive (no rate limiting)
}

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

  try {
    const limiter = maxRequests <= 5 ? limiters.strict
      : maxRequests <= 20 ? limiters.moderate
      : limiters.relaxed;

    const { success } = await limiter.limit(key);
    return !success;
  } catch {
    return false; // If Redis fails, allow the request
  }
}
