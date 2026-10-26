-- RPC atomique de livraison Lemon Squeezy.
-- Remplace la logique TS (delivery.ts) qui utilisait getSql() — impossible sur Cloudflare Workers.

CREATE OR REPLACE FUNCTION public.deliver_lemon_event(
  p_event_key text,
  p_event_name text,
  p_user_id text,
  p_order_reference text,
  p_licence_hash text,
  p_expires_at timestamptz,
  p_paid boolean,
  p_detail jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_claimed boolean := false;
  v_order_status text;
  v_licence_id uuid;
  v_progress text[] := ARRAY['created','instructions_requested','proof_ready','verification_pending','payment_verified','delivered'];
  v_idx int;
  v_next_idx int;
  v_next text;
BEGIN
  -- 1. Claim atomique
  -- `webhook_events` n'a pas de colonne `id` (clé primaire = provider/event_key,
  -- cf. 0016) : `RETURNING id` échouait à la première exécution de la RPC.
  -- `FOUND` (plpgsql) indique si l'INSERT a inséré — false sur conflit :
  -- même sémantique de claim atomique, sans colonne fantôme.
  INSERT INTO webhook_events (provider, event_key, status)
  VALUES ('lemonsqueezy', p_event_key, 'received')
  ON CONFLICT (provider, event_key) DO NOTHING;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('outcome', 'duplicate');
  END IF;

  -- 2. Paid check
  IF NOT p_paid THEN
    UPDATE webhook_events SET status = 'ignored' WHERE provider = 'lemonsqueezy' AND event_key = p_event_key;
    RETURN jsonb_build_object('outcome', 'ignored', 'reason', 'not-paid');
  END IF;

  -- 3. Vérifications
  IF p_user_id IS NULL OR p_user_id = '' THEN
    UPDATE webhook_events SET status = 'unmatched' WHERE provider = 'lemonsqueezy' AND event_key = p_event_key;
    RETURN jsonb_build_object('outcome', 'unmatched', 'reason', 'missing-user');
  END IF;
  IF p_order_reference IS NULL OR p_order_reference = '' THEN
    UPDATE webhook_events SET status = 'unmatched' WHERE provider = 'lemonsqueezy' AND event_key = p_event_key;
    RETURN jsonb_build_object('outcome', 'unmatched', 'reason', 'missing-reference');
  END IF;

  -- 4. Trouver la commande
  SELECT status INTO v_order_status FROM purchase_orders WHERE reference = p_order_reference;
  IF v_order_status IS NULL THEN
    UPDATE webhook_events SET status = 'unmatched' WHERE provider = 'lemonsqueezy' AND event_key = p_event_key;
    RETURN jsonb_build_object('outcome', 'unmatched', 'reason', 'order-not-found');
  END IF;
  IF v_order_status IN ('rejected', 'refunded') THEN
    UPDATE webhook_events SET status = 'ignored' WHERE provider = 'lemonsqueezy' AND event_key = p_event_key;
    RETURN jsonb_build_object('outcome', 'ignored', 'reason', 'order-closed', 'status', v_order_status);
  END IF;

  -- 5. Créer la licence (idempotent via licence_hash unique)
  BEGIN
    INSERT INTO licences (user_id, licence_hash, plan, status, expires_at, activated_at)
    VALUES (p_user_id, p_licence_hash, 'premium', 'active', p_expires_at, now())
    RETURNING id INTO v_licence_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO v_licence_id FROM licences WHERE licence_hash = p_licence_hash LIMIT 1;
  END;

  -- 6. Progresser la commande jusqu'à delivered
  v_idx := array_position(v_progress, v_order_status);
  IF v_idx IS NULL THEN
    UPDATE webhook_events SET status = 'failed' WHERE provider = 'lemonsqueezy' AND event_key = p_event_key;
    RETURN jsonb_build_object('outcome', 'failed', 'reason', 'unknown-status');
  END IF;

  FOR v_next_idx IN (v_idx + 1)..cardinality(v_progress) LOOP
    v_next := v_progress[v_next_idx];
    UPDATE purchase_orders
    SET status = v_next,
        updated_at = now(),
        delivered_at = CASE WHEN v_next = 'delivered' THEN now() ELSE delivered_at END
    WHERE reference = p_order_reference AND status = v_progress[v_next_idx - 1];

    INSERT INTO purchase_order_events (reference, actor_user_id, event_type, metadata)
    VALUES (p_order_reference, p_user_id, v_next, jsonb_build_object('source', 'lemonsqueezy', 'licence_id', v_licence_id));
  END LOOP;

  -- 7. Marquer l'event processed
  UPDATE webhook_events SET status = 'processed' WHERE provider = 'lemonsqueezy' AND event_key = p_event_key;

  RETURN jsonb_build_object(
    'outcome', 'delivered',
    'reference', p_order_reference,
    'user_id', p_user_id,
    'licence_id', v_licence_id,
    'expires_at', p_expires_at
  );
END;
$func$;

-- `service_role` existe sur Supabase mais est ABSENT de PGLite (dev/preview,
-- qui applique les migrations au bootstrap : src/lib/db.ts) comme du PostgreSQL
-- jetable de CI (`npm run db:migrate`) : un GRANT direct y fait échouer la
-- migration — et avec elle le démarrage du serveur de dev (le webServer de
-- Playwright sort en code 1) et le job « PostgreSQL backup / restore smoke ».
-- On n'exécute donc le GRANT que si le rôle existe. Sur une base sans ce rôle,
-- EXECUTE reste accordé à PUBLIC par défaut (PostgreSQL) : l'appel RPC depuis
-- l'app n'est jamais bloqué.
DO $grant$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.deliver_lemon_event(text, text, text, text, text, timestamptz, boolean, jsonb) TO service_role;
  END IF;
END
$grant$;
