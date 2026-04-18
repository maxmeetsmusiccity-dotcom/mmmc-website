-- M-Z5: scrub CSV-corrupted rows from artist_platform_ids
-- 2026-04-18 — Thread Zeta Wave 1
-- Realm A (kpwklxrcysokuyjhuhun)
--
-- Three pattern classes identified (549 rows total matching '%,%' OR '%"%' OR LENGTH>200):
--   537  quote+comma  '"Name",'                     — rename (strip wrapper), preserve Spotify ID
--     7  comma only    multi-artist concat strings  — delete, all NULL IDs, no binding
--     5  quote only    legit stage names            — KEEP ("Weird Al", "Roccstar", etc.)
--
-- Safety pre-checks performed 2026-04-18 11:42:
--   * 0 triggers on artist_platform_ids
--   * 0 FKs reference artist_platform_ids
--   * 0 of the 537 have a clean-name counterpart (UPDATE cannot PK-collide)
--   * All 537 have artist_name_lower = LOWER(artist_name) — update both in lockstep
--   * Preview SELECT verified regex strip produces clean names for 10 sampled rows
--
-- Exit criterion target:
--   SELECT COUNT(*) FROM artist_platform_ids WHERE artist_name LIKE '%,%' OR LENGTH(artist_name) > 200;  -- EXPECT 0

-- Step 1. Preview (informational only; do not run as part of apply)
-- SELECT artist_name AS before_name,
--        SUBSTRING(artist_name FROM '^"(.+)",$') AS after_name,
--        spotify_artist_id
-- FROM artist_platform_ids
-- WHERE artist_name ~ '^".+",$'
-- LIMIT 10;

-- Step 2. Rename the 537 quote+comma rows — strip wrapping quotes + trailing comma
UPDATE artist_platform_ids
SET artist_name = SUBSTRING(artist_name FROM '^"(.+)",$'),
    artist_name_lower = LOWER(SUBSTRING(artist_name FROM '^"(.+)",$'))
WHERE artist_name ~ '^".+",$';

-- Step 3. Delete the 7 comma-only multi-artist concat strings (all NULL IDs)
DELETE FROM artist_platform_ids
WHERE artist_name LIKE '%,%'
  AND artist_name !~ '^".+",$'
  AND spotify_artist_id IS NULL
  AND apple_artist_id IS NULL;

-- Step 4. Final verification (run after apply)
-- SELECT COUNT(*) FROM artist_platform_ids WHERE artist_name ~ '^".+",$';    -- EXPECT 0
-- SELECT COUNT(*) FROM artist_platform_ids WHERE artist_name LIKE '%,%';      -- EXPECT 0
-- SELECT COUNT(*) FROM artist_platform_ids WHERE artist_name LIKE '%"%';      -- EXPECT 5 (legitimate stage names)
