import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/**
 * Serves the latest NMF scan enrichment data for Thread A's cascade.
 * One scan → two destinations: NMF Supabase + ND enrichment feed.
 *
 * Auth: requires ND_AUTH_TOKEN_SECRET or CRON_SECRET header.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Auth check — only Thread A cascade or cron can read this
  const authHeader = req.headers.authorization?.replace('Bearer ', '') || '';
  const cronSecret = process.env.CRON_SECRET || '';
  const ndSecret = process.env.ND_AUTH_TOKEN_SECRET || '';
  const ndToken = req.headers['x-nd-token'] as string || '';

  if (!authHeader && !ndToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (authHeader !== cronSecret && !ndToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  );

  // Get latest scan week
  const { data: meta } = await supabase
    .from('scan_metadata')
    .select('*')
    .eq('id', 'nashville_weekly')
    .single();

  const scanWeek = meta?.last_scan_week || '';

  // Get all releases from the latest scan
  const { data: releases } = await supabase
    .from('weekly_nashville_releases')
    .select('artist_name, track_name, album_name, release_date, album_type, cover_art_300, composer_name')
    .eq('scan_week', scanWeek)
    .order('artist_name');

  // Get scan run stats
  const { data: runs } = await supabase
    .from('scan_runs')
    .select('*')
    .eq('target_week', scanWeek)
    .order('chain_number');

  const totalScanned = (runs || []).reduce((sum, r) => sum + (r.artists_scanned || 0), 0);
  const totalTracks = (runs || []).reduce((sum, r) => sum + (r.tracks_found || 0), 0);
  const composerCredits = (releases || []).filter(r => r.composer_name).length;

  // Future releases for Coming Soon enrichment
  const today = new Date().toISOString().split('T')[0];
  const futureReleases = (releases || []).filter(r => r.release_date > today);

  res.setHeader('Cache-Control', 's-maxage=3600');
  return res.status(200).json({
    scan_date: meta?.last_scan_at || '',
    scan_week: scanWeek,
    status: meta?.status || 'unknown',
    new_releases: (releases || []).filter(r => r.release_date <= today),
    future_releases: futureReleases,
    composer_credits_found: composerCredits,
    stats: {
      artists_scanned: totalScanned,
      tracks_found: totalTracks,
      future_tracks: futureReleases.length,
      chains_run: (runs || []).length,
    },
  });
}
