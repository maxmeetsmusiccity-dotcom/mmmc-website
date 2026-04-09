import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.json({
    hasApify: !!process.env.APIFY_TOKEN,
    apifyLen: (process.env.APIFY_TOKEN || '').length,
    hasSupabase: !!process.env.VITE_SUPABASE_URL,
    hasScanSecret: !!process.env.SCAN_SECRET,
    hasUpstash: !!process.env.UPSTASH_REDIS_REST_URL,
  });
}
