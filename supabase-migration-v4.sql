-- Migration v4: ToS acceptance tracking, products_access, usage_events
-- Run against Supabase project: kpwklxrcysokuyjhuhun

-- ToS acceptance tracking on user_profiles
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS tos_accepted_at timestamptz;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS tos_version text DEFAULT '1.0';

-- Products access (NMF, Nashville Decoder, CoWrite Compass)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS products_access jsonb DEFAULT '{"nmf": true, "nd": false, "cwc": false}'::jsonb;

-- Usage events table for publicist action logging
CREATE TABLE IF NOT EXISTS usage_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usage_events_action ON usage_events(action);
CREATE INDEX IF NOT EXISTS idx_usage_events_user ON usage_events(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_created ON usage_events(created_at DESC);

-- RLS: users can insert their own events, admins can read all
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert own events" ON usage_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can read own events" ON usage_events FOR SELECT USING (auth.uid() = user_id);

-- Supabase Storage: carousel bucket
-- Run in Supabase Dashboard > Storage > Create bucket:
--   Name: carousels
--   Public: true (for archive display)
--   File size limit: 10MB
--   Allowed MIME types: image/png, image/jpeg
--
-- Storage policies (create in Dashboard > Storage > Policies):
--   SELECT: allow public access (for public archive)
--   INSERT: authenticated users only
--   UPDATE: authenticated users only
--   DELETE: authenticated users only

-- Custom templates table
CREATE TABLE IF NOT EXISTS custom_templates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  template_name text NOT NULL,
  config jsonb NOT NULL,
  background_asset_url text,
  logo_url text,
  is_public boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE custom_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own templates" ON custom_templates FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Public templates viewable by all" ON custom_templates FOR SELECT USING (is_public = true);

CREATE INDEX IF NOT EXISTS idx_custom_templates_user ON custom_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_templates_public ON custom_templates(is_public) WHERE is_public = true;
