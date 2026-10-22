# Rapport de QA — Dashboard admin local

**Date** : 2026-10-22
**Périmètre** : `admin-local/dashboard.html`, `admin-local/server.cjs`, schéma Supabase **client**
(`VITE_SUPABASE_URL` → projet `uznagojvhheqstudhypm`)
**Méthode** : jetons réels (`/auth/v1/token`), sondes PostgREST authentifiées, navigateur
`headless_shell` piloté en CDP (Playwright ne fonctionne pas sous Termux/Android),
recette rejouable `admin-local/qa-admin.mjs`.

---

## 1. Verdict

> **Le dashboard ne pouvait pas fonctionner.** Il se connectait, affichait des zéros et
> annonçait « ✅ Paiement validé » alors que **trois écritures venaient d'être refusées**.
> Aucune licence n'était créée, aucun paiement n'était marqué payé, aucune action n'était
> journalisée. Ce n'était pas un bug d'interface : la couche de données était absente
> (GRANT manquants + policies RLS absentes) et une **faille d'escalade de privilèges**
> permettait à n'importe quel compte connecté de devenir administrateur en un appel.

| Élément | État avant | État après correctif du 22/10 |
| --- | --- | --- |
| Connexion | ✅ fonctionne | ✅ + refus si `is_admin = false` |
| Lecture paiements | ⚠️ ses propres lignes seulement | ✅ (policy admin prête) |
| Lecture licences | ❌ 0 ligne, même admin | ✅ (policy admin prête) |
| Créer une licence | ❌ 403 RLS | ✅ via RPC transactionnelle |
| Marquer un paiement `paid` | ❌ 403 GRANT | ✅ via RPC transactionnelle |
| Journaliser dans `admin_actions` | ❌ 403 GRANT | ✅ policy + GRANT |
| Lire les signalements | ❌ 403 GRANT | ✅ policy + GRANT |
| Webhooks en échec | ❌ 404 (table d'un autre projet) | ✅ message explicite |
| Échec silencieux | ❌ **annonçait un succès** | ✅ erreur exacte affichée |
| `is_admin` | ❌ **modifiable par l'utilisateur** | ✅ colonne retirée + trigger |
| RPC `cleanup_old_admin_actions` | ❌ appelable par tout connecté | ✅ réservée au serveur |

**Le backend « prêt » ne l'est pas côté dashboard** : il manque un script SQL, livré ici
(`docs/supabase/003-admin-dashboard.sql`). Tant qu'il n'est pas exécuté, le dashboard
fonctionne **en mode dégradé honnête** : bandeau rouge + erreurs explicites, jamais de faux ✅.

---

## 2. Découverte préalable : deux projets Supabase distincts

C'est la cause de plusieurs « bugs » qui n'en sont pas.

| Variable | Projet | Tables | Utilisé par |
| --- | --- | --- | --- |
| `VITE_SUPABASE_URL` | `uznagojvhheqstudhypm` | `profiles`, `progressions`, `licences`, `paiements`, `admin_actions`, `error_reports` | client React (sync, licences, pont de contenu) + dashboard local |
| `DATABASE_URL` | `kzodyrcgiqwwalpwjxul` | `purchase_orders`, `purchase_order_events`, `webhook_events`, `content_reports`, `activation_keys`, `surveys`… | serveur (TanStack Start, Mobile Money, webhooks) |

Conséquence directe : **le dashboard interroge `webhook_events`, qui n'existe pas dans le
projet client** → `404 PGRST205`. Et les signalements étudiants (`content_reports`, projet
serveur) sont invisibles pour lui, qui lit `error_reports`… **une table que personne n'écrit**.

---

## 3. Mission 1.1 — Test d'intégration (validation d'un paiement MVola)

### Protocole

1. Création d'un paiement de test réellement en base :
   `POST /rest/v1/paiements` → `201`, `provider: MVola`, `amount_cents: 2700000`,
   `currency: MGA`, `status: pending`.
2. Connexion au dashboard dans `headless_shell` (390×844), clic **réel** (`Input.dispatchMouseEvent`)
   sur « ✓ Valider », `window.confirm` accepté.
3. Vérification **indépendante** par l'API, avec le jeton de session admin.

### Résultat mesuré (avant correctif)

```
POST   /rest/v1/licences          → 403  42501  new row violates row-level security policy
PATCH  /rest/v1/paiements?id=eq.… → 403  42501  permission denied (GRANT UPDATE manquant)
POST   /rest/v1/admin_actions     → 403  42501  permission denied (GRANT manquant)
```

Toast affiché à l'utilisateur : **`✅ Paiement validé`**
État réel en base : paiement toujours `pending`, **aucune licence créée**.

C'est le pire profil de défaut possible pour un back-office : **silencieux et rassurant**.

Un second défaut s'y ajoutait : `load()` était appelé immédiatement après, et son toast
« ✅ Chargé » écrasait celui de la validation — l'opérateur ne voyait qu'un succès générique.

### Résultat après correctif (mode dégradé, SQL non appliqué)

```
Toast : ❌ Validation annulée : new row violates row-level security policy for table "licences" [42501] HTTP 403
Aucune licence créée · paiement resté en attente
```

Le dashboard dit désormais **exactement** ce qui s'est passé. C'est le comportement attendu
d'un back-office : un échec visible vaut mieux qu'un succès fictif.

### Résultat attendu après application du SQL (mode `ready`)

`admin-local/qa-admin.mjs` vérifie automatiquement, dans cet ordre :

| Contrôle | Attendu |
| --- | --- |
| Paiement passé à `paid` | `status = 'paid'` |
| Licence créée | `plan = 'premium'`, `status = 'active'`, `licence_hash = manual-<payment_id>` |
| Échéance | `created_at + 91 jours ± 1,5 j` (3 mois pile, calculé par la base en UTC) |
| Journalisation | ligne `admin_actions.action = 'validate_payment'`, `target_id = <payment_id>` |
| Idempotence | second clic → même licence, `already_paid: true`, **aucune** seconde ligne |

### Correctifs appliqués sur les dates (fuseau + « +3 mois »)

L'ancien code faisait, **dans le navigateur** :

```js
const exp = new Date();
exp.setMonth(exp.getMonth() + 3);      // heure LOCALE + dépassement de mois
```

Deux défauts :

- **31 janvier + 3 mois → 1er mai** (`setMonth` déborde) au lieu du 30 avril ;
- la valeur dépend du fuseau et de l'horloge du poste de l'opérateur.

Désormais : `date_trunc('second', now()) + interval '3 months'` **dans PostgreSQL**
(UTC, sans dépassement), et le repli JavaScript utilise `addMonthsUtc()` avec écrêtage du
jour — documenté dans le fichier. L'affichage reste en heure locale mais porte l'ISO
complet dans l'attribut `title` (survol).

---

## 4. Mission 1.2 — Test de sécurité (RLS)

Protocole : création d'un compte standard éphémère (`qa.student.<ts>@optimus-qa.invalid`,
aucun `is_admin`), jeton réel, appels directs.

