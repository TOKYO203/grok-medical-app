CREATE TABLE IF NOT EXISTS activation_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash text UNIQUE NOT NULL,
  optimus_id text NOT NULL,
  device_id text,
  product text NOT NULL,
  expires_at timestamptz,
  activated_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activation_keys_optimus_id_idx ON activation_keys (optimus_id);
