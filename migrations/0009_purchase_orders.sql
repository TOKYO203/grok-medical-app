-- Server-authoritative Premium purchase orders and immutable audit events.
-- Client devices may create/update their own pre-verification workflow, but delivery/rejection
-- decisions are server-authorized separately.

CREATE TABLE IF NOT EXISTS purchase_orders (
  reference text PRIMARY KEY,
  user_id text NOT NULL,
  client_request_id text NOT NULL,
  optimus_id text NOT NULL,
  offer text NOT NULL CHECK (offer IN ('deck', 'specialty')),
  specialty text NOT NULL,
  deck_number integer NOT NULL CHECK (deck_number BETWEEN 1 AND 10),
  product text NOT NULL,
  label text NOT NULL,
  amount integer NOT NULL CHECK (amount > 0),
  status text NOT NULL DEFAULT 'created' CHECK (
    status IN (
      'created',
      'instructions_requested',
      'proof_ready',
      'verification_pending',
      'delivered',
      'rejected',
      'refunded'
    )
  ),
  proof_attached boolean NOT NULL DEFAULT false,
  device_id text,
  device_key_id text,
  device_public_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  rejected_at timestamptz,
  refunded_at timestamptz,
  UNIQUE (user_id, client_request_id)
);

CREATE INDEX IF NOT EXISTS purchase_orders_user_updated_idx
  ON purchase_orders (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS purchase_orders_status_updated_idx
  ON purchase_orders (status, updated_at ASC);

CREATE TABLE IF NOT EXISTS purchase_order_events (
  id bigserial PRIMARY KEY,
  reference text NOT NULL REFERENCES purchase_orders(reference) ON DELETE CASCADE,
  actor_user_id text,
  event_type text NOT NULL CHECK (
    event_type IN (
      'created',
      'instructions_requested',
      'proof_ready',
      'verification_pending',
      'delivered',
      'rejected',
      'refunded'
    )
  ),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS purchase_order_events_reference_idx
  ON purchase_order_events (reference, created_at ASC);
