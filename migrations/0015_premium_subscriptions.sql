-- Abonnements Premium (A04, Session 18) : mensuel 5 000 Ar (30 jours),
-- trimestriel 12 000 Ar (90 jours). Une commande d'abonnement ne cible ni
-- spécialité ni deck : specialty et deck_number deviennent nullables et
-- l'union des offres s'étend. Les offres historiques deck/specialty restent
-- valides (commandes existantes, audit) mais ne sont plus proposées à la vente.

ALTER TABLE purchase_orders
  DROP CONSTRAINT IF EXISTS purchase_orders_offer_check;

ALTER TABLE purchase_orders
  ADD CONSTRAINT purchase_orders_offer_check
  CHECK (offer IN ('deck', 'specialty', 'subscription_month', 'subscription_quarter'));

ALTER TABLE purchase_orders ALTER COLUMN specialty DROP NOT NULL;
ALTER TABLE purchase_orders ALTER COLUMN deck_number DROP NOT NULL;
