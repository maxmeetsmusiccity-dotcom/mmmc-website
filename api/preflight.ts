// Pre-flight cron — fires 30 minutes before the weekly scan.
//
// The April 17 2026 incident wasn't the scan breaking — it was six days of
// zero-track cron runs going unnoticed. Pre-flight is the early-warning: if
// any required system is unhealthy BEFORE the scan fires, alert and refuse.
//
// Checks (runbook doc §4):
//   1. Both Spotify and Apple tokens healthy (runHealthProbe — scan hot path)
//   2. R2 universe loads and has ≥ 5000 artists
//   3. artist_platform_ids cache has ≥ 5000 rows with apple_artist_id (else
//      the scan will search every artist and almost certainly timeout)
//   4. scan_metadata.status NOT stuck in 'scanning' from a prior failed run
//
// On failure: alert Slack + return 503. On success: return 200.
// Auth: Vercel cron hits with `Authorization: Bearer $CRON_SECRET`.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { runHealthProbe } from './scan-health.js';
import { alertSlack } from './_alert.js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ND_API_BASE = process.env.ND_API_BASE_URL || '';
const ND_AUTH_SECRET = process.env.ND_AUTH_TOKEN_SECRET || '';

const MIN_UNIVERSE_ARTISTS = 5000;
const MIN_APPLE_CACHE_ROWS = 5000;

async function generateNdApiToken(): Promise<string> {
  const ts = Date.now().toString();
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(ND_AUTH_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode('api-access:' + ts));
  return ts + ':' + [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const CRON_SECRET = process.env.CRON_SECRET;
  if (!CRON_SECRET) return res.status(500).json({ error: 'CRON_SECRET not configured' });
  if (req.headers.authorization !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ error: 'Supabase not configured' });
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  const failures: Array<{ check: string; detail: unknown }> = [];
  const started = Date.now();

  // 1. Token health
  const health = await runHealthProbe();
  if (!health.spotify_ok) failures.push({ check: 'spotify_token', detail: health.spotify });
  if (!health.apple_ok) failures.push({ check: 'apple_token', detail: health.apple });

  // 2. R2 universe
  let universeSize = 0;
  try {
    if (ND_API_BASE && ND_AUTH_SECRET) {
      const tok = await generateNdApiToken();
      const r = await fetch(`${ND_API_BASE}/api/r2?key=browse_artists.json`, {
        headers: { 'Content-Type': 'application/json', 'X-ND-Token': tok },
      });
      if (r.ok) {
        const data = await r.json();
        const names = new Set<string>();
        if (Array.isArray(data.artists)) for (const a of data.artists) names.add(a.name);
        if (Array.isArray(data.categories)) for (const c of data.categories) if (Array.isArray(c.artists)) for (const a of c.artists) names.add(a.name);
        universeSize = names.size;
      } else {
        failures.push({ check: 'r2_universe', detail: { http_status: r.status } });
      }
    } else {
      failures.push({ check: 'r2_universe', detail: 'ND_API_BASE_URL or ND_AUTH_TOKEN_SECRET not configured' });
    }
  } catch (e) {
    failures.push({ check: 'r2_universe', detail: (e as Error).message });
  }
  if (universeSize > 0 && universeSize < MIN_UNIVERSE_ARTISTS) {
    failures.push({ check: 'r2_universe_size', detail: { size: universeSize, min: MIN_UNIVERSE_ARTISTS } });
  }

  // 3. Cache populated
  const { count: appleCached } = await supabase
    .from('artist_platform_ids')
    .select('*', { count: 'exact', head: true })
    .not('apple_artist_id', 'is', null);
  if ((appleCached || 0) < MIN_APPLE_CACHE_ROWS) {
    failures.push({ check: 'cache_populated', detail: { apple_cached: appleCached, min: MIN_APPLE_CACHE_ROWS } });
  }

  // 4. scan_metadata not stuck
  const { data: meta } = await supabase
    .from('scan_metadata')
    .select('status, last_scan_at, last_scan_week')
    .eq('id', 'nashville_weekly')
    .maybeSingle();
  const status = meta?.status;
  if (status === 'scanning' || status === 'in_progress') {
    // A truly stuck run will show status='scanning' with stale last_scan_at.
    // Only alert if it's been stale > 6 hours — avoids false-positive alerts
    // when a scan is legitimately running during the pre-flight window (e.g.
    // if someone kicked a manual scan).
    const ageHours = meta?.last_scan_at ? (Date.now() - new Date(meta.last_scan_at).getTime()) / 3_600_000 : 999;
    if (ageHours > 6) failures.push({ check: 'scan_metadata_stuck', detail: { ...meta, age_hours: ageHours } });
  }

  const duration_ms = Date.now() - started;
  const report = {
    ok: failures.length === 0,
    checked_at: new Date().toISOString(),
    duration_ms,
    universe_size: universeSize,
    apple_cached: appleCached,
    scan_metadata_status: status,
    health,
    failures,
  };

  if (failures.length > 0) {
    await alertSlack('NMF Pre-flight FAILED', report).catch(() => {});
    return res.status(503).json(report);
  }
  return res.status(200).json(report);
}
