# Optimus — Audit de pré-production V1 & feuille de route

**Date** : 2026-10-22
**Branche auditée** : `fix/final-vite-supabase` (tip `b5cd376`)
**Périmètre** : sécurité, robustesse, UX, contenu, monétisation, exploitation
**Méthode** : lecture de code + **mesures réelles** (API Supabase avec vrais jetons,
API Lemon Squeezy, PostgREST, workflows CI). Chaque affirmation est étiquetée
`[mesuré]`, `[code]` ou `[à vérifier]`.

---

## 0. Verdict

> **Pas encore vendable en l'état.** Le produit est solide (contenu sourcé, gating
> Premium réel, webhooks idempotents, quotas distribués), mais **la chaîne de paiement
> internationale ne peut pas encaisser** et **le back-office ne peut ni voir ni traiter
> les vraies commandes**. S'y ajoute une faille d'escalade de privilèges côté Supabase.

| Domaine | État | Bloquant ? |
| --- | --- | --- |
| Contenu médical + sources | ✅ 23 fiches (174/174 sections sourcées), 110 signes (220 sources) | non |
| Gating Premium (jeton de contenu) | ✅ opérationnel, fail-closed mesuré | non |
| Quotas / rate limiting | ✅ 6 routes sensibles couvertes, Upstash configuré | non |
| Webhooks Lemon Squeezy | ✅ idempotents (PK + `ON CONFLICT DO NOTHING`), rejeu sûr | non |
| **Achat international (Lemon Squeezy)** | ❌ variante `pending`, checkout renvoie la boutique | **OUI** |
| **Back-office admin** | ❌ GRANT/policies manquants + faille `is_admin` | **OUI** |
| **Sauvegardes production** | ❌ aucune stratégie réelle | **OUI** |
| Modèle d'accès admin | ⚠️ deux systèmes concurrents | oui (à trancher) |
| UX (signalement, offline, onboarding) | ⚠️ partiel | non |

Effort estimé pour un V1 commercial : **4 à 6 jours** (dont ~1 jour d'actions
manuelles côté dashboards Supabase / Lemon Squeezy).

---

## 1. P0 — Bloquants pour la mise en production

### P0-1 · Exécuter le correctif SQL du back-office

**Preuve** `[mesuré]` — rôle `authenticated` :
`admin_actions` 403, `error_reports` 403, `UPDATE paiements` 403, `INSERT licences` 403 (RLS),
`SELECT licences` 0 ligne même pour un admin, `service_role` 403 sur 4 tables.
**Impact** : le dashboard se connecte mais ne peut **rien** faire ; il annonçait
« ✅ Paiement validé » après trois refus (rapport : `docs/ADMIN-DASHBOARD-QA.md`).
**Action** : exécuter `docs/supabase/003-admin-dashboard.sql` (projet `uznagojvhheqstudhypm`),
puis `ADMIN_QA_MODE=ready node admin-local/qa-admin.mjs`.
**Effort** : 15 min (propriétaire, SQL Editor).

### P0-2 · Faille d'escalade de privilèges `is_admin`

**Preuve** `[mesuré]` — un compte **standard** :
`PATCH /rest/v1/profiles?id=eq.<soi> {"is_admin": true}` → **204**, puis `rpc/is_admin` → **true**.
`POST /profiles {"is_admin": true}` à l'inscription → **201**, puis admin.
**Impact** : tout étudiant connecté pouvait lire le journal d'audit, créer/révoquer des
licences, lire les signalements — et donc **s'offrir Premium**.
**Action** : incluse dans `003` (GRANT UPDATE par colonne + 2 triggers + RPC vérifiées).
**Effort** : inclus dans P0-1.

### P0-3 · L'achat international ne peut pas aboutir

**Preuve** `[mesuré]` via l'API Lemon Squeezy :

