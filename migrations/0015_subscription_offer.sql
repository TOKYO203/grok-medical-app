-- Abonnement Trimestriel payable (ABO-11).
--
-- Le tunnel de commande ne connaissait que deux offres à l'unité (`deck`,
-- `specialty`), contraintes par un CHECK inline créé par 0009_purchase_orders.sql.
-- L'offre `subscription` (15 000 Ar / 3 mois) est désormais facturée par le même
-- tunnel : sans cet assouplissement, l'INSERT échouerait en 23514 et le paiement
-- serait encaissé sans qu'aucune commande ne puisse exister.
--
-- `specialty` reste NOT NULL et `deck_number` reste borné 1..10 : un abonnement
-- porte la sentinelle `all` (aucune spécialité) et le module 1, normalisés CÔTÉ
-- SERVEUR par `normalizePremiumOrderInput()`. On ne rend donc pas nullables deux
-- colonnes dont dépendent les achats à l'unité, et aucune ligne existante ne
-- change de forme.

ALTER TABLE purchase_orders
  DROP CONSTRAINT IF EXISTS purchase_orders_offer_check;

ALTER TABLE purchase_orders
  ADD CONSTRAINT purchase_orders_offer_check
  CHECK (offer IN ('deck', 'specialty', 'subscription'));

-- Retrouver les abonnements sans balayer tout l'historique.
CREATE INDEX IF NOT EXISTS purchase_orders_subscription_idx
  ON purchase_orders (updated_at DESC)
  WHERE offer = 'subscription';

COMMENT ON COLUMN purchase_orders.offer IS
  'Offre facturée : deck | specialty (achat à l''unité) | subscription (abonnement 3 mois).';
