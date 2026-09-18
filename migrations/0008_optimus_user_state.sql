-- Server-side Optimus learning snapshot, scoped exclusively by the verified Better Auth user id.
-- Device-bound secrets, encrypted Deck material and license receipts are intentionally NOT stored here.

CREATE TABLE IF NOT EXISTS optimus_user_state (
  user_id text PRIMARY KEY,
  optimus_id text NOT NULL UNIQUE,
  state jsonb NOT NULL,
  revision bigint NOT NULL DEFAULT 1 CHECK (revision >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS optimus_user_state_updated_at_idx
  ON optimus_user_state (updated_at DESC);