| Objet | État réel |
| --- | --- |
| Boutique 502254 « Optimus » | EUR, mode **test** |
| Produit 1459192 « Optimus Premium Trimestre » | `published` |
| Variante `46f60d57-…` (slug configuré) | **`status: "pending"`**, `is_subscription: true`, 1900, interval `month` ×3 |
| URL de checkout configurée | `302 → https://optimus888.lemonsqueezy.com/checkout` (accueil boutique, **pas** la page produit) |
| Webhook | déclaré en **test**, `order_created` + `subscription_created`, vers `https://optimusmedical.pages.dev/api/webhooks/lemonsqueezy` |

**Impact** : un visiteur qui clique « Payer par carte » arrive sur une page boutique sans
produit à acheter. Aucune vente possible.
**Action** : dans Lemon Squeezy → Produits → *Optimus Premium Trimestre* → variante
« Default » → **activer/publier** (`pending` → `published`), puis revérifier que
`https://optimus888.lemonsqueezy.com/checkout/buy/46f60d57-e97e-4acd-8199-53c564fc69f2`
affiche bien le récapitulatif 19 € / 3 mois.
**Effort** : 5 min.

### P0-4 · Le back-office observe des tables que personne n'écrit

**Preuve** `[code]` + `[mesuré]` :

```
paiements      (projet client Supabase) : AUCUN écrivain dans src/ ou server/
                                          → la file « Paiements en attente » sera toujours vide
error_reports  (projet client Supabase) : AUCUN écrivain dans src/ ou server/
webhook_events (projet SERVEUR, DATABASE_URL) : la table n'existe pas dans le projet client
content_reports(projet SERVEUR) : reçoit les vrais signalements étudiants
purchase_orders(projet SERVEUR) : reçoit les vraies commandes Mobile Money
```

Autrement dit : le dashboard local surveille un schéma **parallèle** ; les données réelles
sont traitées par `/admin-achats` et `/admin-reports` (fonctions serveur, `DATABASE_URL`).
**Action** (à trancher, cf. § 4.2) : soit le dashboard lit `purchase_orders` / `content_reports`
via une API serveur protégée, soit on assume que l'admin est **dans l'app** et le dashboard
local disparaît. Aucune troisième voie : deux back-offices sur deux bases = deux vérités.
**Effort** : 1 à 2 jours.

### P0-5 · Sauvegarde / restauration de la production

**Preuve** `[code]` : `.github/workflows/db-recovery.yml` teste la procédure
(`pg_dump` → restauration) sur un PostgreSQL **local éphémère** du runner. Il ne sauvegarde
**pas** la production. Aucun `pg_dump` planifié, aucune rétention, aucune restauration testée
sur les données réelles. `docs/production-runbook.md` décrit des procédures, pas un dispositif.
**Impact** : perte de `purchase_orders`, `webhook_events`, `content_reports` = perte des
preuves de paiement. Perte du projet Supabase client = perte des comptes/licences.
**Action** :
1. Supabase (les **deux** projets) : vérifier le plan (backups quotidiens / PITR) et la
   fenêtre de rétention ; activer PITR si < 7 jours.
2. Sauvegarde logique quotidienne hors site (`pg_dump` chiffré → stockage objet), avec
   `LICENSE`… non : **sans secret dans l'artefact**.
3. **Test de restauration trimestriel** documenté (le job existant devient le test de la
   procédure, pas la sauvegarde elle-même).
4. Documenter le RPO/RTO cible dans `docs/production-runbook.md`.
**Effort** : 0,5 à 1 jour.

### P0-6 · Deux projets Supabase = deux vérités (risque structurel)

**Preuve** `[mesuré]` :

| | Projet client `uznago…` | Projet serveur `kzody…` (`DATABASE_URL`) |
| --- | --- | --- |
| Identité | `auth.users`, `profiles` | `user` (Better Auth), `session`, `account` |
| Licences | `licences` | — |
| Commandes | — | `purchase_orders`, `purchase_order_events` |
| Journal technique | `admin_actions`, `error_reports` (vides) | `content_reports`, `webhook_events` |

