-- Wave 6 Block 2: fix cron self-healing offset math
--
-- Before: resume offset was derived as (chain_number * BATCH_SIZE + artists_scanned).
-- That's correct only when chains always start at chain_number * BATCH_SIZE.
-- Block 7 of Wave 5 (self-healing) breaks that invariant — when chain 0 resumes
-- from offset 500, the next cron run computes (0 * 2000 + 2000) = 2000 and
-- silently skips the range [500, 2500).
--
-- Fix: persist the actual starting offset on each scan_runs row so resume
-- becomes start_offset + artists_scanned regardless of how the chain was
-- invoked.
--
-- Apply via the Supabase SQL editor for project kpwklxrcysokuyjhuhun.
-- Safe: idempotent, additive, default 0. Existing rows are back-compat with
-- the pre-Block-7 invariant (chain 0 → offset 0).

ALTER TABLE scan_runs
  ADD COLUMN IF NOT EXISTS start_offset INTEGER DEFAULT 0;

COMMENT ON COLUMN scan_runs.start_offset IS
  'Artist index where this chain began scanning. Written at chain start. Used by cron self-healing to compute correct resume offset (start_offset + artists_scanned) regardless of whether the chain was triggered fresh, via explicit offset query param, or via self-healing recovery.';
