import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { IntelligenceAccumulator, emitIntelligence, extractComposerCandidates, splitPerformerCreditString, type CollaborationSignal, type AppleRejection } from './_scan_intelligence.js';
import { runHealthProbe } from './scan-health.js';
import { alertSlack } from './_alert.js';

// Daily Apple-only fresh-release scan (M-Z12).
// Target window: the last 48h of releases. Paired with the weekly full-universe
// scan (cron-scan-weekly) — weekly drives the ~38K-artist breadth; daily closes
// the latency gap for hits that land between weekly runs.
//
// Apple-only on purpose: Spotify's client_credentials quota is shared with the
// weekly scan and historically re-poisons within 12 min of continuous hammering.
// Daily staying Apple-only keeps the Spotify budget clean for weekly + search-
// apple ISRC verification. If Apple fails for an artist, the failure is logged
// and the scan moves on — no silent Spotify fallback (by policy).
//
// Schedule: 0 9 * * *  (09:00 UTC / 04:00 CT) — after overnight Apple catalog
// publication, before business-hour traffic in North America.

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ND_API_BASE = process.env.ND_API_BASE_URL || '';
const ND_AUTH_SECRET = process.env.ND_AUTH_TOKEN_SECRET || '';

async function generateApiToken(): Promise<string> {
  const ts = Date.now().toString();
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(ND_AUTH_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode('api-access:' + ts));
  return ts + ':' + [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}

const SEED_ARTISTS = [
  'Lainey Wilson', 'Morgan Wallen', 'Luke Combs', 'Chris Stapleton', 'Zach Bryan',
  'Jelly Roll', 'Bailey Zimmerman', 'Cody Johnson', 'Kane Brown', 'Megan Moroney',
  'Parker McCollum', 'Jordan Davis', 'Riley Green', 'Thomas Rhett', 'Keith Urban',
  'Carrie Underwood', 'Miranda Lambert', 'Luke Bryan', 'Jason Aldean', 'Dierks Bentley',
  'Ella Langley', 'Tucker Wetmore', 'Nate Smith', 'Shaboozey', 'Dasha',
  'Hailey Whitters', 'Muscadine Bloodline', 'Ian Munsick', 'Dalton Dover', 'Corey Kent',
  'Ashley McBryde', 'Kameron Marlowe', 'Chayce Beckham', 'Dylan Gossett',
];

function getYesterday(): string {
  const now = new Date();
  now.setDate(now.getDate() - 1);
  return now.toISOString().split('T')[0];
}

/**
 * True when the run should trigger a Slack alert.
 *   - >5% of attempted Apple batches failed
 *   - OR the run produced zero tracks despite scanning ≥10 artists
 */
export function shouldAlertOnDegradation(
  attemptedBatches: number,
  failedBatches: number,
  artistsScanned: number,
  tracksFound: number,
): { alert: boolean; reason?: string } {
  if (attemptedBatches > 0) {
    const failRate = failedBatches / attemptedBatches;
    if (failRate > 0.05) {
      return { alert: true, reason: `apple_failure_rate=${(failRate * 100).toFixed(1)}% (${failedBatches}/${attemptedBatches})` };
    }
  }
  if (artistsScanned >= 10 && tracksFound === 0) {
    return { alert: true, reason: `zero_tracks_across_${artistsScanned}_artists` };
  }
  return { alert: false };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const CRON_SECRET = process.env.CRON_SECRET;
  if (!CRON_SECRET) {
    console.error('[DAILY] CRON_SECRET not configured — refusing to run');
    return res.status(500).json({ error: 'Server misconfigured' });
  }
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ error: 'Server misconfigured' });
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  const scanDate = getYesterday();
  const maxChains = Math.min(parseInt(req.query.max_chains as string || '5', 10), 10);
  const chainNum = parseInt(req.query.chain as string || '0', 10);
  const skipPreflight = req.query.skip_preflight === '1';

  // Preflight (chain 0 only) — same rule as weekly: Apple 429 = abort.
  if (chainNum === 0 && !skipPreflight) {
    try {
      const health = await runHealthProbe();
      if (!health.apple_ok) {
        console.error('[DAILY] Pre-flight FAILED apple:', JSON.stringify(health.apple));
        await alertSlack('nmf_scan_daily: Apple pre-flight failed — aborting run', {
          apple_status: health.apple.status,
          apple_error: health.apple.error,
          retry_after_s: health.apple.retry_after_seconds,
        }).catch(() => {});
        return res.status(503).json({ status: 'preflight_aborted', apple: health.apple });
      }
    } catch (e) {
      console.error('[DAILY] Pre-flight threw:', e);
      return res.status(500).json({ status: 'preflight_error', error: (e as Error).message });
    }
  }

  // Artist universe — same R2 source as weekly, but we only take the first
  // BATCH_SIZE * maxChains artists per day (top of the priority order is seeds
  // + most-monitored universe members).
  let artistNames: string[] = SEED_ARTISTS;
  const universeNormSet = new Set<string>();
  const normName = (s: string): string => s ? s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim() : '';
  try {
    if (ND_API_BASE && ND_AUTH_SECRET) {
      const apiToken = await generateApiToken();
      const r2Resp = await fetch(`${ND_API_BASE}/api/r2?key=browse_artists.json`, {
        headers: { 'Content-Type': 'application/json', 'X-ND-Token': apiToken },
      });
      if (r2Resp.ok) {
        const r2Data = await r2Resp.json();
        const names = new Set<string>();
        for (const a of (r2Data.artists || [])) { names.add(a.name); universeNormSet.add(normName(a.name)); }
        if (Array.isArray(r2Data.categories)) {
          for (const cat of r2Data.categories) {
            for (const a of (cat.artists || [])) { names.add(a.name); universeNormSet.add(normName(a.name)); }
          }
        }
        if (names.size > 0) artistNames = [...names];
      }
    }
  } catch { /* fall back to seeds */ }
  const seedLower = new Set(SEED_ARTISTS.map(n => n.toLowerCase()));
  artistNames = [...SEED_ARTISTS, ...artistNames.filter(n => !seedLower.has(n.toLowerCase()))];
  console.log(`[DAILY] universe=${artistNames.length} (seeds=${SEED_ARTISTS.length})`);

  const intel = new IntelligenceAccumulator();
  function recordFromTrack(t: any) {
    const performers = splitPerformerCreditString(t.artist_names || '');
    const composers = splitPerformerCreditString(t.composer_name || '');
    const seen = new Set<string>();
    const participants: CollaborationSignal['participants'] = [];
    for (const p of performers) {
      const n = normName(p);
      if (!n || seen.has(n) || !universeNormSet.has(n)) continue;
      seen.add(n);
      participants.push({ name: p, role: participants.length === 0 ? 'primary_performer' : 'feature' });
    }
    for (const c of composers) {
      const n = normName(c);
      if (!n || seen.has(n) || !universeNormSet.has(n)) continue;
      seen.add(n);
      participants.push({ name: c, role: 'composer_credit' });
    }
    if (participants.length >= 2) {
      intel.recordCollaboration({
        track_id: t.track_id, track_name: t.track_name,
        album_name: t.album_name || null, release_date: t.release_date || null,
        source: 'apple', participants,
        raw_artist_string: t.artist_names || undefined,
        raw_composer_string: t.composer_name || undefined,
      });
    }
    const primary = performers[0] || '';
    if (primary) intel.recordTrack(primary, null, t.release_date || null, t.album_spotify_id || null);
  }

  // Observability
  let scanRunId: number | null = null;
  const chainStart = Date.now();
  const BATCH_SIZE = 200;
  const startIdx = parseInt((req.query.offset as string) || String(chainNum * BATCH_SIZE), 10);
  const endIdx = Math.min(startIdx + BATCH_SIZE, artistNames.length, maxChains * BATCH_SIZE);
  const batch = artistNames.slice(startIdx, endIdx);
  try {
    const { data } = await supabase.from('scan_runs').insert({
      target_week: scanDate, chain_number: chainNum, total_chains: maxChains,
      start_offset: startIdx, status: 'running',
    }).select('id').single();
    scanRunId = data?.id || null;
  } catch { /* table may not yet accept daily runs — ignore */ }

  const scanBaseUrl = process.env.SCAN_BASE_URL || 'https://newmusicfriday.app';
  const bearer = `Bearer ${process.env.SCAN_SECRET || ''}`;
  const batchSize = 50;
  let appleTracks = 0;
  let attemptedBatches = 0;
  let failedBatches = 0;

  for (let i = 0; i < batch.length; i += batchSize) {
    const chunk = batch.slice(i, i + batchSize);
    attemptedBatches++;
    try {
      const resp = await fetch(`${scanBaseUrl}/api/search-apple`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': bearer },
        // daysBack=2 narrows to last 48h per M-Z12 spec
        body: JSON.stringify({ artistNames: chunk, daysBack: 2, targetFriday: scanDate }),
      });
      if (resp.ok) {
        const data = await resp.json();
        const tracks = data.tracks || [];
        appleTracks += tracks.length;
        for (const t of tracks) {
          recordFromTrack(t);
          const composers = extractComposerCandidates(t.composer_name);
          if (composers.length > 0) {
            intel.recordAppleComposerCredit({
              track_id: t.track_id,
              track_name: t.track_name,
              primary_artist_id: t.artist_id || null,
              primary_artist_name: t.artist_names || '',
              composer_names: composers,
              source: 'apple_composer_field',
              release_date: t.release_date || null,
            });
          }
        }
        const rejections = (data.apple_rejections || []) as AppleRejection[];
        for (const r of rejections) intel.recordAppleRejection(r);
        if (tracks.length > 0) {
          const rows = tracks.map((t: any) => {
            const row: Record<string, any> = {
              scan_week: scanDate,
              spotify_artist_id: t.artist_id || t.apple_music_id || null,
              artist_name: t.artist_names || t.artist_name,
              track_id: t.track_id || t.isrc || `apple_${t.track_name}_${t.artist_names}`.replace(/\s/g, '_'),
              track_name: t.track_name,
              album_name: t.album_name,
              album_id: t.album_id || null,
              album_type: t.album_type || 'single',
              release_date: t.release_date,
              cover_art_640: t.cover_art_640 || t.artwork_url || null,
              cover_art_300: t.cover_art_300 || null,
              track_number: t.track_number || 1,
              duration_ms: t.duration_ms || 0,
              explicit: t.explicit || false,
              total_tracks: t.total_tracks || 1,
              spotify_url: null,
            };
            if (t.composer_name) row.composer_name = t.composer_name;
            return row;
          });
          await supabase.from('weekly_nashville_releases').upsert(rows, { onConflict: 'scan_week,track_id' });
        }
      } else {
        failedBatches++;
        console.error(`[DAILY] Apple batch ${startIdx + i} returned ${resp.status}`);
      }
    } catch (e) {
      failedBatches++;
      console.error(`[DAILY] Apple batch ${startIdx + i} failed:`, e);
    }
  }

  const degradation = shouldAlertOnDegradation(attemptedBatches, failedBatches, batch.length, appleTracks);
  if (degradation.alert) {
    alertSlack('nmf_scan_daily: degradation detected', {
      chain: chainNum, scan_date: scanDate,
      attempted_batches: attemptedBatches, failed_batches: failedBatches,
      artists_scanned: batch.length, tracks_found: appleTracks,
      reason: degradation.reason,
    }).catch(() => {});
  }

  const isComplete = endIdx >= artistNames.length || endIdx >= maxChains * BATCH_SIZE;
  const chainsRemaining = maxChains - chainNum - 1;
  let chainStatus: 'complete' | 'chaining' | 'paused_at_chain_limit' | 'chain_failed' = 'complete';

  if (!isComplete && chainsRemaining > 0) {
    const nextChain = chainNum + 1;
    const nextUrl = `${scanBaseUrl}/api/cron-scan-daily?offset=${endIdx}&max_chains=${maxChains}&chain=${nextChain}`;
    console.log(`[DAILY] Pacing: sleeping 15s before chain ${nextChain}`);
    await new Promise(r => setTimeout(r, 15000));
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 3000);
    try {
      await fetch(nextUrl, { method: 'GET', headers: { 'Authorization': `Bearer ${CRON_SECRET}` }, signal: ctrl.signal });
      chainStatus = 'chaining';
    } catch (e) {
      chainStatus = (e as Error).name === 'AbortError' ? 'chaining' : 'chain_failed';
    }
  } else if (!isComplete) {
    chainStatus = 'paused_at_chain_limit';
  }

  if (scanRunId) {
    await supabase.from('scan_runs').update({
      artists_scanned: batch.length,
      tracks_found: appleTracks,
      composer_credits_found: appleTracks,
      duration_ms: Date.now() - chainStart,
      status: chainStatus,
    }).eq('id', scanRunId);
  }

  let intelRowId: number | undefined;
  try {
    const artifact = intel.build({
      scan_week: scanDate,
      scanner: 'nmf_daily_cron',
      scope: {
        universe_source: 'r2://nd-profiles/browse_artists.json',
        artists_input: batch.length,
        artists_with_releases: 0,
        tracks_found: appleTracks,
      },
      notes: `daily chain ${chainNum}/${maxChains} offset=${startIdx}-${endIdx}`,
    });
    const emit = await emitIntelligence(artifact);
    if (emit.ok) intelRowId = emit.rowId;
  } catch (e) {
    console.error('[DAILY] scan_intelligence emit threw:', e);
  }

  return res.status(200).json({
    status: chainStatus,
    scan_date: scanDate,
    chain: chainNum,
    max_chains: maxChains,
    artists_scanned: batch.length,
    apple_tracks: appleTracks,
    attempted_batches: attemptedBatches,
    failed_batches: failedBatches,
    alert_fired: degradation.alert,
    alert_reason: degradation.reason || null,
    range: `${startIdx}-${endIdx} of ${artistNames.length}`,
    intel_row_id: intelRowId ?? null,
    next: isComplete ? null : `/api/cron-scan-daily?offset=${endIdx}&max_chains=${maxChains}&chain=${chainNum + 1}`,
  });
}
