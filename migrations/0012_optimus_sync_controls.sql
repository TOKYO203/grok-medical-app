-- User-controlled cloud-learning erasure guard.
-- A tombstone prevents another signed-in device from silently recreating the
-- deleted learning snapshot until the user explicitly re-enables cloud sync.

CREATE TABLE IF NOT EXISTS optimus_sync_controls (
  user_id text PRIMARY KEY,
  suspended_at timestamptz NOT NULL DEFAULT now(),
  reason text NOT NULL DEFAULT 'user_erasure' CHECK (reason IN ('user_erasure'))
);

CREATE INDEX IF NOT EXISTS optimus_sync_controls_suspended_idx
  ON optimus_sync_controls (suspended_at DESC);
