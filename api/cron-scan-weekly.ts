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
  // Verify this is a cron call or manual trigger
  const authHeader = req.headers.authorization;
  const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;
  const isManual = req.query.secret === process.env.CRON_SECRET;
  if (!isCron && !isManual && process.env.CRON_SECRET) {
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

  // Scan in batches via our own scan-artists endpoint
  const batchSize = 50;
  const allTracks: any[] = [];
  let scanned = 0;
  const scanHost = req.headers.host || 'maxmeetsmusiccity.com';
  const protocol = scanHost.includes('localhost') ? 'http' : 'https';

  for (let i = 0; i < artistNames.length; i += batchSize) {
    const batch = artistNames.slice(i, i + batchSize);
    try {
      const resp = await fetch(`${protocol}://${scanHost}/api/scan-artists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artistNames: batch }),
      });
      if (resp.ok) {
        const data = await resp.json();
        allTracks.push(...(data.tracks || []));
      }
    } catch (e) {
      console.error(`[CRON] Batch ${i}-${i + batchSize} failed:`, e);
    }
    scanned += batch.length;
  }

  // Store in Supabase — upsert to avoid duplicates
  if (allTracks.length > 0) {
    const rows = allTracks.map(t => ({
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

    // Insert in chunks to avoid payload limits
    for (let i = 0; i < rows.length; i += 100) {
      const chunk = rows.slice(i, i + 100);
      await supabase.from('weekly_nashville_releases').upsert(chunk, { onConflict: 'scan_week,track_id' });
    }
  }

  // Update metadata
  await supabase.from('scan_metadata').upsert({
    id: 'nashville_weekly',
    last_scan_week: weekDate,
    last_scan_at: new Date().toISOString(),
    status: 'complete',
    total_artists_scanned: scanned,
    total_tracks_found: allTracks.length,
  });

  console.log(`[CRON] Scan complete: ${scanned} artists, ${allTracks.length} tracks`);

  return res.status(200).json({
    status: 'complete',
    week: weekDate,
    artists_scanned: scanned,
    tracks_found: allTracks.length,
  });
}
