import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { IntelligenceAccumulator, emitIntelligence, type CollaborationSignal, type AppleRejection } from './_scan_intelligence.js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
// R2 is private — fetch through Workers R2 binding with HMAC auth
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

/** Hardcoded seed list — used when R2 browse_artists.json doesn't exist */
const SEED_ARTISTS = [
  'Lainey Wilson', 'Morgan Wallen', 'Luke Combs', 'Chris Stapleton', 'Zach Bryan',
  'Jelly Roll', 'Bailey Zimmerman', 'Cody Johnson', 'Kane Brown', 'Megan Moroney',
  'Parker McCollum', 'Jordan Davis', 'Riley Green', 'Thomas Rhett', 'Keith Urban',
  'Carrie Underwood', 'Miranda Lambert', 'Luke Bryan', 'Jason Aldean', 'Dierks Bentley',
  'Ella Langley', 'Tucker Wetmore', 'Nate Smith', 'Shaboozey', 'Dasha',
  'Hailey Whitters', 'Muscadine Bloodline', 'Ian Munsick', 'Dalton Dover', 'Corey Kent',
  'Ashley McBryde', 'Kameron Marlowe', 'Chayce Beckham', 'Dylan Gossett',
  'Chloe Collins', 'Ella Boh', 'Kaylee Rose', 'Jordyn Shellhart', 'Madison Parks',
  'Callie Prince', 'Cassidy Daniels', 'Ashley Anne', 'Mackenzie Carpenter',
  'Tiera Kennedy', 'Danielle Bradbery', 'Sam Williams', 'Mason Ramsey', 'Sam Barber',
  'Alana Springsteen', 'Payton Smith', 'Tanner Adell', 'Tigirlily Gold',
  'Old Dominion', 'Brothers Osborne', 'Midland', 'Flatland Cavalry', 'Charley Crockett',
  'Tyler Childers', 'Sierra Ferrell', 'Colter Wall', 'Zach Top',
  'Walker Hayes', 'Mitchell Tenpenny', 'Chris Lane', 'Dylan Scott',
  'Kelsea Ballerini', 'Gabby Barrett', 'Lauren Alaina', 'Priscilla Block',
];

