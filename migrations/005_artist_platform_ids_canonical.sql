-- NMF weekly scan: make ND's canonical identifiers first-class on the cache.
--
-- Problem: `artist_platform_ids` is keyed on `artist_name`. ND's identity
-- resolver already disambiguates artists via pg_id (with cannot-link seeds +
-- FP gate), and R2 emits a trusted `spotify_artist_id` for every showcase
-- artist. Our cache should key off those canonical identifiers so a scan
-- run can look up the right row without re-running fuzzy name matches.
--
-- Apply via the Supabase SQL editor for project kpwklxrcysokuyjhuhun.
-- Safe: additive columns + unique index. Existing rows keep working (name is
-- still the PK); new scan code will prefer spotify_artist_id lookups.

ALTER TABLE artist_platform_ids
  ADD COLUMN IF NOT EXISTS pg_id TEXT;

-- The `spotify_artist_id` column already exists. Add a unique index so we can
-- `ON CONFLICT (spotify_artist_id)` and look up rows by the Spotify ID in O(1).
-- Nullable rows are excluded from the unique constraint via the WHERE clause.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_artist_platform_ids_spotify_id
  ON artist_platform_ids(spotify_artist_id)
  WHERE spotify_artist_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_artist_platform_ids_pg_id
  ON artist_platform_ids(pg_id)
  WHERE pg_id IS NOT NULL;

COMMENT ON COLUMN artist_platform_ids.pg_id IS
  'ND''s canonical identifier (from dim_writer_v2). When present this is the authoritative identity key; artist_name is a display label that can drift.';
