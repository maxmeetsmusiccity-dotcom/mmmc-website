-- ═══════════════════════════════════════════════════════════════
-- WEEKLY NASHVILLE RELEASES CACHE
-- Run in Supabase SQL Editor (project: kpwklxrcysokuyjhuhun)
-- Safe to run multiple times — uses IF NOT EXISTS
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS weekly_nashville_releases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  scan_week DATE NOT NULL,
  spotify_artist_id TEXT,
  artist_name TEXT NOT NULL,
  artist_categories JSONB DEFAULT '[]',
  track_id TEXT NOT NULL,
  track_name TEXT NOT NULL,
  album_name TEXT NOT NULL,
  album_id TEXT,
  album_type TEXT,
  release_date DATE NOT NULL,
  cover_art_640 TEXT,
  cover_art_300 TEXT,
  track_number INTEGER DEFAULT 1,
  duration_ms INTEGER DEFAULT 0,
  explicit BOOLEAN DEFAULT false,
  total_tracks INTEGER DEFAULT 1,
  spotify_url TEXT,
  scanned_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(scan_week, track_id)
);

CREATE INDEX IF NOT EXISTS idx_wnr_week ON weekly_nashville_releases(scan_week);
CREATE INDEX IF NOT EXISTS idx_wnr_artist ON weekly_nashville_releases(spotify_artist_id, scan_week);
CREATE INDEX IF NOT EXISTS idx_wnr_date ON weekly_nashville_releases(release_date);

-- RLS: public read, service role write
ALTER TABLE weekly_nashville_releases ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Public read weekly releases"
  ON weekly_nashville_releases FOR SELECT
  USING (true);

CREATE POLICY IF NOT EXISTS "Service role insert weekly releases"
  ON weekly_nashville_releases FOR INSERT
  WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Service role delete weekly releases"
  ON weekly_nashville_releases FOR DELETE
  USING (true);

-- Scan metadata — tracks when the last scan ran and its status
CREATE TABLE IF NOT EXISTS scan_metadata (
  id TEXT PRIMARY KEY DEFAULT 'nashville_weekly',
  last_scan_week DATE,
  last_scan_at TIMESTAMPTZ,
  total_artists_scanned INTEGER DEFAULT 0,
  total_tracks_found INTEGER DEFAULT 0,
  status TEXT DEFAULT 'idle',
  error TEXT
);

INSERT INTO scan_metadata (id) VALUES ('nashville_weekly') ON CONFLICT DO NOTHING;
