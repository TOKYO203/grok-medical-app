-- Migration 0014 : rate limit signalements (DB-backed)
CREATE TABLE IF NOT EXISTS report_rate_limits (
  id BIGSERIAL PRIMARY KEY,
  identifier TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_report_rate_limits_ident_time
  ON report_rate_limits (identifier, created_at DESC);