**Impact** : une commande payée vit dans le projet serveur ; la licence vit dans le projet
client. Le webhook Lemon Squeezy fait le pont (`SUPABASE_SERVICE_ROLE_KEY`) — c'est le seul
chemin correct. Toute nouvelle fonctionnalité doit choisir son côté explicitement.
**Action** : formaliser dans `docs/DECISIONS.md` (une entité = un projet, tableau ci-dessus
comme référence) + un test de garde-fou qui échoue si un module écrit une table qui n'est pas
de son côté. À moyen terme : rapatrier `paiements`/`admin_actions` côté serveur (cf. P0-4).
**Effort** : 0,5 jour (documentation + garde-fou).

### P0-7 · `service_role` sans privilèges sur le projet client

**Preuve** `[mesuré]` : `service_role` → 403 sur `profiles`, `paiements`, `admin_actions`,
`error_reports` (a le SELECT sur `licences` et l'INSERT — vérifié par violation de FK `23503`).
**Impact** : tout Cron Supabase, script d'exploitation ou job d'export échoue. Le pont
`/api/licenses/session` lit `licences` : il fonctionne, mais rien d'autre.
**Action** : incluse dans `003` (§1). Vérifier ensuite `has_table_privilege('service_role', …)`.
**Effort** : inclus dans P0-1.

### P0-8 · Bascule Lemon Squeezy test → live

Checklist exhaustive (chaque ligne est vérifiable) :

| # | Action | Où | Détail |
| --- | --- | --- | --- |
| 1 | Publier la variante (`pending` → `published`) | LS → Produit → Variante | prérequis P0-3 |
| 2 | Passer la boutique en **live** | LS → Settings → Stores | le mode test/live est par boutique |
| 3 | Générer une **clé API live** | LS → Settings → API | remplace `LEMONSQUEEZY_API_KEY` |
| 4 | Créer un **webhook live** (URL identique, **secret différent**) | LS → Settings → Webhooks | `order_created` + `subscription_created` ; le secret test ne vérifie **pas** les payloads live |
| 5 | Renseigner les variables **serveur** | Vercel/CF Pages → env | `LEMONSQUEEZY_API_KEY`, `LEMONSQUEEZY_WEBHOOK_SECRET`, `LEMONSQUEEZY_STORE_ID`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL` |
| 6 | Renseigner les variables **client** | idem | `VITE_LEMONSQUEEZY_STORE_SLUG`, `VITE_LEMONSQUEEZY_VARIANT_ID` — **inlinées au build : rebuild obligatoire** |
| 7 | Vérifier le domaine du webhook | LS | aujourd'hui `optimusmedical.pages.dev` ; si le domaine canonique devient `optimus-medical.com`, **changer l'URL** |
| 8 | Test réel : 1 achat carte | front | montant réellement débité (19 €) — à faire en connaissance de cause |
| 9 | Vérifier la livraison | SQL serveur | `select * from webhook_events order by created_at desc limit 5;` puis licence `active` dans Supabase, `expires_at ≈ +90 j` |
| 10 | Purger les traces de test | SQL | `delete from webhook_events where detail->>'testMode' = 'true';` et supprimer les licences de test (`licence_hash like 'lemonsqueezy:%'` issues du mode test) |
| 11 | Activer les remboursements manuels | procédure | `order_refunded` n'ouvre rien : révoquer la licence à la main (assumé, documenté) |

**Effort** : 1 à 2 h + le temps du test réel.

### P0-9 · Modèle d'accès administrateur à trancher

**Preuve** `[code]` : deux systèmes coexistent.

| Système | Protection | Portée |
| --- | --- | --- |
| `/admin`, `/admin-licences`, `/admin-reports`, `/admin-decks`, `/admin-achats` | mot de passe **partagé** `ADMIN_PASSWORD` (comparaison à temps constant + quota), clé en `localStorage` | **déployé** |
| `admin-local/dashboard.html` | session Supabase + `is_admin` | **local**, non déployé, non versionné |

**Risque** : un secret unique partagé, sans identité ni révocation individuelle ; et deux
interfaces qui peuvent diverger.
**Action** : pour la V1 commerciale, garder **une seule** porte : `/admin` déployé, protégé
par `is_admin` en base (session Supabase), journalisant dans `admin_actions`. Le dashboard
local devient un outil de secours documenté. Détail de déploiement : § 4.2.
**Effort** : 1 jour.

### P0-10 · `paiements` : insertion ouverte à tout compte connecté

**Preuve** `[mesuré]` : `POST /rest/v1/paiements` avec un jeton standard → **201**.
**Impact** : n'importe quel étudiant peut créer des paiements fictifs en attente (bruit dans
la file, faux reçus). Combiné à P0-4 (file inutilisée), l'impact réel est faible — mais la
policy est un défaut à corriger avant d'exposer la table.
**Action** : `003` restreint l'INSERT à `user_id = auth.uid() AND status = 'pending'` ;
aller plus loin = `REVOKE INSERT` et écriture serveur uniquement.
**Effort** : inclus dans P0-1.

---

## 2. P1 — Important (avant ou juste après lancement)

### P1-1 · Bouton « Signaler une erreur » : présent mais incomplet

**Preuve** `[code]` : `ContentTrustCard` (avec « Signaler une erreur ») n'est monté que dans
`src/routes/parcours.$deckId.tsx`. Aucune occurrence dans les fiches (`/pathologie/$slug`),
ni dans `/profil`. Le signalement écrit dans `content_reports` (projet **serveur**), que
`/admin-reports` sait lire — mais **pas** le dashboard local (qui lit `error_reports`).
**Action** : monter `ContentTrustCard` sur `/pathologie/$slug` et `/profil` ; unifier la
destination (une seule table) ; brancher le dashboard sur la bonne table.
**Effort** : 0,5 jour.

### P1-2 · Error Boundaries : un seul niveau

**Preuve** `[code]` : `src/router.tsx` définit `defaultErrorComponent: AppErrorComponent` ;
**aucune** route ne définit `errorComponent`. Un `throw` dans une fiche remplace **tout
l'écran** (navigation comprise) par la page d'erreur.
**Action** : `errorComponent` sur les routes de contenu (`/pathologie/$slug`, `/demarche/$id`,
`/parcours/$deckId`, `/ecg/$id`, `/auscultation`) avec un bouton « retour à la liste » ;
garder le niveau global en dernier recours. Test : injection d'un `throw` volontaire.
**Effort** : 0,5 jour.

### P1-3 · Hors ligne : les nouvelles pages ne sont pas couvertes

**Preuve** `[code]` : `public/sw.js` v2 **ne met aucun document en cache** (`request.mode
=== "navigate"` → réseau), seuls les actifs hachés `/assets/*` sont cache-first.
**Conséquence** : `/tarifs`, `/pro`, `/pathologie/*` nécessitent le réseau. C'était un
correctif assumé (bug « 1 / 10 »), mais il laisse l'app **inutilisable hors ligne** à la
première navigation.
**Action** : ajouter une **page de repli hors ligne** (route statique précachée) et un
`fetch` « réseau puis repli » pour les navigations, sans jamais resservir un HTML périmé
d'un build antérieur. Vérifier avec `Network.emulateNetworkConditions offline`.
**Effort** : 0,5 à 1 jour.

### P1-4 · Onboarding → première fiche gratuite

**Preuve** `[code]` : `index.tsx` rend `<Onboarding />` si `!onboarded`. À la sortie,
le tableau de bord propose « Commencer ma première session » (→ `/revue?mode=today`) ou
« Explorer la bibliothèque ». Aucun chemin explicite vers **une fiche gratuite** ni vers le
premier cas clinique gratuit.
**Action** : après l'onboarding, un CTA unique « Lire ma première fiche (offerte) » vers une
fiche déterminée (`/pathologie/paludisme` ou l'équivalent gratuit) + mesure de l'activation.
**Effort** : 0,5 jour.

### P1-5 · Répétition espacée (SRS) dès le premier jour

**Preuve** `[code]` : `/revue?mode=today` sélectionne 10 questions via `pickTodayQuestions`
sur les decks accessibles ; `/revue` (mode révisions) filtre par `isDue()` et reste vide
sans historique (état vide géré). L'accès dépend des decks gratuits.
**Action** : vérifier qu'un compte neuf **sans achat** obtient bien une session du jour non
vide (test automatisé), sinon le SRS est invisible le jour 1 — le principal levier de rétention.
**Effort** : 0,5 jour (test + ajustement du pool gratuit).

### P1-6 · Quotas : couverture et limites

**Mesuré** `[code]` :

| Route | Limite | Verdict |
| --- | --- | --- |
| `POST /api/admin-verify` | 10 / 5 min | ✅ |
| `POST /api/ai-stream` | 20 / min | ✅ |
| `POST /api/licenses/activate` | 8 / min | ✅ |
| `POST /api/licenses/verify` | 10 / h | ✅ |
| `POST /api/licenses/session` | 30 / h | ✅ |
| `POST /api/checkout/lemonsqueezy` | 10 / min | ✅ |
| `POST /api/webhooks/lemonsqueezy` | — | ⚠️ pas de quota (signature HMAC obligatoire + corps ≤ 256 Kio) : acceptable, mais un flot de 401 consomme du CPU |
| `GET /content/$type/$file` | — | ⚠️ protégé par JWT, mais aucune limite : un client licencié peut aspirer les 133 fiches en boucle |

Upstash est **réellement configuré** (`UPSTASH_REDIS_REST_URL` non placeholder) : les quotas
sont donc partagés entre instances — sinon ils retombent en mémoire par isolate.
**Action** : quota sur `/content/*` (ex. 120/min par licence) et sur le webhook (ex. 60/min/IP,
réponse 429 sans lecture du corps au-delà).
**Effort** : 0,5 jour.

### P1-7 · Journalisation des erreurs serveur

**Preuve** `[code]` : les messages client sont génériques (correct), mais
`console.error("base indisponible", error)` (`api.checkout.lemonsqueezy.ts`) journalise
l'objet d'erreur `pg` complet — susceptible de contenir l'hôte et l'utilisateur de la base.
**Action** : ne journaliser que `error.code`/`message` tronqué, jamais l'objet brut ; ajouter
un identifiant de requête corrélé. Aucun secret n'a été trouvé dans les messages renvoyés au
client.
**Effort** : 0,25 jour.

### P1-8 · Contenu et traçabilité médicale — conforme

**Mesuré** `[node]` : `private/content/pathologies` → **23 fiches**, **174 sections**,
**174/174 sections portent au moins une source** ; 287 flashcards. `private/content/signes` :
**110 fiches** (220 sources HTTPS, cf. audit du 2026-10-18). `reviewStatus` non validé →
bandeau ambre assumé, affiché à l'utilisateur.
**Action restante** : faire relire par un médecin (déjà prévu) ; ne pas retirer le bandeau
avant relecture.

### P1-9 · Domaine canonique et cohérence des environnements

**Mesuré** `[API LS]` : le webhook pointe `https://optimusmedical.pages.dev`. Les previews
Netlify/Vercel et les checks Cloudflare sont, eux, des environnements distincts.
**Action** : figer un domaine canonique (redirections 301 depuis les autres), y déclarer le
webhook, et vérifier que `VITE_SUPABASE_*`/`LICENSE_JWT_SECRET` sont identiques partout.
**Effort** : 0,25 jour.

---

## 3. P2 — Nice-to-have / vision « plateforme de référence »

| # | Sujet | Pourquoi | Effort |
| --- | --- | --- | --- |
| P2-1 | **QCM au format EDN** (questions à 5 propositions, « bonne réponse parmi », correction argumentée) | standard attendu par les étudiants français ; aujourd'hui le format est proche mais non normé | 3-4 j |
| P2-2 | **Statistiques de progression avancées** (courbe de maîtrise par spécialité, taux de réussite par item, temps par question, lacunes) | le principal différenciateur face à Anki/QCM papier | 3 j |
| P2-3 | **Export Anki / CSV** des flashcards | migration sans friction depuis les outils existants | 1 j |
| P2-4 | **Mode examen chronométré configurable** (nombre d'items, durée, correction différée) — la base existe (`/examen`) | usage réel en prépa | 1-2 j |
| P2-5 | **Recherche globale étendue au contenu** (fiches, démarches, cartes mentales) | la recherche actuelle couvre les decks | 1 j |
| P2-6 | **Notifications de révision** (web push) | rétention J+7 | 2 j |
| P2-7 | **Application mobile (PWA installée)** : audit Lighthouse, `beforeinstallprompt`, mode avion complet | l'offline est le point faible actuel (P1-3) | 2 j |
| P2-8 | **Version anglaise du contenu médical** | marché international déjà payant en EUR | plusieurs semaines |
| P2-9 | **Tableau de bord qualité contenu** (signalements par fiche, taux, délai de correction) | crédibilité éditoriale | 1 j |
| P2-10 | **Tuteurs IA contextualisés** (déjà un proxy `/api/ai-stream`) : limiter au tuteur pédagogique, quota par utilisateur | valeur perçue forte, coût maîtrisé | 2-3 j |

---

## 4. Détails demandés

### 4.1 Sécurité & robustesse — synthèse

| Question | Réponse |
| --- | --- |
| Rate limiting sur toutes les routes sensibles ? | **Presque** : 6/6 routes de paiement/licence/IA/admin couvertes, Upstash partagé. Manquent `/content/*` et le webhook (P1-6). |
| Webhooks idempotents ? | **Oui** `[code]` : PK `(provider, event_key)`, `INSERT … ON CONFLICT DO NOTHING` comme verrou, licence écrite **avant** `delivered`, `503` sur panne pour forcer le rejeu, `200` sur doublon. Côté Mobile Money : `UNIQUE (user_id, client_request_id)` + machine à états (`created → … → delivered`) avec trigger refusant les sauts. |
| Erreurs 500 journalisées sans exposer de clés ? | **Oui côté client** (messages neutres), **non côté logs** pour un cas (`console.error(error)` brut, P1-7). Aucun secret trouvé dans une réponse HTTP. |
| Backup Supabase ? | **Non** (P0-5). Le workflow existant teste la procédure sur un PostgreSQL jetable. |

### 4.2 Déploiement du dashboard admin — options

| Option | Description | Avantages | Inconvénients |
| --- | --- | --- | --- |
| **A. `/admin` dans l'app (recommandé)** | routes existantes, protégées par `is_admin` lu en base via la session Supabase ; données servies par des fonctions serveur sur `DATABASE_URL` | une seule porte, déployée, journalisée, révocable par utilisateur | 1 jour de travail (remplacer `ADMIN_PASSWORD` par `is_admin`) |
| B. `/tableau-de-bord` séparé | page statique déployée, même modèle `is_admin` | isole l'UI | surface publique supplémentaire à protéger, CSP, cache |
| C. Garder `admin-local/` | outil sur le poste de l'admin | zéro exposition | non versionné, non auditable, dépend d'un accès réseau direct aux deux bases (P0-4) |

Recommandation : **A**, avec `admin_actions.admin_user_id = auth.uid()` (déjà prévu par `003`)
pour que chaque action soit attribuable à une personne, pas à un mot de passe partagé.

### 4.3 UX — état par item

| Item | État |
| --- | --- |
| Bouton « Signaler une erreur » | ⚠️ existe, seulement sur la page deck, mauvaise table (P1-1) |
| Error Boundaries | ⚠️ global seulement (P1-2) |
| Service Worker / `/tarifs`, `/pro` | ⚠️ aucun document en cache → pas d'offline (P1-3) |
| Onboarding → 1re fiche gratuite | ⚠️ CTA génériques (P1-4) |

### 4.4 Contenu & pédagogie

| Item | État |
| --- | --- |
| Sources vérifiables sur le Premium | ✅ 174/174 sections (pathologies) + 220 sources (signes) |
| SRS accessible jour 1 | ⚠️ dépend du pool gratuit (P1-5) |
| Statut de relecture | ⚠️ `pending-medical-review` assumé et affiché |

### 4.5 Monétisation — reste à faire (résumé exécutable)

1. **Publier la variante** Lemon Squeezy (aujourd'hui `pending`) — P0-3.
2. **Mode live** : clé API live, **nouveau secret de webhook**, environnement, **rebuild**
   pour les variables `VITE_*` — P0-8.
3. **Purge des données de test** (`webhook_events` test, licences de test, paiements `QA-*`).
4. **Test d'achat réel** de bout en bout, puis vérification de la licence en base.
5. **Back-office opérationnel** (P0-1/P0-4) : sans lui, aucune commande Mobile Money ne peut
   être validée en production.
6. **Documents commerciaux** : CGV/CGV internationales, mention du *merchant of record*
   (Lemon Squeezy) dans `/conditions`, page de contact commercial déjà en place.

---

## 5. Checklist Go / No-Go

À cocher avant d'annoncer la vente :

- [ ] `003-admin-dashboard.sql` exécuté et `ADMIN_QA_MODE=ready node admin-local/qa-admin.mjs` → **OK**
- [ ] `is_admin` non modifiable par un compte standard (test automatisé inclus, suite A)
- [ ] Variante Lemon Squeezy `published` + checkout affichant 19 € / 3 mois
- [ ] Achat réel réussi : licence `active`, `expires_at ≈ +90 j`, `webhook_events` = `processed`
- [ ] Sauvegarde quotidienne + restauration testée (date consignée dans le runbook)
- [ ] Un seul back-office actif, chaque action attribuée à un `admin_user_id`
- [ ] `service_role` opérationnel sur les deux projets
- [ ] Signalement étudiant visible dans le back-office (une seule table)
- [ ] Page de repli hors ligne + `/tarifs` et `/pro` testés hors ligne
- [ ] Un compte neuf sans achat accède à : 1re fiche, 1 cas clinique gratuit, session du jour
- [ ] Quotas `/content/*` et webhook
- [ ] Domaine canonique + webhook déclaré dessus
- [ ] Données de test purgées (paiements `QA-*`, licences test, `webhook_events` test)

---

## 6. Annexe — commandes utiles

> ⚠️ **Piège d'environnement (mesuré le 2026-10-22)** : si `VITE_AUTH_ENABLED=false`
> est exporté dans le shell, `gateIdentityEnabled()` renvoie `false` et **2 tests** de
> `src/lib/auth/gate-identity.test.ts` échouent (`expected 'user-1', got undefined`) —
> ce n'est **pas** une régression. Vérifié : `env -u VITE_AUTH_ENABLED node --test
> src/lib/auth/gate-identity.test.ts` → **14/14**. En CI la variable est absente, donc
> la suite est verte. Lancer les gates avec `env -u VITE_AUTH_ENABLED`.

```bash
# Gates applicatifs
env -u VITE_AUTH_ENABLED npm run typecheck && npx eslint . && npm test && npm run build

# Garde-fou SQL (exécute réellement docs/supabase/003-admin-dashboard.sql sur PGlite)
node --test scripts/admin-dashboard-sql.test.mjs

# Recette du back-office
node admin-local/server.cjs &
ADMIN_QA_EMAIL=… ADMIN_QA_PASSWORD=… ADMIN_QA_MODE=ready node admin-local/qa-admin.mjs

# Contrôle du schéma Supabase (lecture seule, sans secret affiché)
#   /rest/v1/  (OpenAPI) liste les tables et les colonnes
#   PostgREST valide les COLONNES avant les PRIVILÈGES :
#     42703 = colonne absente · 42501 = droit manquant (colonne existante)
```

Sonde d'état de la configuration Premium (sans secret exposé) :

```bash
curl -o /dev/null -w '%{http_code}\n' https://<domaine>/content/pathologies/paludisme.json
# 401 = LICENSE_JWT_SECRET configuré · 503 = absent
```
