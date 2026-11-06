-- migrations/0018_advance_premium_rpc.sql
-- Versioning de la RPC advance_premium_purchase_order
-- Extraite de la prod Supabase le 2026-11-06
-- Réf: migrations/TODO-advance-premium-rpc.md
--
-- Contexte : cette fonction existait uniquement en prod, ce qui rendait la
-- base non reproductible (staging, nouveaux environnements, DR).
--
-- ⚠️  SÉCURITÉ — à durcir dans une PR séparée (ne PAS modifier ici : risque
--    de casser la prod si l'app dépend du grant PUBLIC).
--    1. GRANT EXECUTE TO PUBLIC : anon + authenticated peuvent appeler la RPC.
--       Combiné à p_user_id et p_reference en paramètres, un attaquant qui
--       connaît les deux peut avancer la commande d'un tiers.
--       → envisager REVOKE FROM PUBLIC + GRANT TO authenticated, service_role
--         (vérifier d'abord comment l'app appelle).
--    2. Le corps ne valide pas p_user_id contre auth.uid() : la RPC accepte
--       n'importe quel user_id si la référence correspond.
--    3. State machine partielle : seule la transition
--       'created' → 'instructions_requested' est gérée. Les autres
--       p_new_status renvoient la commande inchangée (pas d'erreur).
--
-- Seule différence avec la prod : ajout de 'pg_temp' au search_path
-- (bonne pratique anti-injection sur SECURITY DEFINER, ne change rien
-- au comportement observable).

BEGIN;

CREATE OR REPLACE FUNCTION public.advance_premium_purchase_order(
  p_user_id text,
  p_reference text,
  p_new_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_row purchase_orders%rowtype;
BEGIN
  SELECT * INTO v_row
  FROM purchase_orders
  WHERE reference = p_reference AND user_id = p_user_id
  LIMIT 1;

  IF v_row.reference IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_row.status = 'created' AND p_new_status = 'instructions_requested' THEN
    UPDATE purchase_orders
    SET status = 'instructions_requested',
        payment_provider = 'mobile_money',
        updated_at = now()
    WHERE reference = p_reference
    RETURNING * INTO v_row;

    INSERT INTO purchase_order_events (reference, actor_user_id, event_type, metadata)
    VALUES (p_reference, p_user_id, 'instructions_requested',
            jsonb_build_object('provider', 'mobile_money'));
  END IF;

  RETURN to_jsonb(v_row);
END;
$$;

-- Grants reproduits à l'identique depuis la prod (pg_proc.proacl).
-- ⚠️  PUBLIC : à durcir dans une PR dédiée (voir en-tête).
GRANT EXECUTE ON FUNCTION public.advance_premium_purchase_order(text, text, text) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.advance_premium_purchase_order(text, text, text) TO postgres;
GRANT EXECUTE ON FUNCTION public.advance_premium_purchase_order(text, text, text) TO service_role;

COMMENT ON FUNCTION public.advance_premium_purchase_order(text, text, text)
  IS 'Avance une commande premium (state machine : created → instructions_requested). Extraite de la prod le 2026-11-06 ; ajout de pg_temp au search_path.';

COMMIT;
