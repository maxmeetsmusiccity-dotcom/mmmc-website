-- NMF Platform Migration v2 — Run in Supabase SQL Editor

-- User profiles
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'user',
  preferred_template TEXT DEFAULT 'mmmc_classic',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own profile" ON user_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON user_profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Add user_id to existing tables (nullable for backward compat)
ALTER TABLE nmf_weeks ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE nmf_features ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
CREATE INDEX IF NOT EXISTS idx_nmf_weeks_user ON nmf_weeks(user_id);

-- Update RLS to be user-scoped
DROP POLICY IF EXISTS "Allow all for nmf_weeks" ON nmf_weeks;
CREATE POLICY "Users CRUD own weeks" ON nmf_weeks FOR ALL USING (auth.uid() = user_id OR user_id IS NULL);
DROP POLICY IF EXISTS "Allow all for nmf_features" ON nmf_features;
CREATE POLICY "Users CRUD own features" ON nmf_features FOR ALL USING (auth.uid() = user_id OR user_id IS NULL);

-- Artist watchlists per user
CREATE TABLE IF NOT EXISTS user_watchlists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  spotify_artist_id TEXT,
  apple_music_artist_id TEXT,
  artist_name TEXT NOT NULL,
  added_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, artist_name)
);
ALTER TABLE user_watchlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users CRUD own watchlist" ON user_watchlists FOR ALL USING (auth.uid() = user_id);

-- Artist cache
CREATE TABLE IF NOT EXISTS nmf_artist_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cached_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  artists JSONB NOT NULL
);
ALTER TABLE nmf_artist_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for artist cache" ON nmf_artist_cache FOR ALL USING (true) WITH CHECK (true);

-- Label/PR submissions
CREATE TABLE IF NOT EXISTS nmf_submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  track_url TEXT NOT NULL,
  pitch TEXT,
  submitter_name TEXT NOT NULL,
  submitter_email TEXT NOT NULL,
  label_name TEXT,
  target_curator_id UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE nmf_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can submit" ON nmf_submissions FOR INSERT WITH CHECK (true);
CREATE POLICY "Curators read own submissions" ON nmf_submissions FOR SELECT USING (auth.uid() = target_curator_id);
CREATE POLICY "Curators update own submissions" ON nmf_submissions FOR UPDATE USING (auth.uid() = target_curator_id);

-- Pre-release embargo schema (future)
CREATE TABLE IF NOT EXISTS pre_releases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  track_name TEXT NOT NULL,
  artist_name TEXT NOT NULL,
  embargo_date DATE NOT NULL,
  watermarked_preview_url TEXT,
  submitting_label TEXT,
  target_curator_ids UUID[],
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE pre_releases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Curators read targeted pre-releases" ON pre_releases FOR SELECT USING (auth.uid() = ANY(target_curator_ids));
