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
