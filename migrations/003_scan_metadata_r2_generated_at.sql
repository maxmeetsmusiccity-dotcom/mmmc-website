-- NMF cron observability: record which R2 browse_artists.json snapshot a given
-- scan run was based on. Paired with the R2-timestamp guard in cron-scan-weekly
-- self-healing (if r2_generated_at > lastPaused.run_date, force full rescan
-- because new artists may have been prepended since the last run).
--
-- Apply via the Supabase SQL editor for project kpwklxrcysokuyjhuhun.
-- Safe: idempotent, additive, nullable. Cron writes this on chain 0 only; older
-- rows predating the migration stay NULL.

ALTER TABLE scan_metadata
  ADD COLUMN IF NOT EXISTS r2_generated_at TIMESTAMPTZ;

COMMENT ON COLUMN scan_metadata.r2_generated_at IS
  'ISO timestamp of the R2 browse_artists.json snapshot used by the most recent scan. Written by api/cron-scan-weekly.ts on chain 0. NULL means the scan predates the migration or R2 was unreachable.';
