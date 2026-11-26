# État du projet — 12 novembre 2026

> Note d'état établie le 2026-11-12 par lecture du dépôt et de ses documents.
> Les chiffres de contenu sont **mesurés** sur les fichiers ; les statuts
> `à revérifier` viennent des documents cités et n'ont pas été rejoués ici.

## 1. Snapshot technique

| Élément | Valeur |
| --- | --- |
| Dernier commit | `995ffbb` — fix(routes): réactiver /api/admin-logout et /api/quiz/answer (#498) |
| Commits dans l'historique | 1 707 |
| Arbre de travail | propre au moment du snapshot (modifications de cette session : §8) |
| Dépendances | `node_modules` absent, `dist` absent → build/tests non exécutés dans cette session |
| Routes | 73 fichiers dans `src/routes/` |
| Migrations | 24, dernière `0024_weekly_challenge.sql` |
| CI | `ci.yml` (release-check/test/smoke/audit), `deploy-worker.yml`, `e2e.yml`, `security.yml`, `staging-db.yml`, `db-recovery.yml` |

## 2. Production

- **URL canonique : https://optimus.carabin.workers.dev** (Worker `optimus`,
  déployé par `.github/workflows/deploy-worker.yml` à chaque push sur `main`).
- L'ancien projet Cloudflare Pages `optimusmedical` est **en pause** ; il ne
  doit pas être réactivé.
- Restes de l'ancien déploiement à supprimer manuellement dans les dashboards :
  Worker `optimus-medical-prod`, projets Pages `optimusmedical` et
  `grok-medical-app`, site Netlify `cheerful-otter-56f2b3`.
- Pas encore de domaine custom (`optimus-medical.com` prévu) ; `optimus.on.workers.dev`
  n'a jamais existé.

## 3. Produit et contenu (mesuré)

- **Stack** : React 19 + Vite + TanStack Start/Router/Query + TypeScript + Supabase,
  PWA offline-first, hébergement Cloudflare Worker.
- **Modèle** : freemium, validé le 2026-11-11 dans `docs/MODEL-FREEMIUM.md`.

| Contenu | Volume |
| --- | --- |
| Fiches pathologies (`private/content/pathologies`) | 236 JSON |
| Fiches « Signes & Syndromes » (`private/content/signes`) | 110 JSON |
| Decks de questions | 79 decks / 817 questions — **5 gratuits**, 74 Pro (775 questions) |
| Cas cliniques (`src/content/data/cases.json`) | 46 |
| ECG (`src/content/data/ecg`) | 24 JSON (23 fiches + index) |
| Histologie | **13 lames** + routes `/histologie`, `/histologie/$slideId` et entrée de navigation |
| Imagerie | 5 cas |
| Valeurs de référence / programmes / auscultation | 3 domaines / 1 programme (236 items) / 10 sons (5 foyers) |
| Démarches | **43 fiches enrichies** (`public/content/demarches`, 498 flashcards, 43 cartes mentales) |

## 4. Freemium — livré / restant

**Livré (PR #484, #485)** :
1. Explications verrouillées sur les decks gratuits (« Explication disponible avec Pro »).
2. Quota de 10 questions/jour en gratuit, compteur visible.

**Documenté, non livré** (chantiers 3 à 7 de `docs/MODEL-FREEMIUM.md`) :
statistiques avancées premium, cas vitrine hebdomadaire en lecture seule,
flashcards à réponses masquées (déjà gatées dans les faits), quota 5 ECG/imagerie
par jour. Le **mode examen** est partiellement livré : `/examen` est gaté
`OPTIMUS_PRO` avec une épreuve découverte de 12 questions (10 min).

## 5. Sécurité (pentest du 2026-11-09)

Corrigés et déployés le 2026-11-10 : decks Pro sortis de l'actif public,
correction des QCM décidée côté serveur, CSP + `X-Frame-Options` + HSTS,
jeton de contenu en cookie `HttpOnly`, `/admin*` protégé.

Ouvert / assumé :
- **Accès Premium verrouillé côté client** (état local) — acceptable seulement
  parce que le contenu à forte valeur n'est plus dans le bundle public.
- Le garde `/admin*` avait été **désactivé** par un diagnostic ; il a été
  réactivé le 2026-11-12 (#478, #498).

## 6. Dettes documentaires — corrigées le 2026-11-12

1. **`AGENTS.md`** : en-tête réécrit (production Worker `optimus`, contenu
   mesuré, relecture médicale à 0, freemium, pointeurs vers les docs de pilotage).
2. **`docs/HANDOFF-NEXT-SESSION.md`** : réécrit intégralement sur l'état du
   12/11 (l'ancienne version du 01/11 réclamait l'histologie, déjà livrée).
3. **`TODO.md`** : complété avec les dettes contenu, produit, exploitation et
   technique (les deux items de classement restent cochés).
4. **`docs/CONTENU-PREMIUM-ECARTS.md`** : inventaire mesuré de ce qui manque
   pour une offre Premium (aucun contenu médical produit).
5. **`docs/V1-READINESS.md` (2026-10-22)** reste le backlog P0/P1 de référence
   (sauvegardes, offline, back-office unique, quotas, domaine canonique), mais
   plusieurs lignes ont bougé : chacune est `à revérifier` avant usage.
6. **Arbitrage toujours ouvert** : deux back-offices coexistent
   (`/admin*` avec `ADMIN_PASSWORD` partagé vs `admin-local/` avec `is_admin`).

## 7. Prochaine étape suggérée

1. Rejouer les gates après `npm ci` : `npm run typecheck`, `npm test`, `npm run build`.
2. Lancer la relecture médicale (écart n°1 Premium) et les QCM des spécialités
   à zéro — sous réserve du cahier des charges propriétaire (contenu gelé).
3. Construire les statistiques par spécialité dans `/profil` (données déjà là)
   et normaliser les 5 cas sans `access` + 3 fiches sans `specialty`.
4. Trancher le back-office unique (P0-9) et vérifier les sauvegardes (P0-5).

## 8. Modifications de cette session (2026-11-12)

| Fichier | Nature |
| --- | --- |
| `docs/ETAT-PROJET-2026-11-12.md` | Créé — présente note d'état |
| `docs/CONTENU-PREMIUM-ECARTS.md` | Créé — écarts de contenu pour une offre Premium |
| `docs/HANDOFF-NEXT-SESSION.md` | Réécrit — priorités réelles du 12/11 |
| `AGENTS.md` | En-tête réécrit — production, contenu mesuré, relecture à 0 |
| `TODO.md` | Complété — dettes contenu / produit / exploitation / technique |
| `docs/DECISIONS.md` | Entrée du 2026-11-12 ajoutée |

Aucun fichier de code ni de contenu médical n'a été modifié. Aucun gate
(`typecheck`, `test`, `build`) n'a été exécuté : `node_modules` est absent de ce
worktree.
