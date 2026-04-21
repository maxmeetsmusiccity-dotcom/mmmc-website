-- Rollback pair for 20260420_2100_writer_claim_submission.sql.
-- Zeta W4 SW6 T3 · R45 convention.
--
-- Drops both tables + their indexes + RLS policies in reverse dependency
-- order. Safe to run only after confirming no production writes landed
-- (writer-claim flow gated by FEATURE FLAG real_writer_sends_authorized=false).

DROP TABLE IF EXISTS public.claim_token_used;
DROP TABLE IF EXISTS public.writer_claim_submission;
