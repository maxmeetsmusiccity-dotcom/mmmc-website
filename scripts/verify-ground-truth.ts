/**
 * Ground Truth Verification Pass
 *
 * Runs all unconfirmed handles in Supabase through Apify Instagram Profile
 * Scraper to verify they still exist and bio matches a music professional.
 * Updates source label to categorical confidence.
 *
 * Uses Apify (included in $29/mo Starter plan credits) — no extra cost.
 *
 * Run:
 *   VITE_SUPABASE_URL=<url> SUPABASE_SERVICE_ROLE_KEY=<key> APIFY_TOKEN=<token> npx tsx scripts/verify-ground-truth.ts
 *
 * Or with .env.local:
 *   source <(grep -E '^(VITE_SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY|APIFY_TOKEN)=' .env.local | sed 's/^/export /') && npx tsx scripts/verify-ground-truth.ts
 */

import { createClient } from '@supabase/supabase-js';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const APIFY_TOKEN = process.env.APIFY_TOKEN || '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
if (!APIFY_TOKEN) {
  console.error('Missing APIFY_TOKEN');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Music-related keywords for bio validation
const MUSIC_KEYWORDS = [
  'musician', 'songwriter', 'singer', 'artist', 'producer', 'band',
  'music', 'nashville', 'country', 'records', 'recording', 'album',
  'tour', 'concert', 'guitar', 'songs', 'writer', 'performer',
  'americana', 'christian', 'worship', 'gospel', 'bluegrass', 'folk',
  'mgmt', 'management', 'booking', 'label', 'publishing', 'bmi', 'ascap',
  'sesac', 'opry', 'cma', 'acm', 'grammy', 'dove', 'ryman',
  'whiskey jam', 'bluebird', 'listening room', '🎵', '🎶', '🎸', '🎤', '🎹',
  'singer-songwriter', 'new music', 'out now', 'debut', 'single',
];

function bioMatchesMusic(bio: string): boolean {
  if (!bio) return false;
  const lower = bio.toLowerCase();
  return MUSIC_KEYWORDS.some(kw => lower.includes(kw));
}

type ConfidenceLabel = 'confirmed' | 'likely' | 'unverified' | 'contested' | 'rejected';

function determineLabel(
  handle: string,
  profile: any | null,
): { label: ConfidenceLabel; evidence: string } {
  if (!profile) {
    return { label: 'rejected', evidence: `Handle ${handle} not found on Instagram (404 or private)` };
  }

  const bio = profile.biography || '';
  const bioMatch = bioMatchesMusic(bio);
  const hasFollowers = (profile.followersCount || 0) > 100;
  const isVerified = profile.isVerified || false;

  if (isVerified && bioMatch) {
    return { label: 'confirmed', evidence: `Verified + bio: "${bio.slice(0, 80)}"` };
  }
  if (bioMatch && hasFollowers) {
    return { label: 'confirmed', evidence: `Bio match + ${profile.followersCount} followers: "${bio.slice(0, 80)}"` };
  }
  if (bioMatch) {
    return { label: 'likely', evidence: `Bio match, ${profile.followersCount || 0} followers: "${bio.slice(0, 80)}"` };
  }
  if (hasFollowers) {
    return { label: 'unverified', evidence: `${profile.followersCount} followers but no music keywords: "${bio.slice(0, 80)}"` };
  }
  return { label: 'unverified', evidence: `Profile exists, no music indicators: "${bio.slice(0, 80)}"` };
}

async function verifyBatch(handles: string[]): Promise<Map<string, any>> {
  const cleaned = handles.map(h => h.replace(/^@/, '')).filter(Boolean);
  if (cleaned.length === 0) return new Map();

  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/apify~instagram-profile-scraper/run-sync-get-dataset-items?token=${APIFY_TOKEN}&timeout=120`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernames: cleaned }),
      },
    );
    if (!res.ok) {
      console.error(`Apify error: ${res.status}`);
      return new Map();
    }
    const data = await res.json();
    if (!Array.isArray(data)) return new Map();

    const map = new Map<string, any>();
    for (const profile of data) {
      if (profile.username) map.set(profile.username.toLowerCase(), profile);
    }
    return map;
  } catch (e) {
    console.error('Apify request failed:', e);
    return new Map();
  }
}

async function main() {
  // Fetch all handles from Supabase
  const { data: handles, error } = await supabase
    .from('instagram_handles')
    .select('spotify_artist_id, artist_name, instagram_handle, source, nd_pg_id')
    .not('instagram_handle', 'is', null)
    .order('artist_name');

  if (error || !handles) {
    console.error('Failed to fetch handles:', error?.message);
    process.exit(1);
  }

  // Only verify handles not already confirmed
  const toVerify = handles.filter(h =>
    h.instagram_handle && !h.source?.includes(':confirmed')
  );

  const alreadyConfirmed = handles.length - toVerify.length;
  console.log(`Total handles: ${handles.length}`);
  console.log(`Already confirmed: ${alreadyConfirmed}`);
  console.log(`To verify: ${toVerify.length}`);
  console.log('');

  // Process in batches of 10 (Apify can handle multiple usernames per call)
  const BATCH_SIZE = 10;
  const DELAY_MS = 3000;
  let confirmed = 0, likely = 0, unverified = 0, rejected = 0, errors = 0;

  for (let i = 0; i < toVerify.length; i += BATCH_SIZE) {
    const batch = toVerify.slice(i, i + BATCH_SIZE);
    const handleList = batch.map(h => h.instagram_handle!);

    const profiles = await verifyBatch(handleList);

    for (const h of batch) {
      const cleanHandle = h.instagram_handle!.replace(/^@/, '').toLowerCase();
      const profile = profiles.get(cleanHandle);
      const { label, evidence } = determineLabel(h.instagram_handle!, profile);

      // Update Supabase
      const { error: updateErr } = await supabase.from('instagram_handles').update({
        source: `ground_truth:${label}`,
        updated_at: new Date().toISOString(),
      }).eq('spotify_artist_id', h.spotify_artist_id);

      if (updateErr) {
        errors++;
      } else {
        if (label === 'confirmed') confirmed++;
        else if (label === 'likely') likely++;
        else if (label === 'unverified') unverified++;
        else if (label === 'rejected') rejected++;
      }
    }

    const done = Math.min(i + BATCH_SIZE, toVerify.length);
    console.log(`[${done}/${toVerify.length}] confirmed=${confirmed} likely=${likely} unverified=${unverified} rejected=${rejected} errors=${errors}`);

    if (i + BATCH_SIZE < toVerify.length) {
      await new Promise(r => setTimeout(r, DELAY_MS));
    }
  }

  console.log('\n=== VERIFICATION COMPLETE ===');
  console.log(`Confirmed: ${confirmed}`);
  console.log(`Likely: ${likely}`);
  console.log(`Unverified: ${unverified}`);
  console.log(`Rejected: ${rejected}`);
  console.log(`Errors: ${errors}`);
  console.log(`Previously confirmed: ${alreadyConfirmed}`);
  console.log(`Total: ${confirmed + likely + unverified + rejected + errors + alreadyConfirmed}`);
}

main().catch(e => { console.error(e); process.exit(1); });
