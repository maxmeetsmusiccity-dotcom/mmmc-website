-- RLS Tightening Migration — April 8, 2026
-- Restricts write access on sensitive tables to service_role only.
-- Run in Supabase SQL Editor.

-- instagram_handles: only service_role can write (hand-labeled ground truth)
DROP POLICY IF EXISTS instagram_handles_access ON instagram_handles;
CREATE POLICY instagram_handles_read ON instagram_handles FOR SELECT USING (true);
CREATE POLICY instagram_handles_write ON instagram_handles FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY instagram_handles_update ON instagram_handles FOR UPDATE USING (auth.role() = 'service_role');
CREATE POLICY instagram_handles_delete ON instagram_handles FOR DELETE USING (auth.role() = 'service_role');

-- nmf_artist_cache: only service_role can write
DROP POLICY IF EXISTS artist_cache_all ON nmf_artist_cache;
CREATE POLICY artist_cache_read ON nmf_artist_cache FOR SELECT USING (true);
CREATE POLICY artist_cache_write ON nmf_artist_cache FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY artist_cache_update ON nmf_artist_cache FOR UPDATE USING (auth.role() = 'service_role');
CREATE POLICY artist_cache_delete ON nmf_artist_cache FOR DELETE USING (auth.role() = 'service_role');

-- weekly_nashville_releases: only service_role can write (populated by cron)
DROP POLICY IF EXISTS weekly_releases_read ON weekly_nashville_releases;
DROP POLICY IF EXISTS weekly_releases_insert ON weekly_nashville_releases;
DROP POLICY IF EXISTS weekly_releases_delete ON weekly_nashville_releases;
CREATE POLICY weekly_releases_read ON weekly_nashville_releases FOR SELECT USING (true);
CREATE POLICY weekly_releases_write ON weekly_nashville_releases FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY weekly_releases_update ON weekly_nashville_releases FOR UPDATE USING (auth.role() = 'service_role');
CREATE POLICY weekly_releases_delete ON weekly_nashville_releases FOR DELETE USING (auth.role() = 'service_role');

-- nmf_submissions: restrict reads to own submissions or service_role
DROP POLICY IF EXISTS submissions_read ON nmf_submissions;
DROP POLICY IF EXISTS submissions_insert ON nmf_submissions;
CREATE POLICY submissions_read ON nmf_submissions FOR SELECT
  USING (auth.uid()::text = submitter_email OR auth.role() = 'service_role');
CREATE POLICY submissions_insert ON nmf_submissions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
