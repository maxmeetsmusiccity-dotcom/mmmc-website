// Post-flight cron — fires ~90 minutes after the weekly scan.
//
// Verifies the scan actually produced data. Catches the April 11-16 class of
// silent failure (cron fired, scan_runs logged chain iterations, but 0 tracks
// written because tokens were 401'd).
//
// Checks:
//   1. weekly_nashville_releases has ≥ 200 rows for this week (runbook §4)
//   2. scan_metadata.status = 'complete'
//   3. At least one nmf_scan_intelligence row emitted this week (R13 loop)
//   4. No scan_runs chain with tracks_found=0 AND duration_ms<5000 (that
//      signature = rate-limit-induced silent failure)
//
// On failure: alert Slack + 503. On success: 200.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { alertSlack } from './_alert.js';
import { recordAuditEvent } from './_audit.js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const MIN_RELEASES_PER_WEEK = 200;

function getLastFriday(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = day >= 5 ? day - 5 : day + 2;
  const friday = new Date(now);
  friday.setDate(now.getDate() - diff);
  return friday.toISOString().split('T')[0];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const CRON_SECRET = process.env.CRON_SECRET;
  if (!CRON_SECRET) {
    await recordAuditEvent(req, {
      action: 'nmf.cron.postflight',
      outcome: 'skipped',
      status: 500,
      metadata: { reason: 'cron_secret_missing' },
    });
    return res.status(500).json({ error: 'CRON_SECRET not configured' });
  }
  if (req.headers.authorization !== `Bearer ${CRON_SECRET}`) {
    await recordAuditEvent(req, {
      action: 'nmf.cron.postflight',
      outcome: 'unauthorized',
      status: 401,
    });
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    await recordAuditEvent(req, {
      action: 'nmf.cron.postflight',
      outcome: 'skipped',
      status: 500,
      metadata: { reason: 'supabase_config_missing' },
    });
    return res.status(500).json({ error: 'Supabase not configured' });
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  const weekDate = (req.query.week as string) || getLastFriday();
  const failures: Array<{ check: string; detail: unknown }> = [];

  // 1. Release count
  const { count: releaseCount } = await supabase
    .from('weekly_nashville_releases')
    .select('*', { count: 'exact', head: true })
    .eq('scan_week', weekDate);
  if ((releaseCount || 0) < MIN_RELEASES_PER_WEEK) {
    failures.push({ check: 'release_count', detail: { count: releaseCount, min: MIN_RELEASES_PER_WEEK, week: weekDate } });
  }

  // 2. scan_metadata.status
  const { data: meta } = await supabase
    .from('scan_metadata')
    .select('status, last_scan_week, last_scan_at, r2_generated_at')
    .eq('id', 'nashville_weekly')
    .maybeSingle();
  if (meta?.status !== 'complete') {
    failures.push({ check: 'scan_metadata_status', detail: meta });
  }
  if (meta?.last_scan_week !== weekDate) {
    failures.push({ check: 'scan_metadata_week_mismatch', detail: { expected: weekDate, got: meta?.last_scan_week } });
  }

  // 3. Intelligence emitted
  const { count: intelCount } = await supabase
    .from('nmf_scan_intelligence')
    .select('*', { count: 'exact', head: true })
    .eq('scan_week', weekDate);
  if ((intelCount || 0) === 0) {
    failures.push({ check: 'intel_emission', detail: { week: weekDate, rows_emitted: intelCount } });
  }

  // 4. Silent-failure chains: tracks_found=0 AND duration_ms<5000
  const { data: silentChains } = await supabase
    .from('scan_runs')
    .select('chain_number, tracks_found, duration_ms, status, run_date')
    .eq('target_week', weekDate)
    .eq('tracks_found', 0)
    .lt('duration_ms', 5000);
  if (silentChains && silentChains.length > 0) {
    failures.push({ check: 'silent_failure_chains', detail: { count: silentChains.length, examples: silentChains.slice(0, 5) } });
  }

  const report = {
    ok: failures.length === 0,
    checked_at: new Date().toISOString(),
    week: weekDate,
    release_count: releaseCount,
    intel_rows: intelCount,
    scan_metadata: meta,
    failures,
  };

  if (failures.length > 0) {
    await alertSlack(`NMF Post-flight FAILED for ${weekDate}`, report).catch(() => {});
    await recordAuditEvent(req, {
      action: 'nmf.cron.postflight',
      outcome: 'failure',
      status: 503,
      metadata: {
        week: weekDate,
        release_count: releaseCount,
        intel_rows: intelCount,
        failure_checks: failures.map(f => f.check),
      },
    });
    return res.status(503).json(report);
  }
  await recordAuditEvent(req, {
    action: 'nmf.cron.postflight',
    outcome: 'success',
    status: 200,
    metadata: { week: weekDate, release_count: releaseCount, intel_rows: intelCount },
  });
  return res.status(200).json(report);
}
