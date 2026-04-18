-- M-Z5: scrub CSV-corrupted rows from artist_platform_ids (MERGE, not rename)
-- 2026-04-18 — Thread Zeta Wave 1
-- Realm A (kpwklxrcysokuyjhuhun)
--
-- Supersedes prior draft (UPDATE-rename): hit UNIQUE constraint on artist_name;
-- all 537 quote+comma rows have an existing clean-name counterpart — merge is
-- the correct mechanism, not rename.
--
-- Pattern classes (549 rows total matching '%,%' OR '%"%' OR LENGTH>200):
--   537  '"Name",'   — corrupt holds Spotify ID; clean holds Apple ID (or is empty).
--                      Merge corrupt's Spotify fields onto clean row, delete corrupt.
--                      Zero ID conflicts verified (0 rows where corrupt_spot != clean_spot).
--     7  multi-artist concat strings, NULL both IDs — delete (no binding lost).
--     5  legitimate stage names ("Weird Al" Yankovic, Roccstar, etc.) — KEEP untouched.
--
-- Safety pre-checks performed 2026-04-18 11:42–12:05:
--   * 0 triggers on artist_platform_ids
--   * 0 FKs reference artist_platform_ids
--   * has_clean_by_name = true for all 537 (all collide by clean-name PK — rename infeasible)
--   * Field matrix: 532 rows corrupt=Spotify-only + clean=Apple-only; 5 rows corrupt=Spotify-only + clean=empty; 0 conflicts
--   * Preview verified regex strip produces clean names for 10 sampled rows
--
-- Expected row-count delta:
--   Before: 8,408 rows
--   -537 corrupt rows deleted (data merged onto existing clean rows)
--   -7 multi-artist concat rows deleted
--   After: 7,864 rows

-- Step 1. Atomic merge-then-delete for the 537 quote+comma rows.
-- The CTE DELETE runs first (lifting the UNIQUE(spotify_artist_id) constraint),
-- then the UPDATE assigns the merged Spotify fields to the clean-name row.
-- Defensive `clean.spotify_artist_id IS NULL` filter guards against future drift
-- (today it's a no-op — zero conflicts verified).

WITH deleted_corrupt AS (
  DELETE FROM artist_platform_ids
  WHERE artist_name ~ '^".+",$'
  RETURNING artist_name AS c_name,
            SUBSTRING(artist_name FROM '^"(.+)",$') AS clean_target,
            spotify_artist_id, spotify_verified_at,
            spotify_not_found_count, spotify_last_error, pg_id
)
UPDATE artist_platform_ids AS clean
SET spotify_artist_id       = dc.spotify_artist_id,
    spotify_verified_at     = COALESCE(clean.spotify_verified_at, dc.spotify_verified_at),
    spotify_not_found_count = GREATEST(COALESCE(clean.spotify_not_found_count, 0),
                                       COALESCE(dc.spotify_not_found_count, 0)),
    spotify_last_error      = COALESCE(clean.spotify_last_error, dc.spotify_last_error),
    pg_id                   = COALESCE(clean.pg_id, dc.pg_id),
    updated_at              = NOW()
FROM deleted_corrupt dc
WHERE clean.artist_name = dc.clean_target
  AND clean.spotify_artist_id IS NULL;

-- Step 2. Delete the 7 comma-only multi-artist concat strings (all NULL IDs, dead cache).
DELETE FROM artist_platform_ids
WHERE artist_name LIKE '%,%'
  AND artist_name !~ '^".+",$'
  AND spotify_artist_id IS NULL
  AND apple_artist_id IS NULL;

-- Step 3. Final verification (run separately after apply).
-- SELECT COUNT(*) FROM artist_platform_ids;                                          -- EXPECT: 7,864
-- SELECT COUNT(*) FROM artist_platform_ids WHERE artist_name ~ '^".+",$';            -- EXPECT: 0
-- SELECT COUNT(*) FROM artist_platform_ids WHERE artist_name LIKE '%,%' AND artist_name !~ '^".+",$';  -- EXPECT: 0
-- SELECT COUNT(*) FROM artist_platform_ids WHERE artist_name LIKE '%"%' AND artist_name NOT LIKE '%,%';  -- EXPECT: 5 (legit stage names kept)
