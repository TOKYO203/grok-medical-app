# Audit RLS — base Supabase (2026-11-27)

Périmètre : `migrations/*.sql` versionnées + usages du client Supabase dans `src/`.
Méthode : inventaire statique (aucune requête sur la base de production).

## 1. Inventaire versionné

18 tables créées par les migrations, **3 avec RLS activé** :

| Table | RLS | Créée par |
|---|---|---|
| `institution_leads` | **oui** (sans policy, écriture serveur seule) | `0021` |
| `leaderboard_pseudo` | **oui** (lectures via fonctions `SECURITY DEFINER`) | `0023` |
| `weekly_challenge_runs` | **oui** (idem) | `0024` |
| `activation_keys`, `admin_config`, `purchase_orders`, `purchase_order_events`, `optimus_user_state`, `optimus_sync_controls`, `content_reports`, `report_rate_limits`, `api_rate_limits`, `product_events`, `publications`, `survey_questions`, `survey_responses`, `surveys`, `webhook_events` | non | `0003`–`0017` |

Ces quinze tables sont aujourd'hui **écrites et lues uniquement côté serveur**, avec la clé
`service_role` (`src/lib/purchase-orders.ts`, `src/lib/leaderboard.ts`,
`src/lib/weekly-challenge.ts` importent `@/server/supabase-env.server`). L'absence de RLS
n'est donc pas une faille en soi : la clé `service_role` contourne RLS de toute façon, et
aucune clé anonyme ne les atteint dans le code actuel.

## 2. Le point qui compte : trois tables NON versionnées lues avec la clé anonyme

| Table | Fichier | Opération | Migration |
|---|---|---|---|
| `public.profiles` | `src/lib/sync-engine.ts:147` | `upsert` (clé anonyme) | **aucune** |
| `public.progressions` | `src/lib/sync-engine.ts:132` | lecture/écriture | **aucune** |
| `public.licences` | `src/lib/cloud/content-session.ts:236` | `select("*")` | **aucune** |

Le code le reconnaît lui-même (`content-session.ts:373` : « si le client ne peut pas lire
`licences` (GRANT/RLS manquants), ce bloc est sauté »). Autrement dit : **le schéma réel de
ces trois tables vit hors du dépôt** et leur protection repose sur la configuration du
tableau de bord Supabase, non vérifiable en revue de code.

## 3. À vérifier par le propriétaire (SQL, lecture seule)

```sql
-- Tables du schéma public sans RLS, avec leur propriétaire
select c.relname, pg_get_userbyid(c.relowner) as owner, c.relrowsecurity as rls
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by c.relrowsecurity, c.relname;

-- Policies existantes sur les trois tables sensibles
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public' and tablename in ('profiles','progressions','licences');
```

Attendu : `relrowsecurity = true` sur les trois lignes `profiles`, `progressions`,
`licences`, avec des policies restreintes au propriétaire (`auth.uid() = user_id`).

## 4. Ce qui est verrouillé dans le dépôt

`scripts/rls-anon-invariant.test.mjs` échoue si un nouveau fichier met une **nouvelle table**
derrière le client anonyme sans mise à jour explicite de l'allowlist. Toute accessibilité
anonyme devient donc un choix tracé, pas un accident.

## 5. Décision

- Ne pas ajouter de migration `ENABLE ROW LEVEL SECURITY` sur `profiles`/`progressions`/
  `licences` à l'aveugle : les colonnes de jointure ne sont pas versionnées, et une policy
  erronée couperait la synchronisation en production.
- Priorité : **versionner le schéma de ces trois tables** (dump `supabase db dump` ou
  reconstruction manuelle) puis écrire leurs policies dans une migration dédiée.
- En attendant : garder l'allowlist du test à jour et ne jamais exposer ces tables à une
  clé publique supplémentaire.