function getLastFriday(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = day >= 5 ? day - 5 : day + 2;
  const friday = new Date(now);
  friday.setDate(now.getDate() - diff);
  return friday.toISOString().split('T')[0];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // ── Auth: fail-closed, header-only (no query param secrets) ──
  const CRON_SECRET = process.env.CRON_SECRET;
  if (!CRON_SECRET) {
    console.error('[CRON] CRON_SECRET not configured — refusing to run');
    return res.status(500).json({ error: 'Server misconfigured' });
  }
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('[CRON] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured');
    return res.status(500).json({ error: 'Server misconfigured' });
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  // Allow overriding the week for dry-run testing (auth-gated via CRON_SECRET)
  const weekOverride = req.query.week as string | undefined;
  const weekDate = weekOverride && /^\d{4}-\d{2}-\d{2}$/.test(weekOverride) ? weekOverride : getLastFriday();

  // Self-chaining params — parsed early because metadata update depends on chainNum.
  // Default 25 chains × 300 artists = 7,500 artists (covers the showcase universe).
  // Cap at 30 to allow room for non-cron callers expanding scope explicitly.
  const maxChains = Math.min(parseInt(req.query.max_chains as string || '25', 10), 30);
  const chainNum = parseInt(req.query.chain as string || '0', 10);

  // scan_metadata upsert moved below the R2 fetch so we can record the R2
  // generated_at alongside the other fields in a single write.

  // Observability: measure chain duration from here (includes R2 load + self-heal lookup)
  const chainStartMs = Date.now();
  let scanRunId: number | null = null;

  // Try to load artist list from R2
  let artistNames: string[] = SEED_ARTISTS;
  let r2GeneratedAt: string | null = null;
  // Normalized lowercase name set — used during collaboration-signal extraction
  // to check whether a composer / featured performer is in the Nashville
  // universe. Accent-stripped for robust matching.
  const universeNormSet = new Set<string>();
  const normName = (s: string): string => {
    if (!s) return '';
    return s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  };
  try {
    const apiToken = ND_API_BASE && ND_AUTH_SECRET ? await generateApiToken() : '';
    const r2Url = apiToken ? `${ND_API_BASE}/api/r2?key=browse_artists.json` : '';
    const r2Resp = r2Url ? await fetch(r2Url, { headers: { 'Content-Type': 'application/json', 'X-ND-Token': apiToken } }) : { ok: false, json: async () => ({}) };
    if (r2Resp.ok) {
      const r2Data = await r2Resp.json();
      if (typeof r2Data.generated_at === 'string') r2GeneratedAt = r2Data.generated_at;
      const names = new Set<string>();
      if (r2Data.artists && r2Data.artists.length > 0) {
        for (const a of r2Data.artists) { names.add(a.name); universeNormSet.add(normName(a.name)); }
      }
      if (Array.isArray(r2Data.categories)) {
        for (const cat of r2Data.categories) {
          if (Array.isArray(cat.artists)) {
            for (const a of cat.artists) { names.add(a.name); universeNormSet.add(normName(a.name)); }
          }
        }
      }
      if (names.size > 0) {
        artistNames = [...names];
        console.log(`[CRON] Loaded ${artistNames.length} artists from R2 (generated_at=${r2GeneratedAt || 'unknown'}, universe_norm_set=${universeNormSet.size})`);
      }
    }
  } catch { console.log('[CRON] R2 not available, using seed list'); }

  // Scan intelligence accumulator — R13. Every track scanned contributes to
  // release velocity; every Apple composer credit / multi-artist performer
  // credit contributes to collaboration signals. Emitted at end of chain.
  const intel = new IntelligenceAccumulator();

  /** Split a comma / feat / ft / & / x — separated credit string into names. */
  function splitCreditString(s: string): string[] {
    if (!s) return [];
    return s
      .split(/,|\bfeat\.?\b|\bft\.?\b|\bwith\b|\bx\b|\band\b|&/gi)
      .map(n => n.trim())
      .filter(n => n.length > 0);
  }

  /** Extract collaboration signals from one track and record to accumulator.
   *  A signal fires when 2+ distinct names from the credit strings
   *  (performers + Apple composerName) are in the Nashville universe. */
  function recordCollaborationFromTrack(t: any, source: 'apple' | 'spotify') {
    const performers = splitCreditString(t.artist_names || '');
    const composers = splitCreditString(t.composer_name || '');
    const seen = new Set<string>();
    const participants: CollaborationSignal['participants'] = [];
    for (const p of performers) {
      const n = normName(p);
      if (!n || seen.has(n)) continue;
      if (universeNormSet.has(n)) {
        seen.add(n);
        participants.push({ name: p, role: participants.length === 0 ? 'primary_performer' : 'feature' });
      }
    }
    for (const c of composers) {
      const n = normName(c);
      if (!n || seen.has(n)) continue;
      if (universeNormSet.has(n)) {
        seen.add(n);
        participants.push({ name: c, role: 'composer_credit' });
      }
    }
    if (participants.length >= 2) {
      intel.recordCollaboration({
        track_id: t.track_id,
        track_name: t.track_name,
        album_name: t.album_name || null,
        release_date: t.release_date || null,
        source,
        participants,
        raw_artist_string: t.artist_names || undefined,
        raw_composer_string: t.composer_name || undefined,
      });
    }
    // Always record per-artist velocity
    const primary = performers[0] || '';
    if (primary) intel.recordTrack(primary, null, t.release_date || null, t.album_spotify_id || null);
  }

  // Initial scan_metadata upsert (first chain only). Records the R2 snapshot
  // timestamp so we can tell which R2 data this scan is based on. Falls back
  // to the same upsert without r2_generated_at if the column doesn't exist yet.
  // Schema migration (run once in Supabase):
  //   ALTER TABLE scan_metadata ADD COLUMN IF NOT EXISTS r2_generated_at timestamptz;
  if (chainNum === 0) {
    const baseMetadata: Record<string, any> = {
      id: 'nashville_weekly',
      last_scan_week: weekDate,
      last_scan_at: new Date().toISOString(),
      status: 'scanning',
      total_artists_scanned: 0,
      total_tracks_found: 0,
    };
    const withR2 = { ...baseMetadata, r2_generated_at: r2GeneratedAt };
    const first = await supabase.from('scan_metadata').upsert(withR2);
    if (first.error?.code === 'PGRST204') {
      // Column not yet migrated — fall back to base columns only
      await supabase.from('scan_metadata').upsert(baseMetadata);
      console.warn('[CRON] scan_metadata.r2_generated_at column missing — run migration');
    } else if (first.error) {
      console.error('[CRON] scan_metadata upsert error:', first.error);
    }
  }

  // Seed artists FIRST — they're the active Nashville performers most likely to release
  const seedSet = new Set(SEED_ARTISTS.map(n => n.toLowerCase()));
  const nonSeed = artistNames.filter(n => !seedSet.has(n.toLowerCase()));
  artistNames = [...SEED_ARTISTS, ...nonSeed];
  console.log(`[CRON] Total artists to scan: ${artistNames.length} (${SEED_ARTISTS.length} seed first)`);

  // Self-chaining: offset (or legacy start) — chainNum and maxChains parsed above
  let startIdx = parseInt((req.query.offset ?? req.query.start) as string || '0', 10);

  // Admin override: ?force_rescan=true skips self-healing and starts from 0
  const forceRescan = req.query.force_rescan === 'true' || req.query.force_rescan === '1';

  // Self-healing: if this is a fresh cron trigger (chain 0, no explicit offset)
  // and there's a paused/failed run from the last 24h, resume from there instead
  // of starting over from 0. Prevents wasted daily quota.
  // BUT: if R2 generated_at is newer than the paused run, R2 has been updated and
  // resuming would skip newly-added artists in the 0..resumeOffset range.
  const explicitOffset = req.query.offset !== undefined || req.query.start !== undefined;
  if (chainNum === 0 && !explicitOffset && !forceRescan) {
    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: recent } = await supabase
        .from('scan_runs')
        .select('target_week, chain_number, artists_scanned, status, run_date, start_offset')
        .gte('run_date', since)
        .in('status', ['paused_at_chain_limit', 'chain_failed'])
        .order('run_date', { ascending: false })
        .limit(1);
      const lastPaused = recent?.[0];
      if (lastPaused && lastPaused.target_week === weekDate && lastPaused.artists_scanned) {
        // Guard: if R2 data is newer than the paused run, force a full rescan.
        // Otherwise new artists prepended/inserted by Thread A get skipped.
        if (r2GeneratedAt && lastPaused.run_date && r2GeneratedAt > lastPaused.run_date) {
          console.log(`[CRON] Self-healing skipped: R2 generated_at=${r2GeneratedAt} is newer than last paused run ${lastPaused.run_date}. Starting from offset 0 to cover newly-added artists.`);
        } else {
          // Resume from where that chain actually started + what it managed to scan.
          // start_offset is written at chain start (below), so this is correct
          // regardless of whether the previous chain was triggered fresh, via
          // explicit offset query param, or via self-healing recovery.
          const resumeOffset = (lastPaused.start_offset ?? 0) + (lastPaused.artists_scanned || 0);
          startIdx = resumeOffset;
          console.log(`[CRON] Self-healing: resuming from offset ${startIdx} (last ${lastPaused.status}, prev chain started at ${lastPaused.start_offset ?? 0}, scanned ${lastPaused.artists_scanned})`);
        }
      }
    } catch (e) {
      console.warn('[CRON] Self-healing lookup failed, starting from 0:', e);
    }
  } else if (forceRescan && chainNum === 0) {
    console.log('[CRON] force_rescan=true — bypassing self-healing, starting from offset 0');
  }

  // Observability: log this chain's start NOW that startIdx is finalized.
  // Graceful if scan_runs table or start_offset column doesn't exist yet.
  try {
    const { data } = await supabase.from('scan_runs').insert({
      target_week: weekDate,
      chain_number: chainNum,
      total_chains: maxChains,
      start_offset: startIdx,
      status: 'running',
    }).select('id').single();
    scanRunId = data?.id || null;
  } catch { /* scan_runs table or start_offset column may not exist yet */ }

  // Smaller chains: 300 artists per chain fits comfortably under 300s Vercel timeout.
  // Apple runs first (must-have). Spotify is secondary and OFF by default because
  // the client_credentials app-level rate limit deterministically exhausts after
  // ~12 min of continuous hammering (chain 4 fails with 429 masquerading as
  // empty results). Pass ?include_spotify=true to opt back in once a sane
  // pacing/backoff strategy is in place.
  const includeSpotify = req.query.include_spotify === 'true' || req.query.include_spotify === '1';
  const BATCH_SIZE = 300;
  const endIdx = Math.min(startIdx + BATCH_SIZE, artistNames.length);
  const batch = artistNames.slice(startIdx, endIdx);

  console.log(`[CRON] Chain ${chainNum}/${maxChains}: scanning artists ${startIdx}-${endIdx} of ${artistNames.length} (include_spotify=${includeSpotify})`);

  // Call-granularity batches: scan-artists caps at 200, search-apple at 100.
  // Stay at 50 to keep per-call latency bounded and back-pressure smooth.
  const batchSize = 50;
  let appleTracks = 0;
  let spotifyTracks = 0;
  let scanned = 0;
  // Internal API base — never trust req.headers.host (spoofable)
  const scanBaseUrl = process.env.SCAN_BASE_URL || 'https://maxmeetsmusiccity.com';
  const bearer = `Bearer ${process.env.SCAN_SECRET || ''}`;

  // ── Apple Music first (guaranteed must-have) ────────────────────────────
  console.log(`[CRON] Apple Music: scanning ${batch.length} artists (concurrency=10 internal)...`);
  const appleStart = Date.now();
  for (let i = 0; i < batch.length; i += batchSize) {
    const chunk = batch.slice(i, i + batchSize);
    try {
      const resp = await fetch(`${scanBaseUrl}/api/search-apple`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': bearer },
        body: JSON.stringify({ artistNames: chunk, daysBack: 7, targetFriday: weekDate }),
      });
      if (resp.ok) {
        const data = await resp.json();
        const tracks = data.tracks || [];
        appleTracks += tracks.length;
        // R13: extract collaboration + velocity signals from every track
        for (const t of tracks) recordCollaborationFromTrack(t, 'apple');
        // R12: record any ISRC-verify rejections so Thread A can act on them
        // (wrong-person Apple matches gated before cache write).
        const rejections = (data.apple_rejections || []) as AppleRejection[];
        for (const r of rejections) intel.recordAppleRejection(r);
        if (rejections.length > 0) {
          console.log(`[CRON] Apple batch ${startIdx + i}: ${rejections.length} ISRC-verify rejections`);
        }
        if (tracks.length > 0) {
          const rows = tracks.map((t: any) => {
            const row: Record<string, any> = {
              scan_week: weekDate,
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
        console.error(`[CRON] Apple batch ${startIdx + i} returned ${resp.status}`);
      }
    } catch (e) {
      console.error(`[CRON] Apple batch ${startIdx + i} failed:`, e);
    }
  }
  console.log(`[CRON] Apple Music done: ${appleTracks} tracks in ${Date.now() - appleStart}ms`);

  // Artists "scanned" in Apple-only mode is the full batch (Apple handles all of them).
  // Spotify block below ALSO increments `scanned`; guard against double-counting.
  if (!includeSpotify) {
    scanned = batch.length;
  }

  // ── Spotify second (supplementary: popularity, playlist data) — OFF by default ──
  if (includeSpotify) {
  console.log(`[CRON] Spotify: scanning ${batch.length} artists (serial with 100ms throttle)...`);
  const spotifyStart = Date.now();
  for (let i = 0; i < batch.length; i += batchSize) {
    const chunk = batch.slice(i, i + batchSize);
    try {
      const resp = await fetch(`${scanBaseUrl}/api/scan-artists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': bearer },
        body: JSON.stringify({ artistNames: chunk, daysBack: 8, targetFriday: weekDate }),
      });
      if (resp.ok) {
        const data = await resp.json();
        const tracks = data.tracks || [];
        spotifyTracks += tracks.length;
        // R13: extract collaboration + velocity signals from every track
        for (const t of tracks) recordCollaborationFromTrack(t, 'spotify');
        if (tracks.length > 0) {
          const rows = tracks.map((t: any) => ({
            scan_week: weekDate,
            spotify_artist_id: t.artist_id || null,
            artist_name: t.artist_names,
            track_id: t.track_id,
            track_name: t.track_name,
            album_name: t.album_name,
            album_id: t.album_spotify_id || null,
            album_type: t.album_type || 'single',
            release_date: t.release_date,
            cover_art_640: t.cover_art_640 || null,
            cover_art_300: t.cover_art_300 || null,
            track_number: t.track_number || 1,
            duration_ms: t.duration_ms || 0,
            explicit: t.explicit || false,
            total_tracks: t.total_tracks || 1,
            spotify_url: t.track_spotify_url || null,
          }));
          await supabase.from('weekly_nashville_releases').upsert(rows, { onConflict: 'scan_week,track_id' });
        }
      } else {
        console.error(`[CRON] Spotify batch ${startIdx + i} returned ${resp.status}`);
      }
    } catch (e) {
      console.error(`[CRON] Spotify batch ${startIdx + i} failed:`, e);
    }
    scanned += chunk.length;
  }
  console.log(`[CRON] Spotify done: ${spotifyTracks} tracks in ${Date.now() - spotifyStart}ms`);
  } else {
    console.log('[CRON] Spotify skipped (include_spotify=false)');
  }

  const totalTracks = appleTracks + spotifyTracks;
  console.log(`[CRON] Chain ${chainNum} totals — apple_tracks: ${appleTracks}, spotify_tracks: ${spotifyTracks}, combined_unique_upserted≈${totalTracks}`);

  // Update metadata
  const isComplete = endIdx >= artistNames.length;
  await supabase.from('scan_metadata').upsert({
    id: 'nashville_weekly',
    last_scan_week: weekDate,
    last_scan_at: new Date().toISOString(),
    status: isComplete ? 'complete' : 'in_progress',
    total_artists_scanned: endIdx,
    total_tracks_found: totalTracks,
  });

  console.log(`[CRON] Chunk done: ${scanned} artists, ${totalTracks} tracks (${startIdx}-${endIdx} of ${artistNames.length})`);

  // Post-scan: resolve handles for new artists (when scan is complete)
  if (isComplete && totalTracks > 0) {
    console.log('[CRON] Scan complete — enriching handles for new artists...');
    try {
      // Get all unique artists from this week's releases
      const { data: releases } = await supabase
        .from('weekly_nashville_releases')
        .select('artist_name')
        .eq('scan_week', weekDate);
      if (releases) {
        const uniqueNames = [...new Set(releases.map(r => (r.artist_name || '').split(/,/)[0].trim()))].filter(Boolean);
        // Check which already have handles
        const { data: cached } = await supabase
          .from('instagram_handles')
          .select('artist_name')
          .in('artist_name', uniqueNames.slice(0, 500));
        const cachedNames = new Set((cached || []).map(h => h.artist_name?.toLowerCase()));
        const uncached = uniqueNames.filter(n => !cachedNames.has(n.toLowerCase()));
        console.log(`[CRON] ${uniqueNames.length} artists, ${cachedNames.size} cached, ${uncached.length} need handles`);

        // Resolve up to 50 handles (budget ~$0.20 per scan run)
        let resolved = 0;
        for (const name of uncached.slice(0, 50)) {
          try {
            const r = await fetch(`${scanBaseUrl}/api/resolve-handle`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Origin': `${scanBaseUrl}` },
              body: JSON.stringify({ artist_name: name }),
            });
            if (r.ok) {
              const d = await r.json();
              if (d.handle) resolved++;
            }
          } catch { /* individual resolve failed — continue */ }
        }
        console.log(`[CRON] Resolved ${resolved}/${Math.min(uncached.length, 50)} handles`);
      }
    } catch (e) {
      console.error('[CRON] Post-scan enrichment error:', e);
    }
  }

  // Self-chain: if not complete AND chains remaining, invoke next batch
  const chainsRemaining = maxChains - chainNum - 1;
  let chainStatus: 'complete' | 'paused_at_chain_limit' | 'chaining' | 'chain_failed' = 'complete';

  if (!isComplete && chainsRemaining > 0) {
    const nextChain = chainNum + 1;
    const extraParams: string[] = [];
    if (weekOverride) extraParams.push(`week=${weekOverride}`);
    if (includeSpotify) extraParams.push('include_spotify=true');
    const extra = extraParams.length ? '&' + extraParams.join('&') : '';
    const nextUrl = `${scanBaseUrl}/api/cron-scan-weekly?offset=${endIdx}&max_chains=${maxChains}&chain=${nextChain}${extra}`;

    // Apple Music + Spotify both exhibit progressive rate-limit degradation
    // after ~80s of continuous hammering. Sleep 30s between chains so the
    // rolling rate window recovers before the next chain starts its API burst.
    // 30s × ~22 chains = 11min of cumulative pause — worth the cost to keep
    // every chain productive instead of burning chains 4+ at 0 tracks.
    console.log(`[CRON] Pacing: sleeping 30s before dispatching chain ${nextChain}`);
    await new Promise(resolve => setTimeout(resolve, 30000));

    console.log(`[CRON] Dispatching → chain ${nextChain}/${maxChains}: artists ${endIdx}-${Math.min(endIdx + BATCH_SIZE, artistNames.length)}`);
    // Fire-and-forget: abort our request 3s after dispatch. Vercel runs the
    // child invocation to completion regardless of our connection — we just
    // need enough time to ensure the child function was invoked. Awaiting the
    // full response would stack chains inside chain 0 and blow the 300s limit.
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 3000);
    try {
      await fetch(nextUrl, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${CRON_SECRET}` },
        signal: ctrl.signal,
      });
      chainStatus = 'chaining';
    } catch (e) {
      if ((e as Error).name === 'AbortError') {
        chainStatus = 'chaining'; // expected — child is running independently
      } else {
        console.error(`[CRON] Chain ${nextChain} dispatch failed:`, e);
        chainStatus = 'chain_failed';
      }
    }
  } else if (!isComplete) {
    chainStatus = 'paused_at_chain_limit';
    console.log(`[CRON] Chain limit reached (${maxChains}). Paused at artist ${endIdx}/${artistNames.length}`);
  }

  // Observability: log this chain's results
  if (scanRunId) {
    const baseUpdate: Record<string, any> = {
      artists_scanned: scanned,
      tracks_found: totalTracks,
      future_tracks_found: 0,
      composer_credits_found: appleTracks, // Apple is the composer source
      duration_ms: Date.now() - chainStartMs,
      status: chainStatus,
    };
    // Per-source counts (apple_tracks / spotify_tracks) live only in logs +
    // the JSON response — not in scan_runs — so we don't depend on a schema
    // migration. supabase-js returns {error} without throwing on unknown columns,
    // so silent write-loss is the trap we avoid by only sending known columns.
    const upd = await supabase.from('scan_runs').update(baseUpdate).eq('id', scanRunId);
    if (upd.error) console.error('[CRON] scan_runs update error:', upd.error);
  }

  // R13: emit the scan intelligence artifact for Thread A to ingest.
  // Every chain emits its own row — the cascade can aggregate across chains
  // by scan_week + generated_at window. Collaboration signals are the highest-
  // value piece: two+ Nashville-universe artists on the same track = co-write.
  let intelRowId: number | undefined;
  try {
    const artifact = intel.build({
      scan_week: weekDate,
      scanner: 'nmf_weekly_cron',
      scope: {
        universe_source: 'r2://nd-profiles/browse_artists.json',
        universe_generated_at: r2GeneratedAt || undefined,
        artists_input: batch.length,
        artists_with_releases: 0,  // populated by cascade during ingest
        tracks_found: totalTracks,
      },
      notes: `chain ${chainNum}/${maxChains} offset=${startIdx}-${endIdx} include_spotify=${includeSpotify}`,
    });
    const emit = await emitIntelligence(artifact);
    if (emit.ok) {
      intelRowId = emit.rowId;
      console.log(`[CRON] Emitted scan_intelligence row id=${intelRowId} | collaborations=${artifact.collaboration_signals.length} velocity_artists=${artifact.release_velocity.length}`);
    } else {
      console.error('[CRON] emitIntelligence failed:', emit.error);
    }
  } catch (e) {
    console.error('[CRON] scan_intelligence build/emit threw:', e);
  }

  return res.status(200).json({
    status: chainStatus,
    week: weekDate,
    chain: chainNum,
    max_chains: maxChains,
    artists_scanned: scanned,
    tracks_found: totalTracks,
    apple_tracks: appleTracks,
    spotify_tracks: spotifyTracks,
    range: `${startIdx}-${endIdx} of ${artistNames.length}`,
    intel_row_id: intelRowId ?? null,
    next: isComplete ? null : `/api/cron-scan-weekly?offset=${endIdx}&max_chains=${maxChains}&chain=${chainNum + 1}`,
  });
}
