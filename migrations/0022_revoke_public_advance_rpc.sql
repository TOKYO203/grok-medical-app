-- migrations/0022_revoke_public_advance_rpc.sql
-- Durcissement sécurité réclamé par l'en-tête de 0018 (point 1 : GRANT TO PUBLIC).
-- Réf: migrations/0018_advance_premium_rpc.sql (⚠️ en-tête « à durcir dans une PR
-- séparée » — c'est cette PR).
--
-- Ce qui change : plus aucun EXECUTE pour PUBLIC (donc anon / authenticated) sur
-- advance_premium_purchase_order. Verrou sur l'énumération :
--   · avant : quiconque connaît (user_id, référence) peut avancer la commande
--     d'un tiers depuis l'API Postgres avec la clé anon ;
--   · après : seul le propriétaire du rôle de la fonction (postgres) et,
--     conditionnellement, service_role peuvent l'exécuter.
--
-- Pourquoi c'est sans risque pour l'app (vérifié avant d'écrire cette
-- migration) : l'unique appelant est src/lib/purchase-orders.ts, qui appelle la
-- RPC via createClient(url, resolveSupabaseServiceKey(env)) — la clé de SERVICE,
-- côté serveur, derrière authMiddleware qui garantit context.userId = session
-- authentifiée. Aucun appel navigateur (clé anon) n'existe : recherche
-- \"advance_premium_purchase_order\" limitée à purchase-orders.ts et 0018.
--
-- Pourquoi le point 2 de l'en-tête (valider p_user_id contre auth.uid()) n'est
-- PAS implémenté ici : l'appel légitime se fait avec la clé de service, sans
-- session utilisateur, donc auth.uid() est NULL dans la RPC — ajouter ce contrôle
-- casserait l'app au lieu de la durcir. L'authentification du user_id est déjà
-- assurée en amont par authMiddleware (session serveur) ; la surface d'attaque
-- résiduelle est fermée par le REVOKE FROM PUBLIC ci-dessous.
--
-- Compatibilité hors Supabase (même pattern que 0018/0019/0020) : service_role
-- n'existe ni dans PGLite (dev/preview, bootstrap src/lib/db.ts) ni dans le
-- PostgreSQL jetable de CI — le GRANT reste conditionnel, sinon la migration
-- échouerait et tuerait le démarrage du serveur de dev (webServer Playwright
-- exit 1, vu le 2026-11-08).

-- NOTE 2026-11-08 : les BEGIN/COMMIT hérités de l'extrait de prod sont
-- supprimés. Le répétiteur de staging (scripts/staging-migration.mjs) possède
-- déjà la transaction : un COMMIT imbriqué la validait en pleine répétition,
-- détruisait les tables preuves (ON COMMIT DROP) et rendait son ROLLBACK
-- inopérant. Hors répétiteur, chaque instruction reste atomique en autocommit
-- (npm run db:migrate, bootstrap PGlite) — l'état final est identique.


REVOKE EXECUTE ON FUNCTION public.advance_premium_purchase_order(text, text, text) FROM PUBLIC;

DO $grant$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.advance_premium_purchase_order(text, text, text) TO service_role;
  END IF;
END
$grant$;

COMMENT ON FUNCTION public.advance_premium_purchase_order(text, text, text)
  IS 'Avance une commande premium (state machine : created → instructions_requested). Extraite de la prod le 2026-11-06 ; durcie le 2026-11-08 (0022) : EXECUTE révoqué à PUBLIC, réservé au rôle propriétaire et service_role.';

