-- NMF Platform Migration v3 — Two-product routing, publicist dashboard, monetization

-- Add role and subscription fields to user_profiles
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS user_role TEXT DEFAULT 'curator'; -- 'curator', 'publicist', 'admin'
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free'; -- 'free', 'intelligence', 'submissions', 'priority'
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'inactive';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS products_access JSONB DEFAULT '{"nmf": true, "nd": false, "cwc": false}'::jsonb;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS tos_accepted_at TIMESTAMPTZ;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS tos_version TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS genre_focus TEXT[];
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS bio TEXT;

-- Curator public profiles
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(user_role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_username ON user_profiles(username);

-- Allow publicists to read curator profiles (public data)
DROP POLICY IF EXISTS "Users read own profile" ON user_profiles;
CREATE POLICY "Users read own or curator profiles" ON user_profiles FOR SELECT
  USING (auth.uid() = id OR user_role = 'curator');

-- Submission matches (publicist → curator relevance scoring)
CREATE TABLE IF NOT EXISTS submission_matches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id UUID NOT NULL REFERENCES nmf_submissions(id) ON DELETE CASCADE,
  curator_id UUID NOT NULL REFERENCES auth.users(id),
  relevance_score REAL NOT NULL DEFAULT 0,
  genre_overlap REAL DEFAULT 0,
  artist_similarity REAL DEFAULT 0,
  status TEXT DEFAULT 'pending', -- 'pending', 'viewed', 'accepted', 'skipped'
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE submission_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Publicists read own matches" ON submission_matches FOR SELECT
  USING (EXISTS (SELECT 1 FROM nmf_submissions s WHERE s.id = submission_id AND s.submitter_email = (SELECT email FROM user_profiles WHERE id = auth.uid())));
CREATE POLICY "Curators read targeted matches" ON submission_matches FOR SELECT
  USING (auth.uid() = curator_id);
CREATE POLICY "Curators update own matches" ON submission_matches FOR UPDATE
  USING (auth.uid() = curator_id);

-- Usage events (publicist actions)
CREATE TABLE IF NOT EXISTS usage_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  event_type TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own events" ON usage_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own events" ON usage_events FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_user ON usage_events(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_type ON usage_events(event_type);

-- Custom templates
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
ALTER TABLE custom_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users CRUD own templates" ON custom_templates FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Anyone reads public templates" ON custom_templates FOR SELECT USING (is_public = true);

-- Update nmf_submissions with status tracking per curator
ALTER TABLE nmf_submissions ADD COLUMN IF NOT EXISTS status_detail JSONB DEFAULT '{}'; -- {curator_id: 'accepted'|'skipped'|'pending'}
