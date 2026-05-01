-- Zeta W4 SW6 T3 · writer-claim submission schema (Option B full spec).
--
-- Two-table schema backing the magic-link writer-claim flow:
--   writer_claim_submission — submissions writers leave via /claim/:pg_id/:token
--   claim_token_used        — single-use enforcement for magic-link tokens
--
-- Strategy pre-approval: ACK 2026-04-20 20:55 CT
--   from_strategy_to_zeta__t10_writer_claim_OPTION_B_full_spec_NO_DEFERRALS...
-- Pre-destructive audit: from_zeta_to_strategy__t3_schema_migration_pre_destructive_audit__2055.md
--
-- Non-destructive (CREATE-only). Idempotent (IF NOT EXISTS).
-- Rollback pair: 20260420_2100_writer_claim_submission_rollback.sql
--
-- RLS posture (both tables):
--   * service_role: FULL ACCESS (Max reviews submissions, API inserts after
--     HMAC verification)
--   * no anon/authenticated policies → fails closed for public queries
--
-- All writes are driven by /api/claim/submit which:
--   1. HMAC-verifies the token (payload signed with MAGIC_LINK_SECRET)
--   2. Checks claim_token_used for single-use enforcement
--   3. Writes to writer_claim_submission + claim_token_used via service_role key
--
-- pg_id is the persistent-grain-ID MMMC uses for writers/artists; same column
-- used in artist_platform_ids.pg_id + nd_pg_id throughout NMF Curator Studio.

-- -------------------------------------------------------------------------
-- Table 1: writer_claim_submission
-- -------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.writer_claim_submission (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pg_id text NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  submission_ip text,
  user_agent text,
  confirmed_instagram_handle text,
  corrected_instagram_handle text,
  notes text,
  alpha_reviewed_at timestamptz,
  alpha_review_decision text,
  CONSTRAINT writer_claim_submission_decision_chk
    CHECK (alpha_review_decision IS NULL
           OR alpha_review_decision IN ('promoted', 'rejected', 'pending_more_info'))
);

CREATE INDEX IF NOT EXISTS idx_writer_claim_submission_pg_id
  ON public.writer_claim_submission (pg_id);

CREATE INDEX IF NOT EXISTS idx_writer_claim_submission_alpha_reviewed_at
  ON public.writer_claim_submission (alpha_reviewed_at);

ALTER TABLE public.writer_claim_submission ENABLE ROW LEVEL SECURITY;

-- service_role full access (Max + server-side API inserts).
DROP POLICY IF EXISTS wcs_service_all ON public.writer_claim_submission;
CREATE POLICY wcs_service_all
  ON public.writer_claim_submission
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- -------------------------------------------------------------------------
-- Table 2: claim_token_used
-- -------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.claim_token_used (
  token_hash text PRIMARY KEY,
  pg_id text NOT NULL,
  used_at timestamptz NOT NULL DEFAULT now(),
  used_from_ip text
);

CREATE INDEX IF NOT EXISTS idx_claim_token_used_pg_id_used_at
  ON public.claim_token_used (pg_id, used_at);

ALTER TABLE public.claim_token_used ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ctu_service_all ON public.claim_token_used;
CREATE POLICY ctu_service_all
  ON public.claim_token_used
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- -------------------------------------------------------------------------
-- Verification (informational; PG ignores in plain SQL file):
--   SELECT COUNT(*) FROM information_schema.tables
--     WHERE table_schema='public' AND table_name IN ('writer_claim_submission','claim_token_used');
--   -- expect 2
--
--   SELECT tablename, rowsecurity FROM pg_tables
--     WHERE tablename IN ('writer_claim_submission','claim_token_used');
--   -- expect rowsecurity=true for both
-- -------------------------------------------------------------------------