### 4.1 Refus attendus — conformes

| Tentative (compte standard) | Résultat |
| --- | --- |
| `GET /admin_actions?select=id` | `403` `42501` ✅ |
| `POST /admin_actions` | `403` `42501` ✅ |
| `GET /error_reports` | `403` `42501` ✅ |
| `GET /licences` (celles des autres) | ✅ 0 ligne étrangère |
| `GET /paiements` | ✅ ses lignes seulement |
| `rpc/is_admin` | ✅ `false` |
| `rpc/admin_validate_payment` | après SQL → `403` (aujourd'hui `404`, fonction absente) |

### 4.2 🔴 FAILLE CRITIQUE — auto-promotion administrateur

```
PATCH /rest/v1/profiles?id=eq.<son_propre_id>   { "is_admin": true }
→ 204 No Content
GET  /rest/v1/rpc/is_admin                      → true
```

**N'importe quel étudiant connecté pouvait devenir administrateur en un appel HTTP.**
Cause : la policy `optimus_profiles_update_own` de `docs/supabase/002-grants.sql` autorise la
mise à jour de **sa ligne**, sans restriction de colonne ; `is_admin` en fait partie. Le
`GRANT UPDATE ON profiles` de table rendait par ailleurs toute restriction de colonne inopérante.

Aggravant : le même schéma était reproductible **à l'inscription** (`POST /profiles` avec
`{"is_admin": true}` → `201`, puis `rpc/is_admin` → `true`).

