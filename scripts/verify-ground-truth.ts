/**
 * Ground Truth Verification Pass
 *
 * Runs all handles in Supabase through Apify Instagram Profile Scraper
 * to verify they still exist and bio matches a music professional.
 * Updates source label to categorical confidence.
 *
 * Run: VITE_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... APIFY_TOKEN=... npx tsx scripts/verify-ground-truth.ts
 *
 * Cost estimate: ~$0.003-0.01 per profile × 3,792 = ~$11-38
 * Time estimate: ~2-4 hours (Apify handles rate limiting)
 */

import { createClient } from '@supabase/supabase-js';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const APIFY_TOKEN = process.env.APIFY_TOKEN || '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
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
  existingSource: string,
): { label: ConfidenceLabel; evidence: string } {
  if (!profile) {
    return { label: 'rejected', evidence: `Handle ${handle} not found on Instagram (404 or private)` };
  }

  const bio = profile.biography || '';
  const bioMatch = bioMatchesMusic(bio);
  const hasFollowers = (profile.followersCount || 0) > 100;
  const isVerified = profile.isVerified || false;
  const isBusiness = profile.isBusinessAccount || false;

  // Verified badge = very strong signal
  if (isVerified && bioMatch) {
    return { label: 'confirmed', evidence: `Verified badge + bio mentions music: "${bio.slice(0, 80)}"` };
  }

  // Bio matches music + decent following
  if (bioMatch && hasFollowers) {
    return { label: 'confirmed', evidence: `Bio mentions music + ${profile.followersCount} followers: "${bio.slice(0, 80)}"` };
  }

  // Bio matches but low following (could be emerging artist)
  if (bioMatch) {
    return { label: 'likely', evidence: `Bio mentions music but only ${profile.followersCount || 0} followers: "${bio.slice(0, 80)}"` };
  }

  // Business account in music category
  if (isBusiness && (profile.businessCategoryName || '').toLowerCase().includes('music')) {
    return { label: 'likely', evidence: `Business category: ${profile.businessCategoryName}, but bio doesn't mention music keywords` };
  }

  // Has followers but bio doesn't match music
  if (hasFollowers) {
    return { label: 'unverified', evidence: `Profile exists with ${profile.followersCount} followers but bio doesn't mention music: "${bio.slice(0, 80)}"` };
  }

  // Profile exists but nothing confirms it's the right person
  return { label: 'unverified', evidence: `Profile exists but no music indicators in bio: "${bio.slice(0, 80)}"` };
}

async function verifyHandle(handle: string): Promise<any | null> {
  const cleanHandle = handle.replace(/^@/, '');
  if (!cleanHandle) return null;

  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/apify~instagram-profile-scraper/run-sync-get-dataset-items?token=${APIFY_TOKEN}&timeout=30`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernames: [cleanHandle] }),
      },
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || !data[0]) return null;
    return data[0];
  } catch {
    return null;
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

  // Filter: only verify handles not already confirmed
  const toVerify = handles.filter(h =>
    h.instagram_handle &&
    !h.source?.includes(':confirmed') // Skip already confirmed
  );

  console.log(`Total handles: ${handles.length}`);
  console.log(`Already confirmed: ${handles.length - toVerify.length}`);
  console.log(`To verify: ${toVerify.length}`);
  console.log(`Estimated cost: $${(toVerify.length * 0.005).toFixed(2)}-${(toVerify.length * 0.01).toFixed(2)}`);
  console.log('');

  // Process with concurrency limit
  const BATCH_SIZE = 5; // 5 concurrent Apify calls
  const DELAY_MS = 2000; // 2s between batches
  let confirmed = 0, likely = 0, unverified = 0, rejected = 0, errors = 0;

  for (let i = 0; i < toVerify.length; i += BATCH_SIZE) {
    const batch = toVerify.slice(i, i + BATCH_SIZE);

    const results = await Promise.allSettled(
      batch.map(async (h) => {
        const profile = await verifyHandle(h.instagram_handle);
        const { label, evidence } = determineLabel(h.instagram_handle, profile, h.source || '');

        // Update Supabase with categorical label
        await supabase.from('instagram_handles').update({
          source: `ground_truth:${label}`,
          updated_at: new Date().toISOString(),
        }).eq('spotify_artist_id', h.spotify_artist_id);

        return { name: h.artist_name, handle: h.instagram_handle, label, evidence };
      })
    );

    for (const r of results) {
      if (r.status === 'fulfilled') {
        const { label } = r.value;
        if (label === 'confirmed') confirmed++;
        else if (label === 'likely') likely++;
        else if (label === 'unverified') unverified++;
        else if (label === 'rejected') rejected++;
      } else {
        errors++;
      }
    }

    // Progress
    const done = Math.min(i + BATCH_SIZE, toVerify.length);
    if (done % 50 === 0 || done === toVerify.length) {
      console.log(`[${done}/${toVerify.length}] confirmed=${confirmed} likely=${likely} unverified=${unverified} rejected=${rejected} errors=${errors}`);
    }

    // Rate limit
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
  console.log(`Total processed: ${confirmed + likely + unverified + rejected + errors}`);
}

main().catch(e => { console.error(e); process.exit(1); });
