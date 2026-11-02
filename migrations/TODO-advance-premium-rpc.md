# TODO — Versionner la RPC `advance_premium_purchase_order`

**Statut** : 🔴 **RPC non versionnée** — présente uniquement dans Supabase prod.
**Priorité** : Haute (gouvernance + auditabilité)
**Origine** : Audit du 2026-11-02

## Contexte

La RPC `advance_premium_purchase_order(p_user_id uuid, p_reference text, p_new_status text)`
est appelée par `src/features/purchase/client/index.ts` et `src/lib/purchase-orders.ts`,
mais **n'existe dans aucune migration** du repo.

Conséquence : impossible de rebuild la DB sur un nouvel environnement, impossible
d'auditer le corps SQL (dernier risque IDOR résiduel), impossible de tester en CI.

## Procédure

1. Dashboard Supabase → **Database** → **Functions** → `advance_premium_purchase_order`
2. Cliquer **Edit** → copier tout le `CREATE OR REPLACE FUNCTION ...`
3. Coller dans un nouveau fichier `migrations/0018_advance_premium_rpc.sql`
4. Vérifier les 4 points de sécurité ci-dessous
5. Ajouter au `.gitignore` une exception : `!migrations/0018_advance_premium_rpc.sql`
6. Commit + PR

## Checklist sécurité (à vérifier dans le corps SQL)

- [ ] **①** `IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN RAISE EXCEPTION 'unauthorized'`
- [ ] **②** `UPDATE ... WHERE reference = p_reference AND user_id = auth.uid() AND user_id = p_user_id`
- [ ] **③** `IF p_new_status IN ('payment_verified','delivered','refunded') AND NOT is_admin(auth.uid()) THEN RAISE`
- [ ] **④** Pas de `SECURITY DEFINER` sans check explicite d'identité

Si **un seul** de ces points manque → IDOR résiduel (un user peut modifier la commande d'un autre via `p_user_id` falsifié). Le trigger SQL `guard_purchase_order_status_transition` bloque les sauts de statut, mais **pas** l'usurpation d'identité.

## Prérequis trigger

Le trigger `guard_purchase_order_status_transition` (voir `migrations/0011_purchase_state_machine.sql`) valide déjà les transitions légales. La RPC doit **en plus** valider :
- Que `auth.uid() = p_user_id` (identité)
- Que l'UPDATE cible bien `WHERE user_id = auth.uid()` (isolation)

## Références

- Code appelant : `src/features/purchase/client/index.ts:26-40` et `:84-102`
- Trigger SQL : `migrations/0011_purchase_state_machine.sql`
- Rapport d'audit : 2026-11-02
