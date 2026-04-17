-- NMF: artist platform ID cache.
--
-- Today we search Spotify + Apple by NAME for every artist, every week.
-- That's ~22,500 API calls/week per source and hits dev-mode rate limits
-- before even a quarter of the universe is scanned. This table caches the
-- platform IDs we find on first search so subsequent weekly scans can skip
-- the search phase and hit /artists/{id}/albums directly — cutting API
-- pressure by ~3× and unblocking the overnight-single-pass constraint.
--
-- Apply via the Supabase SQL editor for project kpwklxrcysokuyjhuhun.
-- Safe: new table, no FKs, idempotent via ON CONFLICT on artist_name.

CREATE TABLE IF NOT EXISTS artist_platform_ids (
  artist_name TEXT PRIMARY KEY,
  -- normalized lowercase form for lookup (search is case-insensitive but
  -- artist_name preserves the original display casing)
  artist_name_lower TEXT NOT NULL,
  spotify_artist_id TEXT,
  spotify_display_name TEXT,   -- Spotify's canonical artist name as returned
  apple_artist_id TEXT,
  apple_display_name TEXT,     -- Apple's canonical artist name as returned
  -- When we last successfully resolved each platform (null = never resolved).
  -- Used to re-search stale entries and skip entries verified recently.
  spotify_verified_at TIMESTAMPTZ,
  apple_verified_at TIMESTAMPTZ,
  -- Track lookup failures so we don't waste budget repeatedly searching for
  -- artists that don't exist on a platform. NULL = never searched.
  spotify_not_found_count INT DEFAULT 0,
  apple_not_found_count INT DEFAULT 0,
  spotify_last_error TEXT,
  apple_last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_artist_platform_ids_lower
  ON artist_platform_ids(artist_name_lower);

CREATE INDEX IF NOT EXISTS idx_artist_platform_ids_spotify
  ON artist_platform_ids(spotify_artist_id)
  WHERE spotify_artist_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_artist_platform_ids_apple
  ON artist_platform_ids(apple_artist_id)
  WHERE apple_artist_id IS NOT NULL;

COMMENT ON TABLE artist_platform_ids IS
  'Per-artist cache of Spotify + Apple Music platform IDs. Populated lazily by the weekly scan on first search; subsequent scans skip the search phase and query /artists/{id}/albums directly. Eliminates the rate-limit death spiral that killed chains 4+ in April 2026.';
