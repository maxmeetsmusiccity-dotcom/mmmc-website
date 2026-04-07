import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://kpwklxrcysokuyjhuhun.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const R2_BASE = 'https://pub-639573660a1e48d2b2075b4563f00cd3.r2.dev';

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

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const weekDate = getLastFriday();

  // Update scan metadata
  await supabase.from('scan_metadata').upsert({
    id: 'nashville_weekly',
    last_scan_week: weekDate,
    last_scan_at: new Date().toISOString(),
    status: 'scanning',
    total_artists_scanned: 0,
    total_tracks_found: 0,
  });

  // Try to load artist list from R2
  let artistNames: string[] = SEED_ARTISTS;
  try {
    const r2Resp = await fetch(`${R2_BASE}/browse_artists.json`);
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

  // Merge seed list to ensure key Nashville artists are always included
  const allNames = new Set(artistNames);
  for (const name of SEED_ARTISTS) allNames.add(name);
  artistNames = [...allNames];
  console.log(`[CRON] Total artists to scan: ${artistNames.length}`);

  // Support resuming: ?start=500 skips first 500 artists
  const startIdx = parseInt(req.query.start as string || '0', 10);
  // Cap at 200 artists per invocation to stay within 300s timeout
  const maxPerRun = 200;
  const endIdx = Math.min(startIdx + maxPerRun, artistNames.length);
  const batch = artistNames.slice(startIdx, endIdx);

  console.log(`[CRON] Scanning artists ${startIdx}-${endIdx} of ${artistNames.length}`);

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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artistNames: chunk }),
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

  return res.status(200).json({
    status: isComplete ? 'complete' : 'in_progress',
    week: weekDate,
    artists_scanned: scanned,
    tracks_found: totalTracks,
    range: `${startIdx}-${endIdx} of ${artistNames.length}`,
    next: isComplete ? null : `/api/cron-scan-weekly?start=${endIdx}`,
  });
}
