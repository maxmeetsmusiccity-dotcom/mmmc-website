import type { VercelRequest, VercelResponse } from '@vercel/node';
import { runWeeklyReview } from '../scripts/claim-weekly-alpha-handoff.js';

/**
 * GET /api/cron-claim-review
 *
 * Weekly cron that compiles new writer_claim_submission rows into a markdown
 * memo for Alpha review. Auth via CRON_SECRET bearer header (Vercel adds
 * this automatically for scheduled invocations via vercel.json crons).
 *
 * Note: the file-system write goes to /tmp inside a Vercel Function; the
 * memo is also returned in the HTTP response body so it can be captured by
 * the invoker (Alpha poller OR Max-triggered manual curl) and forwarded to
 * the real cross_thread/ path. For production, re-aiming the memo at
 * Supabase Storage is a future step.
 */

const CRON_SECRET = process.env.CRON_SECRET || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'GET/POST only' });
  }
  // Vercel cron sends `Authorization: Bearer ${CRON_SECRET}` when configured.
  if (CRON_SECRET) {
    const auth = req.headers.authorization || '';
    if (auth !== `Bearer ${CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }
  // In a Vercel Function the cross_thread/ path isn't writable; emit to /tmp
  // and return the memo body so downstream tooling can relay it.
  process.env.CLAIM_HANDOFF_DIR = '/tmp';

  try {
    const result = await runWeeklyReview();
    return res.status(result.ok ? 200 : 500).json(result);
  } catch (e) {
    console.error('[cron-claim-review] exception:', e);
    return res.status(500).json({
      ok: false,
      error: e instanceof Error ? e.message : 'unknown',
    });
  }
}
