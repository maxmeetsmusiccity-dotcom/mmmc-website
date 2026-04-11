-- NMF Curator Studio: Wave 2 Migrations
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/kpwklxrcysokuyjhuhun/sql
-- All statements are idempotent (safe to run multiple times)

-- ============================================================
-- Migration 1: Composer pipeline columns
-- Enables Coming Soon → Nashville Decoder bridge
-- ============================================================
ALTER TABLE weekly_nashville_releases ADD COLUMN IF NOT EXISTS composer_name TEXT;
ALTER TABLE weekly_nashville_releases ADD COLUMN IF NOT EXISTS composer_credits JSONB;

-- ============================================================
-- Migration 2: Cron observability table
-- Tracks each scan chain's results for monitoring
-- ============================================================
CREATE TABLE IF NOT EXISTS scan_runs (
  id SERIAL PRIMARY KEY,
  run_date TIMESTAMP DEFAULT now(),
  target_week TEXT,
  chain_number INTEGER,
  total_chains INTEGER,
  artists_scanned INTEGER,
  tracks_found INTEGER,
  future_tracks_found INTEGER DEFAULT 0,
  composer_credits_found INTEGER DEFAULT 0,
  errors TEXT[],
  duration_ms INTEGER,
  status TEXT DEFAULT 'running'
);

-- ============================================================
-- Migration 3: Handle sync bridge table
-- Logs handle confirmations from NMF curation flow
-- ============================================================
CREATE TABLE IF NOT EXISTS artist_handle_confirmations (
  id SERIAL PRIMARY KEY,
  artist_name TEXT NOT NULL,
  instagram_handle TEXT NOT NULL,
  confirmed_by TEXT DEFAULT 'max',
  confirmed_at TIMESTAMP DEFAULT now(),
  source TEXT DEFAULT 'nmf_curation',
  week_of TEXT,
  synced_to_nd BOOLEAN DEFAULT false,
  corrected_from TEXT
);

-- Verify
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'weekly_nashville_releases' AND column_name IN ('composer_name', 'composer_credits');

SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('scan_runs', 'artist_handle_confirmations');
