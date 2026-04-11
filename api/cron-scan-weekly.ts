import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
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

  // Self-chaining params — parsed early because metadata update depends on chainNum
  const maxChains = Math.min(parseInt(req.query.max_chains as string || '5', 10), 10);
  const chainNum = parseInt(req.query.chain as string || '0', 10);

  // Update scan metadata (only reset counters on first chain)
  if (chainNum === 0) {
    await supabase.from('scan_metadata').upsert({
      id: 'nashville_weekly',
      last_scan_week: weekDate,
      last_scan_at: new Date().toISOString(),
      status: 'scanning',
      total_artists_scanned: 0,
      total_tracks_found: 0,
    });
  }

  // Observability: log this chain's start (graceful if table doesn't exist)
  const chainStartMs = Date.now();
  let scanRunId: number | null = null;
  try {
    const { data } = await supabase.from('scan_runs').insert({
      target_week: weekDate,
      chain_number: chainNum,
      total_chains: maxChains,
      status: 'running',
    }).select('id').single();
    scanRunId = data?.id || null;
  } catch { /* scan_runs table may not exist yet */ }

  // Try to load artist list from R2
  let artistNames: string[] = SEED_ARTISTS;
  try {
    const apiToken = ND_API_BASE && ND_AUTH_SECRET ? await generateApiToken() : '';
    const r2Url = apiToken ? `${ND_API_BASE}/api/r2?key=browse_artists.json` : '';
    const r2Resp = r2Url ? await fetch(r2Url, { headers: { 'Content-Type': 'application/json', 'X-ND-Token': apiToken } }) : { ok: false, json: async () => ({}) };
    if (r2Resp.ok) {
      const r2Data = await r2Resp.json();
      // R2 file may have artists at top level OR nested in categories
      const names = new Set<string>();
      if (r2Data.artists && r2Data.artists.length > 0) {
        for (const a of r2Data.artists) names.add(a.name);
      }
      // Also extract from category objects (Thread A nests artists inside categories)
      if (Array.isArray(r2Data.categories)) {
        for (const cat of r2Data.categories) {
          if (Array.isArray(cat.artists)) {
            for (const a of cat.artists) names.add(a.name);
          }
        }
      }
      if (names.size > 0) {
        artistNames = [...names];
        console.log(`[CRON] Loaded ${artistNames.length} artists from R2`);
      }
    }
  } catch { console.log('[CRON] R2 not available, using seed list'); }

  // Seed artists FIRST — they're the active Nashville performers most likely to release
  const seedSet = new Set(SEED_ARTISTS.map(n => n.toLowerCase()));
  const nonSeed = artistNames.filter(n => !seedSet.has(n.toLowerCase()));
  artistNames = [...SEED_ARTISTS, ...nonSeed];
  console.log(`[CRON] Total artists to scan: ${artistNames.length} (${SEED_ARTISTS.length} seed first)`);

  // Self-chaining: offset (or legacy start) — chainNum and maxChains parsed above
  const startIdx = parseInt((req.query.offset ?? req.query.start) as string || '0', 10);
  // Process 2,000 artists per chain (fits within 300s Vercel timeout)
  const BATCH_SIZE = 2000;
  const endIdx = Math.min(startIdx + BATCH_SIZE, artistNames.length);
  const batch = artistNames.slice(startIdx, endIdx);

  console.log(`[CRON] Chain ${chainNum}/${maxChains}: scanning artists ${startIdx}-${endIdx} of ${artistNames.length}`);

  // Scan in batches, save to Supabase progressively
  const batchSize = 50;
  let totalTracks = 0;
  let scanned = 0;
  const scanHost = req.headers.host || 'maxmeetsmusiccity.com';
  const protocol = scanHost.includes('localhost') ? 'http' : 'https';

  for (let i = 0; i < batch.length; i += batchSize) {
    const chunk = batch.slice(i, i + batchSize);
    try {
      const resp = await fetch(`${protocol}://${scanHost}/api/scan-artists`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SCAN_SECRET || ''}`,
        },
        body: JSON.stringify({ artistNames: chunk, daysBack: 8, targetFriday: weekDate }),
      });
      if (resp.ok) {
        const data = await resp.json();
        const tracks = data.tracks || [];
        totalTracks += tracks.length;

        // Save immediately after each batch
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
      }
    } catch (e) {
      console.error(`[CRON] Batch ${startIdx + i}-${startIdx + i + batchSize} failed:`, e);
    }
    scanned += chunk.length;
  }

  // Apple Music scan — same artist batches, merge results
  let appleTracks = 0;
  console.log(`[CRON] Starting Apple Music scan for ${batch.length} artists...`);
  for (let i = 0; i < batch.length; i += batchSize) {
    const chunk = batch.slice(i, i + batchSize);
    try {
      const resp = await fetch(`${protocol}://${scanHost}/api/search-apple`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SCAN_SECRET || ''}`,
        },
        body: JSON.stringify({ artistNames: chunk, daysBack: 7, targetFriday: weekDate }),
      });
      if (resp.ok) {
        const data = await resp.json();
        const tracks = data.tracks || [];
        appleTracks += tracks.length;
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
            // Save composer data if available (column must exist — graceful if not)
            if (t.composer_name) row.composer_name = t.composer_name;
            return row;
          });
          // Upsert — won't duplicate if track_id matches a Spotify entry
          await supabase.from('weekly_nashville_releases').upsert(rows, { onConflict: 'scan_week,track_id' });
        }
      }
    } catch (e) {
      console.error(`[CRON] Apple Music batch ${startIdx + i} failed:`, e);
    }
  }
  totalTracks += appleTracks;
  console.log(`[CRON] Apple Music scan: ${appleTracks} tracks found`);

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
            const protocol = scanHost.includes('localhost') ? 'http' : 'https';
            const r = await fetch(`${protocol}://${scanHost}/api/resolve-handle`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Origin': `${protocol}://${scanHost}` },
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
    // 1-second delay to prevent rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
    const nextChain = chainNum + 1;
    const weekParam = weekOverride ? `&week=${weekOverride}` : '';
    const nextUrl = `${protocol}://${scanHost}/api/cron-scan-weekly?offset=${endIdx}&max_chains=${maxChains}&chain=${nextChain}${weekParam}`;
    console.log(`[CRON] Chaining → chain ${nextChain}/${maxChains}: artists ${endIdx}-${Math.min(endIdx + BATCH_SIZE, artistNames.length)}`);
    try {
      const chainResp = await fetch(nextUrl, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${CRON_SECRET}` },
      });
      if (!chainResp.ok) {
        console.error(`[CRON] Chain ${nextChain} returned ${chainResp.status} — stopping`);
        chainStatus = 'chain_failed';
      } else {
        chainStatus = 'chaining';
      }
    } catch (e) {
      console.error(`[CRON] Chain ${nextChain} failed:`, e);
      chainStatus = 'chain_failed';
    }
  } else if (!isComplete) {
    chainStatus = 'paused_at_chain_limit';
    console.log(`[CRON] Chain limit reached (${maxChains}). Paused at artist ${endIdx}/${artistNames.length}`);
  }

  // Observability: log this chain's results
  if (scanRunId) {
    try {
      // Count composer credits from Apple Music tracks
      const composerCredits = appleTracks; // approximate — refined when we track per-track
      await supabase.from('scan_runs').update({
        artists_scanned: scanned,
        tracks_found: totalTracks,
        future_tracks_found: 0, // TODO: count future-dated tracks separately
        composer_credits_found: composerCredits,
        duration_ms: Date.now() - chainStartMs,
        status: chainStatus,
      }).eq('id', scanRunId);
    } catch { /* scan_runs table may not exist yet */ }
  }

  return res.status(200).json({
    status: chainStatus,
    week: weekDate,
    chain: chainNum,
    max_chains: maxChains,
    artists_scanned: scanned,
    tracks_found: totalTracks,
    range: `${startIdx}-${endIdx} of ${artistNames.length}`,
    next: isComplete ? null : `/api/cron-scan-weekly?offset=${endIdx}&max_chains=${maxChains}&chain=${chainNum + 1}`,
  });
}
