-- ═══════════════════════════════════════════════════════════════
-- NMF PLATFORM — CONSOLIDATED SUPABASE MIGRATION
-- Run this in Supabase SQL Editor (project: kpwklxrcysokuyjhuhun)
-- Safe to run multiple times — all statements use IF NOT EXISTS
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. CORE TABLES (from schema.sql) ───────────────────────

CREATE TABLE IF NOT EXISTS nmf_weeks (
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

CREATE TABLE IF NOT EXISTS instagram_handles (
  spotify_artist_id TEXT PRIMARY KEY,
  artist_name TEXT NOT NULL,
  instagram_handle TEXT,
  nd_pg_id TEXT,
  source TEXT DEFAULT 'unknown',
  confidence REAL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nmf_features (
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

CREATE INDEX IF NOT EXISTS idx_nmf_features_artist ON nmf_features(spotify_artist_id);
CREATE INDEX IF NOT EXISTS idx_nmf_features_week ON nmf_features(week_date);

-- ─── 2. USER PROFILES (from v2) ────────────────────────────

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

-- Add columns from v2, v3, v4 (safe to run if already exist)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS user_role TEXT DEFAULT 'curator';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'inactive';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS products_access JSONB DEFAULT '{"nmf": true, "nd": false, "cwc": false}'::jsonb;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS tos_accepted_at TIMESTAMPTZ;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS tos_version TEXT DEFAULT '1.0';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS genre_focus TEXT[];
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS bio TEXT;

-- Add user_id FK to core tables
ALTER TABLE nmf_weeks ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE nmf_features ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
CREATE INDEX IF NOT EXISTS idx_nmf_weeks_user ON nmf_weeks(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(user_role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_username ON user_profiles(username);

-- ─── 3. SUBMISSIONS (from v2) ──────────────────────────────

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

ALTER TABLE nmf_submissions ADD COLUMN IF NOT EXISTS status_detail JSONB DEFAULT '{}';
ALTER TABLE nmf_submissions ADD COLUMN IF NOT EXISTS artist_name TEXT;
ALTER TABLE nmf_submissions ADD COLUMN IF NOT EXISTS genre TEXT;

-- ─── 4. SUBMISSION MATCHES (from v3) ───────────────────────

CREATE TABLE IF NOT EXISTS submission_matches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id UUID NOT NULL REFERENCES nmf_submissions(id) ON DELETE CASCADE,
  curator_id UUID NOT NULL REFERENCES auth.users(id),
  relevance_score REAL NOT NULL DEFAULT 0,
  genre_overlap REAL DEFAULT 0,
  artist_similarity REAL DEFAULT 0,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 5. USAGE EVENTS (from v3/v4) ─────────────────────────

CREATE TABLE IF NOT EXISTS usage_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  action TEXT,
  event_type TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usage_events_action ON usage_events(action);
CREATE INDEX IF NOT EXISTS idx_usage_events_user ON usage_events(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_created ON usage_events(created_at DESC);

-- ─── 6. CUSTOM TEMPLATES (from v3/v4) ─────────────────────

CREATE TABLE IF NOT EXISTS custom_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_name TEXT NOT NULL,
  config JSONB NOT NULL,
  background_asset_url TEXT,
  logo_url TEXT,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_custom_templates_user ON custom_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_templates_public ON custom_templates(is_public) WHERE is_public = true;

-- ─── 7. SUPPORTING TABLES (from v2) ───────────────────────

CREATE TABLE IF NOT EXISTS user_watchlists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  spotify_artist_id TEXT,
  apple_music_artist_id TEXT,
  artist_name TEXT NOT NULL,
  added_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, artist_name)
);

CREATE TABLE IF NOT EXISTS nmf_artist_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cached_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  artists JSONB NOT NULL
);

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

-- ─── 8. ROW LEVEL SECURITY ────────────────────────────────

ALTER TABLE nmf_weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE instagram_handles ENABLE ROW LEVEL SECURITY;
ALTER TABLE nmf_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE nmf_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_watchlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE nmf_artist_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE pre_releases ENABLE ROW LEVEL SECURITY;

-- Drop old policies (safe — no error if they don't exist)
DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow all for nmf_weeks" ON nmf_weeks;
  DROP POLICY IF EXISTS "Allow all for instagram_handles" ON instagram_handles;
  DROP POLICY IF EXISTS "Allow all for nmf_features" ON nmf_features;
  DROP POLICY IF EXISTS "Users read own profile" ON user_profiles;
  DROP POLICY IF EXISTS "Users can insert own events" ON usage_events;
  DROP POLICY IF EXISTS "Users can read own events" ON usage_events;
  DROP POLICY IF EXISTS "Users can manage own templates" ON custom_templates;
  DROP POLICY IF EXISTS "Public templates viewable by all" ON custom_templates;
END $$;

-- Core tables: user-scoped or open
CREATE POLICY "nmf_weeks_access" ON nmf_weeks FOR ALL USING (auth.uid() = user_id OR user_id IS NULL) WITH CHECK (true);
CREATE POLICY "instagram_handles_access" ON instagram_handles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "nmf_features_access" ON nmf_features FOR ALL USING (auth.uid() = user_id OR user_id IS NULL) WITH CHECK (true);

-- User profiles: own + read curators
CREATE POLICY "profiles_read" ON user_profiles FOR SELECT USING (auth.uid() = id OR user_role = 'curator');
CREATE POLICY "profiles_insert" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON user_profiles FOR UPDATE USING (auth.uid() = id);

-- Submissions: anyone can submit, curators read targeted
CREATE POLICY "submissions_insert" ON nmf_submissions FOR INSERT WITH CHECK (true);
CREATE POLICY "submissions_read" ON nmf_submissions FOR SELECT USING (true);
CREATE POLICY "submissions_update" ON nmf_submissions FOR UPDATE USING (auth.uid() = target_curator_id);

-- Matches: curators read/update own
CREATE POLICY "matches_read" ON submission_matches FOR SELECT USING (auth.uid() = curator_id);
CREATE POLICY "matches_update" ON submission_matches FOR UPDATE USING (auth.uid() = curator_id);

-- Usage events: insert freely, read own
CREATE POLICY "events_insert" ON usage_events FOR INSERT WITH CHECK (true);
CREATE POLICY "events_read" ON usage_events FOR SELECT USING (auth.uid() = user_id);

-- Custom templates: own + public
CREATE POLICY "templates_own" ON custom_templates FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "templates_public" ON custom_templates FOR SELECT USING (is_public = true);

-- Supporting tables
CREATE POLICY "watchlists_own" ON user_watchlists FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "artist_cache_all" ON nmf_artist_cache FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "pre_releases_curators" ON pre_releases FOR SELECT USING (auth.uid() = ANY(target_curator_ids));

-- ─── 9. STORAGE SETUP (do manually in Dashboard) ──────────
-- Go to Supabase Dashboard > Storage > Create bucket:
--   Name: carousels
--   Public: true
--   File size limit: 10MB
--   Allowed MIME types: image/png, image/jpeg
--
-- Then in Storage > Policies:
--   SELECT: allow public access
--   INSERT: authenticated users only
--   UPDATE: authenticated users only
--   DELETE: authenticated users only
