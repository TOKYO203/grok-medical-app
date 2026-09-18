-- Payment verification metadata is server-side and replay-resistant.
-- The receipt/proof file itself is not persisted here; only a digest and the operator transaction reference.

ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS payment_provider text,
  ADD COLUMN IF NOT EXISTS payment_reference text,
  ADD COLUMN IF NOT EXISTS proof_digest text,
  ADD COLUMN IF NOT EXISTS payment_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_verified_at timestamptz;

ALTER TABLE purchase_orders
  DROP CONSTRAINT IF EXISTS purchase_orders_status_check;

ALTER TABLE purchase_orders
  ADD CONSTRAINT purchase_orders_status_check CHECK (
    status IN (
      'created',
      'instructions_requested',
      'proof_ready',
      'verification_pending',
      'payment_verified',
      'delivered',
      'rejected',
      'refunded'
    )
  );

ALTER TABLE purchase_order_events
  DROP CONSTRAINT IF EXISTS purchase_order_events_event_type_check;

ALTER TABLE purchase_order_events
  ADD CONSTRAINT purchase_order_events_event_type_check CHECK (
    event_type IN (
      'created',
      'instructions_requested',
      'proof_ready',
      'verification_pending',
      'payment_verified',
      'delivered',
      'rejected',
      'refunded'
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS purchase_orders_payment_reference_unique_idx
  ON purchase_orders (payment_provider, payment_reference)
  WHERE payment_reference IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS purchase_orders_proof_digest_unique_idx
  ON purchase_orders (proof_digest)
  WHERE proof_digest IS NOT NULL;

ALTER TABLE activation_keys
  ADD COLUMN IF NOT EXISTS purchase_reference text REFERENCES purchase_orders(reference) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS activation_keys_purchase_reference_idx
  ON activation_keys (purchase_reference);
