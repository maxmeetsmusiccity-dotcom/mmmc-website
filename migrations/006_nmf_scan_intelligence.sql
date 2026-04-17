-- NMF scan intelligence staging table.
--
-- Thread C (the NMF weekly scan) writes here after every scan with discoveries
-- that flow back to Thread A's ND cascade:
--   - Newly discovered Apple artist IDs (ISRC-verified)
--   - Apple matches rejected as pollution
--   - Stale Spotify IDs (404 on /artists/{id}/albums)
--   - Collaboration signals (2+ Nashville-universe artists on same track)
--   - Release velocity / dormancy
--   - Rate-limit incidents during the scan
--
-- Thread A's cascade polls this table, ingests unflagged rows, and sets
-- ingested_by_cascade = true. Over weekly cycles, ND's data quality improves
-- automatically.
--
-- Apply via the Supabase SQL editor for project kpwklxrcysokuyjhuhun.
-- Safe: new table, no FKs, append-only from NMF side.

CREATE TABLE IF NOT EXISTS nmf_scan_intelligence (
  id BIGSERIAL PRIMARY KEY,
  scan_week DATE NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  scanner TEXT NOT NULL,                            -- 'nmf_weekly_cron' | 'nmf_manual' | 'nmf_follow_list'
  artifact JSONB NOT NULL,                          -- full ScanIntelligence object
  apple_ids_discovered_count INT DEFAULT 0,
  apple_rejections_count INT DEFAULT 0,
  stale_spotify_ids_count INT DEFAULT 0,
  collaboration_signals_count INT DEFAULT 0,
  release_velocity_count INT DEFAULT 0,
  rate_limit_incidents_count INT DEFAULT 0,
  tracks_found INT DEFAULT 0,
  ingested_by_cascade BOOLEAN DEFAULT FALSE,
  ingested_at TIMESTAMPTZ,
  ingest_notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_nmf_intel_pending
  ON nmf_scan_intelligence(generated_at)
  WHERE ingested_by_cascade = FALSE;

CREATE INDEX IF NOT EXISTS idx_nmf_intel_week
  ON nmf_scan_intelligence(scan_week DESC);

COMMENT ON TABLE nmf_scan_intelligence IS
  'Two-way loop: NMF scan findings feeding back to ND cascade. Thread A polls WHERE ingested_by_cascade = FALSE, applies the signals, flips the flag.';
COMMENT ON COLUMN nmf_scan_intelligence.artifact IS
  'Full ScanIntelligence JSON — see api/_scan_intelligence.ts for schema.';