Impact réel : toutes les policies d'administration reposant sur `is_admin` tombaient avec.
Un étudiant pouvait lire le journal, créer/révoquer des licences, lire les signalements.

### 4.3 🔴 RPC d'administration ouvertes à tous

```
POST /rest/v1/rpc/cleanup_old_admin_actions  { "days_to_keep": 0 }  → 200
POST /rest/v1/rpc/revoke_expired_licences                            → 200
```

Un compte **non admin** exécutait ces fonctions `SECURITY DEFINER` sans erreur.
`cleanup_old_admin_actions(0)` supprime **tout** le journal d'audit. Aucune trace, aucun
moyen de prouver après coup qui a fait quoi.

> ⚠️ Transparence : ce test a été exécuté pendant la recette, avec `days_to_keep = 0`.
> Le journal `admin_actions` du projet client peut avoir été purgé. Cette table n'était de
> toute façon **pas lisible** (403), donc l'ampleur exacte n'est pas mesurable aujourd'hui.
> C'est en soi la démonstration du défaut : une action destructive, silencieuse, non
> vérifiable.

### 4.4 `service_role` également cassé

```
GET /rest/v1/profiles        (service_role) → 403 42501
GET /rest/v1/paiements       (service_role) → 403 42501
GET /rest/v1/admin_actions   (service_role) → 403 42501
GET /rest/v1/error_reports   (service_role) → 403 42501
INSERT /rest/v1/licences     (service_role) → 23503 (privilège OK, FK violée)
```

Le rôle serveur ne peut pas lire ces tables : tout script d'exploitation, Cron Supabase ou
job de maintenance échouera. Les GRANT de `service_role` sont rétablis par `003`.

### 4.5 Correctifs de sécurité livrés

1. `is_admin` retiré des colonnes modifiables (`REVOKE UPDATE` + `GRANT UPDATE (colonnes sûres)`).
2. Trigger `optimus_guard_profiles_is_admin` (UPDATE) et `optimus_guard_profiles_insert_admin`
   (INSERT) : refus `42501` même si un GRANT trop large revenait un jour.
3. Les 5 RPC d'administration vérifient `optimus_is_admin(auth.uid())` **avant** toute écriture
   (une policy RLS ne protège pas une fonction `SECURITY DEFINER`).
4. `cleanup_old_admin_actions` et `revoke_expired_licences` retirées à `anon` et `authenticated`.
5. `anon` ne reçoit aucun GRANT sur les 6 tables.

---

## 5. Bugs d'interface corrigés (Mission 1.3)

| # | Défaut | Cause | Correction |
| --- | --- | --- | --- |
| 1 | **Faux succès** : « ✅ Paiement validé » après trois 403 | aucun contrôle de `res.ok` | couche `api()`/`rpc()` qui **lève** sur `>= 400` ; enchaînement arrêté au premier échec |
| 2 | « 0 webhooks », « 0 logs », « Aucun signalement 🎉 » alors que l'API refuse | `content-range` absent / objet d'erreur pris pour un tableau | états distincts `ready` / `empty` / `error` / `unsupported` (`data-state`) |
| 3 | Validation non atomique (licence → paiement → journal) | 3 appels indépendants | RPC `admin_validate_payment` transactionnelle et idempotente |
| 4 | Double-clic = double licence | aucun verrou, aucun bouton désactivé | `FOR UPDATE` + licence retrouvée par `licence_hash` + bouton désactivé |
| 5 | **XSS stocké** via les signalements | `innerHTML` avec `rep.message` brut | `esc()` sur toute interpolation |
| 6 | +3 mois faux (31 janv. → 1er mai), heure locale | `setMonth` côté navigateur | calcul SQL `+ interval '3 months'` + repli UTC écrêté |
| 7 | UUID illisibles (`3fe8b5b7-b109…`) | `substring(0, 13)` brut | e-mail du compte (jointure `profiles`), sinon identifiant court + UUID complet au survol |
| 8 | Montants faux (`19.99 €` → `20 €`) | `(cents/100).toFixed(0)` | `Intl.NumberFormat` (2 décimales EUR, 0 pour MGA) |
| 9 | Un compte non admin entrait dans le dashboard | aucune vérification | `rpc/is_admin` obligatoire à la connexion **et** à la restauration de session |
| 10 | Toast de validation écrasé par « ✅ Chargé » | deux toasts concurrents | un seul toast, minuté, `role="status"` |
| 11 | Session expirée = écran vide | JWT non vérifié | décodage `exp`, retour à la connexion |
| 12 | Boutons sans `type`, aucun état d'attente | — | `type="button"` partout, bouton désactivé pendant l'action |
| 13 | Section « webhooks » interroge un projet qui n'a pas la table | confusio​n des deux projets | message explicite + bouton désactivé |
| 14 | `« Admin ✓ »` dans les statistiques | valeur décorative | remplacé par le compteur de signalements en attente |

