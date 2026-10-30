-- 0021 — B2B institutionnel : chaque demande d'établissement devient une
-- ligne, pas un e-mail perdu (B2B-INSTITUTIONNEL-V2.md §4).
--
-- Jusqu'ici le canal institutionnel était un `mailto:` prérempli sur /contact
-- (B20) : la demande n'existait que dans la boîte du propriétaire, sans file
-- d'attente ni suivi — et le KPI « > 5 demandes d'école/mois » (§1) était
-- immeasurable.
--
-- CHOIX ASSUMÉS
--   • Écriture serveur UNIQUEMENT : `POST /api/institution-leads` valide et
--     insère. RLS activé SANS policy et aucun GRANT à un rôle client : le
--     serveur (propriétaire de la table) bypass RLS, les jetons anon /
--     authenticated ne peuvent rien y lire ni écrire.
--   • Les tranches d'étudiants sont une énumération fermée : les agrégations
--     (« combien de demandes > 250 étudiants ? ») restent lisibles.
--   • Pas de colonne « statut » : le cycle de vente (lead → démo → pilote →
--     contrat) sera suivi quand le back-office le fera ; une colonne jamais
--     mise à jour ment mieux qu'elle n'observe.

CREATE TABLE IF NOT EXISTS institution_leads (
  id             bigserial PRIMARY KEY,
  establishment  text        NOT NULL,
  role           text        NOT NULL,
  full_name      text        NOT NULL,
  email          text        NOT NULL,
  phone          text,
  student_range  text,
  message        text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  day            date        NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  CONSTRAINT institution_leads_email_shape CHECK (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$'),
  CONSTRAINT institution_leads_range_shape CHECK (
    student_range IS NULL
    OR student_range IN ('lt50', '50-100', '100-250', '250-500', 'gt500')
  ),
  CONSTRAINT institution_leads_establishment_len CHECK (char_length(establishment) BETWEEN 2 AND 160),
  CONSTRAINT institution_leads_message_len CHECK (message IS NULL OR char_length(message) <= 2000)
);

ALTER TABLE institution_leads ENABLE ROW LEVEL SECURITY;

-- Back-office : les demandes les plus récentes d'abord.
CREATE INDEX IF NOT EXISTS institution_leads_created_idx ON institution_leads (created_at DESC);

COMMENT ON TABLE institution_leads IS
  'Demandes de démonstration établissements (B2B, Semaine 7). Écrite uniquement par le serveur : RLS activé sans policy.';
