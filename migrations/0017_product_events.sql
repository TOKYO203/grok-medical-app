-- 0017 — Mesure produit : savoir qui active, qui revient, qui paie.
--
-- Jusqu'ici aucune donnée d'usage n'était collectée : un inscrit qui lisait une
-- fiche puis disparaissait était indistinguable d'un étudiant quotidien. Sans
-- cela, aucune décision produit (ni aucune amélioration de la rétention) ne peut
-- être évaluée.
--
-- CHOIX ASSUMÉS
--   • Auto-hébergé : aucun tiers, aucun cookie, aucune bannière de consentement
--     supplémentaire (pas de traçage publicitaire, finalité strictement produit).
--   • `anon_id` = identifiant ALÉATOIRE généré dans le navigateur, jamais lié à
--     une identité : il permet de suivre un parcours (funnel) sans savoir qui.
--   • `user_id` reste NULLABLE et n'est renseigné que si une session existe déjà
--     côté serveur — jamais envoyé par le client.
--   • Propriétés : objet de scalaires courts, nettoyé côté serveur (pas de texte
--     libre, pas d'e-mail, pas d'URL) pour qu'aucune donnée personnelle ne
--     puisse entrer par accident.

CREATE TABLE IF NOT EXISTS product_events (
  id          bigserial PRIMARY KEY,
  name        text        NOT NULL,
  anon_id     text,
  user_id     text,
  props       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  day         date        NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  -- Un nom d'événement est un identifiant technique, pas une phrase :
  -- on borne la casse et la longueur pour garder les agrégations stables.
  CONSTRAINT product_events_name_shape CHECK (name ~ '^[a-z][a-z0-9_]{2,47}$'),
  -- Un anon_id est un identifiant opaque (16 à 40 caractères alphanumériques),
  -- et JAMAIS un UUID : sans cette exclusion, une version modifiée du client
  -- pourrait y placer l'identifiant d'un compte et rendre la mesure nominative.
  CONSTRAINT product_events_anon_shape CHECK (
    anon_id IS NULL
    OR (anon_id ~ '^[A-Za-z0-9_-]{16,40}$'
        AND anon_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
  )
);

-- Lectures du tableau de bord : par événement et par jour, ou par parcours.
CREATE INDEX IF NOT EXISTS product_events_name_day_idx ON product_events (name, day DESC);
CREATE INDEX IF NOT EXISTS product_events_anon_idx ON product_events (anon_id, occurred_at DESC);

COMMENT ON TABLE product_events IS
  'Mesure produit auto-hébergée (aucun tiers, aucun cookie). anon_id = identifiant aléatoire navigateur, jamais une identité.';

-- ───────────────────────────────────────────────────────────────────────────
--  Vue d'activation : la seule question qui compte au lancement
--  « parmi les inscrits d'un jour, combien ont agi dans les 24 h ? »
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW product_activation AS
WITH signups AS (
  SELECT anon_id, min(occurred_at) AS signed_up_at
    FROM product_events
   WHERE name = 'signup' AND anon_id IS NOT NULL
   GROUP BY anon_id
),
actives AS (
  SELECT s.anon_id,
         s.signed_up_at,
         min(e.occurred_at) AS activated_at
    FROM signups s
    LEFT JOIN product_events e
      ON e.anon_id = s.anon_id
     AND e.name IN ('first_content_viewed', 'session_completed')
     AND e.occurred_at <= s.signed_up_at + interval '24 hours'
   GROUP BY s.anon_id, s.signed_up_at
)
SELECT (signed_up_at AT TIME ZONE 'UTC')::date AS signup_day,
       count(*)                                        AS signups,
       count(activated_at)                             AS activated,
       round(100.0 * count(activated_at) / nullif(count(*), 0), 1) AS activation_pct
  FROM actives
 GROUP BY 1
 ORDER BY 1 DESC;

COMMENT ON VIEW product_activation IS
  'Activation J0 : part des inscrits d''un jour ayant lu un contenu ou terminé une session dans les 24 h.';
