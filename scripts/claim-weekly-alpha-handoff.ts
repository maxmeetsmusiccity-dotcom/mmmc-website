#!/usr/bin/env node
/**
 * Weekly Alpha handoff — writer_claim_submission review.
 *
 * Called by the Vercel cron defined in vercel.json. Pulls new submissions
 * (alpha_reviewed_at IS NULL) and writes a markdown handoff memo to the
 * cross_thread/ dir (via file system if local, or Supabase Storage if prod —
 * for now, local file write + logged URL; future: Slack/email drop).
 *
 * Wire up:
 *   - Cron entry: { "path": "/api/cron-claim-review", "schedule": "0 14 * * 1" }
 *     (Monday 14:00 UTC = 09:00 CT)
 *   - The cron endpoint (api/cron-claim-review.ts) imports this module and
 *     invokes runWeeklyReview().
 *
 * Usage (manual / CI):
 *   npx tsx scripts/claim-weekly-alpha-handoff.ts
 */

import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const HANDOFF_DIR = process.env.CLAIM_HANDOFF_DIR
  || join(process.env.HOME || '.', 'Projects/cowritecompass/cross_thread');

interface ClaimSubmission {
  id: string;
  pg_id: string;
  submitted_at: string;
  submission_ip: string | null;
  confirmed_instagram_handle: string | null;
  corrected_instagram_handle: string | null;
  notes: string | null;
}

export async function runWeeklyReview(): Promise<{
  ok: boolean;
  handoff_path?: string;
  submission_count: number;
  error?: string;
}> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return { ok: false, submission_count: 0, error: 'Supabase env missing' };
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data, error } = await supabase
    .from('writer_claim_submission')
    .select(
      'id, pg_id, submitted_at, submission_ip, confirmed_instagram_handle, '
      + 'corrected_instagram_handle, notes',
    )
    .is('alpha_reviewed_at', null)
    .order('submitted_at', { ascending: true });

  if (error) {
    return { ok: false, submission_count: 0, error: JSON.stringify(error) };
  }

  const submissions = (data ?? []) as unknown as ClaimSubmission[];
  const now = new Date();
  const weekTag = weekIsoTag(now);
  const filename = `from_zeta_to_alpha__writer_claim_submissions_${weekTag}__${ts(now)}.md`;
  const body = buildMarkdown(submissions, weekTag, now);

  mkdirSync(HANDOFF_DIR, { recursive: true });
  const path = join(HANDOFF_DIR, filename);
  writeFileSync(path, body, 'utf-8');

  return { ok: true, handoff_path: path, submission_count: submissions.length };
}

function buildMarkdown(
  subs: ClaimSubmission[],
  weekTag: string,
  now: Date,
): string {
  const header = [
    '---',
    'from: zeta',
    'to: alpha',
    `subject: Writer-claim submissions ${weekTag}`,
    `ts: ${now.toISOString()}`,
    '---',
    '',
    `# Writer-claim submissions · ${weekTag}`,
    '',
    `Total new submissions (alpha_reviewed_at IS NULL): **${subs.length}**`,
    '',
    'Red-zone discipline reminder: the flow is gated to Max\'s inbox '
    + '(REAL_WRITER_SENDS_AUTHORIZED=false by default). Any non-Max submission '
    + 'is either (a) Max testing against the QA URL, or (b) a real writer Max '
    + 'explicitly greenlit for the current wave.',
    '',
  ].join('\n');

  if (!subs.length) {
    return header + 'No new submissions this cycle.\n';
  }

  const rows = subs.map((s) => [
    `## ${s.pg_id} · ${new Date(s.submitted_at).toISOString()}`,
    '',
    `- submission_id: \`${s.id}\``,
    `- confirmed_instagram_handle: \`${s.confirmed_instagram_handle || '(none)'}\``,
    `- corrected_instagram_handle: \`${s.corrected_instagram_handle || '(none)'}\``,
    `- submission_ip: \`${s.submission_ip || '(unknown)'}\``,
    s.notes ? `- notes:\n\n  > ${s.notes.split('\n').join('\n  > ')}` : '- notes: (none)',
    '',
  ].join('\n'));

  const footer = [
    '---',
    '',
    '## Review actions (Alpha)',
    '',
    '1. For each submission, inspect the confirmed/corrected handle against '
    + '`dim_instagram_handle_v1` and `project_music_row_ig_is_ssot_for_signings`.',
    '2. If handle matches existing: mark `alpha_review_decision=promoted`.',
    '3. If handle differs from dim_ (writer correction): cross-ref with '
    + '`feedback_social_handle_trust` (writer self-report BEATS MB/Wikidata/LLM).',
    '4. Update `writer_claim_submission.alpha_reviewed_at = now()` to close the loop.',
    '',
    '— Zeta · weekly cron',
    '',
  ].join('\n');

  return header + rows.join('\n') + '\n' + footer;
}

function ts(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}`;
}

function weekIsoTag(d: Date): string {
  // ISO week: YYYY-Www. Simple approximation that's good enough for weekly cron naming.
  const day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayOfWeek = day.getUTCDay() || 7;
  day.setUTCDate(day.getUTCDate() + 4 - dayOfWeek);
  const yearStart = new Date(Date.UTC(day.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((day.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${day.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

// CLI entry point.
const invokedDirectly = process.argv[1]?.endsWith('claim-weekly-alpha-handoff.ts')
  || process.argv[1]?.endsWith('claim-weekly-alpha-handoff.js');
if (invokedDirectly) {
  runWeeklyReview().then((result) => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.ok ? 0 : 1);
  });
}
