-- NMF Tool — Supabase Schema
-- Run this in the Supabase SQL editor after creating the project

-- Week history
CREATE TABLE nmf_weeks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  week_date DATE NOT NULL UNIQUE,
  all_releases JSONB,
  selections JSONB,
  cover_feature JSONB,
  instagram_handles JSONB,
  manifest_curated JSONB,
  playlist_master_pushed BOOLEAN DEFAULT false,
  playlist_new_id TEXT,
  playlist_new_url TEXT,
  carousel_generated BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Instagram handles (shared resource, grows over time)
CREATE TABLE instagram_handles (
  spotify_artist_id TEXT PRIMARY KEY,
  artist_name TEXT NOT NULL,
  instagram_handle TEXT,
  nd_pg_id TEXT,
  source TEXT DEFAULT 'unknown',
  confidence REAL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- NMF feature tracking (one row per featured track per week)
CREATE TABLE nmf_features (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  week_date DATE NOT NULL,
  spotify_artist_id TEXT NOT NULL,
  artist_name TEXT NOT NULL,
  track_name TEXT NOT NULL,
  track_spotify_id TEXT,
  album_name TEXT,
  slide_number INTEGER,
  slide_position INTEGER,
  was_cover_feature BOOLEAN DEFAULT false,
  nd_pg_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(week_date, track_spotify_id)
);

CREATE INDEX idx_nmf_features_artist ON nmf_features(spotify_artist_id);
CREATE INDEX idx_nmf_features_week ON nmf_features(week_date);
CREATE INDEX idx_nmf_features_track_name ON nmf_features USING gin(to_tsvector('english', track_name));
CREATE INDEX idx_nmf_features_artist_name ON nmf_features USING gin(to_tsvector('english', artist_name));

-- Enable Row Level Security but allow all for now (single-user tool)
ALTER TABLE nmf_weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE instagram_handles ENABLE ROW LEVEL SECURITY;
ALTER TABLE nmf_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for nmf_weeks" ON nmf_weeks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for instagram_handles" ON instagram_handles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for nmf_features" ON nmf_features FOR ALL USING (true) WITH CHECK (true);
