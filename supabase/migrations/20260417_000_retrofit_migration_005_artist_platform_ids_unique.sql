-- Retrofit file for migration 005 (commit b29c3cb, applied direct-to-prod 2026-04-17)
-- Scope per original commit message: "pg_id column + unique index on spotify_artist_id"
--
-- Zeta W1 established supabase/migrations/ as the canonical change log for
-- Realm A (kpwklxrcysokuyjhuhun). Migration 005 predated that dir, so this
-- file retrofits its DDL as a lagging record for parity + future reproducibility.
-- Fully idempotent (IF NOT EXISTS) so re-application is safe.
--
-- Ref: Zeta W1 Top 10 #5, Zeta W2 M-Z18.

-- 1. pg_id column (nullable text; migration 005 added this for ND<->MMMC cross-DB joins)
ALTER TABLE public.artist_platform_ids
  ADD COLUMN IF NOT EXISTS pg_id text;

-- 2. UNIQUE partial index on spotify_artist_id (enforces one artist row per
--    Spotify ID while allowing unlimited NULLs for Apple-only cache rows).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_artist_platform_ids_spotify_id
  ON public.artist_platform_ids (spotify_artist_id)
  WHERE spotify_artist_id IS NOT NULL;

-- Verification (informational; PG ignores in a plain SQL file):
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'artist_platform_ids' AND column_name = 'pg_id';  -- 1 row
-- SELECT indexname FROM pg_indexes
--   WHERE tablename = 'artist_platform_ids'
--   AND indexname = 'uniq_artist_platform_ids_spotify_id';  -- 1 row