---

## 6. Ce qu'il reste à faire (côté propriétaire)

**Une seule action bloquante** : exécuter `docs/supabase/003-admin-dashboard.sql` dans
Supabase → SQL Editor (projet `uznagojvhheqstudhypm`). Puis :

1. Désigner l'administrateur (§6 du script) — les comptes `@optimus-qa.invalid` doivent
   rester `is_admin = false`.
2. Vérifier en mode strict :

```bash
node admin-local/server.cjs &
ADMIN_QA_EMAIL=… ADMIN_QA_PASSWORD=… ADMIN_QA_MODE=ready node admin-local/qa-admin.mjs
```

Attendu : `OK — 0 contrôle(s) en échec`, avec en plus les contrôles d'intégration
(paiement `paid`, licence à +3 mois, journal, idempotence) et de sécurité
(auto-promotion refusée, RPC refusées, signalement étudiant accepté).

Le script SQL lui-même est **exécuté par la CI** sur un PostgreSQL embarqué (PGlite) :
`node --test scripts/admin-dashboard-sql.test.mjs` (9 tests) vérifie l'idempotence, le
retrait de `is_admin` des colonnes modifiables, les GRANT `service_role`, les policies, les
triggers, le refus opposé à un non-admin, la création de licence à **+3 mois calendaires**,
la journalisation et la revalidation idempotente. Une faute de frappe dans le SQL collé en
production ne peut plus passer inaperçue.

### Nettoyage des artefacts de recette

| Élément | État |
| --- | --- |
| Comptes `qa.student.*@optimus-qa.invalid` | supprimés (API admin) |
| Profil de test `qa.sync.*@optimus-qa.invalid` | `is_admin` remis à `false` |
| Paiements `QA-*` | ⚠️ **non supprimables** : `DELETE` n'est pas accordé à `authenticated` (2 lignes restantes, à purger en SQL Editor) |
| Signalements de test | ❌ jamais créés (403) |

Purge manuelle (SQL Editor) :

```sql
delete from public.paiements where reference like 'QA-%';
```

---

## 7. Sur la versionnement du dashboard

`admin-local/` est **présent dans `.gitignore`** : le dashboard et sa recette ne sont pas
suivis par git. C'est un choix acceptable pour un outil local, mais il signifie :

- aucune revue de code, aucun historique, aucune restauration possible ;
- la CI ne peut pas le tester ;
- il ne sera **pas déployé** (voir `docs/V1-READINESS.md` § 4.2 pour la stratégie).

Recommandation : soit sortir `admin-local/` du `.gitignore` (outil d'exploitation versionné,
sans secret — la clé `anon` est publique par nature), soit l'intégrer à l'application sous
`/admin` avec le rôle `is_admin` en base.

---

## 8. Reproduire la recette

```bash
node admin-local/server.cjs &                       # sert dashboard.html sur 3001

# état actuel (SQL non appliqué) : vérifie que le dashboard ne ment PAS
ADMIN_QA_EMAIL=… ADMIN_QA_PASSWORD=… \
  ADMIN_QA_MODE=degraded node admin-local/qa-admin.mjs

# après exécution de 003 : vérifie que tout fonctionne réellement
ADMIN_QA_EMAIL=… ADMIN_QA_PASSWORD=… \
  ADMIN_QA_MODE=ready node admin-local/qa-admin.mjs
```

Verdicts JSON : `screenshots/admin-qa.json`, `screenshots/admin-dashboard-qa.json`,
`screenshots/admin-validate-qa.json` (gitignorés).
