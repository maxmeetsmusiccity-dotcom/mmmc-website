/**
 * Load ground truth Instagram handles into Supabase.
 * Sources:
 * 1. staged_ig_handle_updates.json (1,625 entries with pg_id, bio, followers)
 * 2. handle_map.json (5,741 entries, handle → artist name mapping)
 *
 * Run: npx tsx scripts/load-ground-truth-handles.ts
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  console.error('Run: source .env.local && npx vercel env pull .env.local --environment production');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Categorical confidence labels (not numeric — per strategy directive)
type ConfidenceLabel = 'confirmed' | 'likely' | 'unverified' | 'contested' | 'rejected';

interface HandleRecord {
  spotify_artist_id: string; // Using pg_id as the key since these are ND entities
  artist_name: string;
  instagram_handle: string;
  nd_pg_id: string;
  source: string;
  confidence: number; // DB column is REAL, we store 0.0 but use labels in UI
  confidence_label: string; // Stored in source field as "source:label"
  updated_at: string;
}

async function loadStagedUpdates(): Promise<HandleRecord[]> {
  const ND_PATH = resolve(__dirname, '../../cowritecompass/data/staged_ig_handle_updates.json');
  const raw = JSON.parse(readFileSync(ND_PATH, 'utf-8'));
  console.log(`Loaded ${raw.length} staged updates`);

  return raw.map((entry: any) => ({
    spotify_artist_id: entry.pg_id, // PK — using pg_id
    artist_name: entry.name,
    instagram_handle: `@${entry.handle}`,
    nd_pg_id: entry.pg_id,
    source: `max_ground_truth:${entry.verified ? 'confirmed' : 'likely'}`,
    confidence: entry.verified ? 0.95 : 0.85, // Categorical label is in source field
    updated_at: new Date().toISOString(),
  }));
}

async function loadHandleMap(): Promise<HandleRecord[]> {
  const HM_PATH = resolve(__dirname, '../../cowritecompass/venue_pipeline/data/handle_map.json');
  const raw = JSON.parse(readFileSync(HM_PATH, 'utf-8'));
  console.log(`Loaded ${Object.keys(raw).length} handle_map entries`);

  // handle_map doesn't have pg_ids — use handle as a temporary key
  // These will be matched to pg_ids by the cascade's identity resolution
  return Object.entries(raw).map(([handle, data]: [string, any]) => ({
    spotify_artist_id: `handle:${handle}`, // Temporary key until pg_id resolved
    artist_name: data.best_name,
    instagram_handle: `@${handle}`,
    nd_pg_id: '', // No pg_id in handle_map
    source: `venue_pipeline:unverified`,
    confidence: 0.8,
    updated_at: new Date().toISOString(),
  }));
}

async function main() {
  // Phase 1: Load staged updates (these have pg_ids and verified bios)
  const staged = await loadStagedUpdates();
  console.log(`\nUpserting ${staged.length} staged ground truth handles...`);

  let successCount = 0;
  let errorCount = 0;

  // Batch upsert in chunks of 100
  for (let i = 0; i < staged.length; i += 100) {
    const batch = staged.slice(i, i + 100);
    const { error } = await supabase
      .from('instagram_handles')
      .upsert(batch, { onConflict: 'spotify_artist_id' });

    if (error) {
      console.error(`Batch ${i / 100 + 1} error:`, error.message);
      errorCount += batch.length;
    } else {
      successCount += batch.length;
    }

    // Progress
    if ((i + 100) % 500 === 0 || i + 100 >= staged.length) {
      console.log(`  Progress: ${Math.min(i + 100, staged.length)}/${staged.length} (${successCount} ok, ${errorCount} err)`);
    }
  }

  console.log(`\nStaged updates: ${successCount} loaded, ${errorCount} errors`);

  // Phase 2: Load handle_map entries that DON'T already exist
  // (staged updates have pg_ids and are higher quality)
  const handleMap = await loadHandleMap();

  // Filter out entries whose handles are already in staged updates
  const stagedHandles = new Set(staged.map(s => s.instagram_handle));
  const newFromMap = handleMap.filter(h => !stagedHandles.has(h.instagram_handle));
  console.log(`\nHandle map: ${handleMap.length} total, ${newFromMap.length} new (not in staged)`);

  let mapSuccess = 0;
  let mapError = 0;

  for (let i = 0; i < newFromMap.length; i += 100) {
    const batch = newFromMap.slice(i, i + 100);
    const { error } = await supabase
      .from('instagram_handles')
      .upsert(batch, { onConflict: 'spotify_artist_id' });

    if (error) {
      mapError += batch.length;
    } else {
      mapSuccess += batch.length;
    }

    if ((i + 100) % 1000 === 0 || i + 100 >= newFromMap.length) {
      console.log(`  Progress: ${Math.min(i + 100, newFromMap.length)}/${newFromMap.length}`);
    }
  }

  console.log(`\nHandle map: ${mapSuccess} loaded, ${mapError} errors`);
  console.log(`\nTotal handles in Supabase: ${successCount + mapSuccess}`);
  console.log('Done. Next: run verification pass on these handles.');
}

main().catch(e => { console.error(e); process.exit(1); });
