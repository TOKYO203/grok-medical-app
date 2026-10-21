-- Paiement international (Lemon Squeezy, merchant of record) — deux ajouts.
--
-- 1) `purchase_orders.currency`
--    Le tunnel historique ne facture qu'en Ariary : `amount` est un entier en
--    MGA (3 000 / 15 000 / 27 000). Une commande internationale à 19 € stockée
--    dans la même colonne serait donc lue « 1 900 Ar » par le back-office —
--    un montant faux d'un facteur ~15. On ajoute la devise plutôt que de
--    convertir : le montant enregistré doit être celui RÉELLEMENT débité par
--    le processeur.
--
--    Convention : `amount` est exprimé en UNITÉ MINEURE de `currency`.
--      · MGA — pas de sous-unité : 15000 = 15 000 Ar (lignes existantes) ;
--      · EUR — centimes : 1900 = 19,00 €.
--    Le défaut 'MGA' rend la migration invisible pour l'historique.
--
-- 2) `webhook_events`
--    Idempotence des webhooks entrants. Lemon Squeezy rejoue un événement tant
--    qu'il ne reçoit pas de 2xx : sans journal, un simple timeout après
--    écriture produirait une SECONDE licence pour un seul encaissement.
--    La clé primaire (provider, event_key) rend la revendication atomique :
--    l'INSERT … ON CONFLICT DO NOTHING est le verrou, sans table de verrous.
--
--    `status` sert aussi d'état de reprise :
--      · received  — revendiqué, traitement en cours ;
--      · processed — terminé (rejeu ⇒ réponse 200 sans effet) ;
--      · ignored   — événement non payé ou non supporté (rejeu ⇒ 200) ;
--      · unmatched — payé mais non rattachable (user_id absent, commande
--                    inconnue) : conservé pour traitement manuel, jamais perdu ;
--      · failed    — panne transitoire : un rejeu est ACCEPTÉ (retour à
--                    `received`) et retente l'écriture, sinon une licence
--                    payée serait perdue en silence.

ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'MGA';

ALTER TABLE purchase_orders
  DROP CONSTRAINT IF EXISTS purchase_orders_currency_check;

ALTER TABLE purchase_orders
  ADD CONSTRAINT purchase_orders_currency_check
  CHECK (currency ~ '^[A-Z]{3}$');

COMMENT ON COLUMN purchase_orders.currency IS
  'Devise ISO 4217 du montant facturé. `amount` est exprimé en unité mineure de cette devise (MGA : ariary entiers ; EUR : centimes).';

CREATE TABLE IF NOT EXISTS webhook_events (
  provider text NOT NULL,
  event_key text NOT NULL,
  event_name text NOT NULL,
  status text NOT NULL CHECK (
    status IN ('received', 'processed', 'ignored', 'unmatched', 'failed')
  ),
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  attempts integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, event_key)
);

CREATE INDEX IF NOT EXISTS webhook_events_status_idx
  ON webhook_events (status, updated_at DESC);

COMMENT ON TABLE webhook_events IS
  'Journal d''idempotence des webhooks de paiement (Lemon Squeezy). La clé primaire est le verrou : deux livraisons du même événement ne peuvent pas traiter deux fois.';
