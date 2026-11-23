# HANDOFF — Prochaine session Optimus

**Révisé le** : 2026-11-12 (remplace la version du 2026-11-01, devenue fausse)
**État détaillé** : `docs/ETAT-PROJET-2026-11-12.md`
**Écarts de contenu Premium** : `docs/CONTENU-PREMIUM-ECARTS.md`

---

## 1. Contexte produit (à jour)

- **App** : Optimus Formation Médicale — PWA offline-first pour étudiants en
  médecine (Concours National d'Internat, Madagascar d'abord).
- **Stack** : React 19 + Vite + TanStack Start/Router + TypeScript + Supabase,
  build Worker via `npm run build:worker`.
- **Production** : **https://optimus.carabin.workers.dev** (Worker `optimus`,
  déploiement automatique sur push `main` par
  `.github/workflows/deploy-worker.yml`). Cloudflare Pages `optimusmedical`
  est **en pause** — ne pas le réactiver.
- **Repo** : https://github.com/TOKYO203/grok-medical-app — branche `main`
  protégée, PR obligatoire.
- **Reste à supprimer à la main** : Worker `optimus-medical-prod`, projets Pages
  `optimusmedical` et `grok-medical-app`, site Netlify `cheerful-otter-56f2b3`.
- **Design system** : 4 palettes (defaut/navy/cuivre/emeraude), variables
  `--app-*` dans `src/styles.css`, type `AccentPalette` dans `src/lib/theme.ts`.
  Ne pas casser.

## 2. Ce qui est livré (ne pas refaire)

| Chantier | État mesuré |
| --- | --- |
| Couverture du programme | **236 / 236 items** (100 %), 1 848 sections, 659 sources |
| Démarches enrichies | **43 / 43** (fiche + flashcards + carte mentale, 498 cartes) |
| QCM | 79 decks, 817 questions, 100 % expliquées |
| Cas cliniques | 46 |
| Histologie | **livré** : 13 lames, `/histologie` + `/histologie/$slideId`, entrée de navigation |
| Imagerie | 5 cas (`/imagerie`) |
| ECG / auscultation | 23 fiches / 10 sons, 5 foyers |
| Freemium | 10 questions/jour + explications verrouillées (#484, #485) |
| Classement | réel (Supabase, 0023) + compétition hebdo (0024) |
| Sécurité | pentest 2026-11-09 : critiques/élevés corrigés et déployés le 2026-11-10 |

## 3. Priorités (dans cet ordre)

1. **Relecture médicale** — 236/236 fiches `pending-medical-review`, 0 `reviewedBy`
   en imagerie/histologie. Rien ne peut être annoncé « validé » avant.
   Protocole : `docs/MEDICAL-AUDIT-PROTOCOL.md`, journal `docs/MEDICAL-AUDIT-LOG.md`.
2. **QCM des spécialités à zéro** — aucun deck en gynéco, pédiatrie, néphro,
   hémato, endocrino, pneumo, gastro, rhumato, urologie, psychiatrie,
   ophtalmologie, ORL, orthopédie. Cible ≈ 40 decks / 400 questions.
   ⚠️ **Contenu médical gelé** tant que le cahier des charges du propriétaire
   n'est pas fourni (voir `AGENTS.md`, section « CONSIGNE CONTENU »).
3. **Statistiques par spécialité** dans `/profil` — différenciateur Premium,
   données déjà collectées par deck.
4. **Normalisation** : 5 cas sans `access` (`CARDIO-FA-001`, `CARDIO-SCA-001`,
   `PNEUMO-ASTHME-001`, `HEPATO-CIRRHOSE-001`, `CHIR-APPENDICITE-001`),
   3 fiches sans `specialty`, 43 démarches sans `reviewStatus`.
5. **Dette d'exploitation** : sauvegardes production (P0-5 de
   `docs/V1-READINESS.md`), back-office unique (`ADMIN_PASSWORD` vs `is_admin`,
   P0-9), quotas `/content/*` (P1-6). Statut à revérifier ligne par ligne.
6. **Freemium, suite** : examen Premium complet, cas vitrine hebdomadaire,
   quotas ECG/imagerie 5/jour, essai déclenché au pic d'engagement.
7. **i18n contenu** : décision à prendre — traduire 20 fiches ou retirer la
   promesse internationale (le contenu est 100 % `fr`).

## 4. Chantiers de l'ancien handoff — statut réel

| Ancien chantier | Statut |
| --- | --- |
| 1. Moteur d'histologie | ✅ **livré** (13 lames, 2 routes, navigation, i18n `nav.histologie`) |
| 2. Nettoyage code mort | ⏸ non commencé (règle : 1 suppression = 1 vérification = 1 test) |
| 3. Examens complémentaires | ⏸ **non commencé** (aucune route, aucune donnée) |

## 5. Règles de travail

1. Une PR = un chantier ; jamais mélanger contenu et infra.
2. Gates avant push : `npm run typecheck`, puis `npm test` et `npm run build`
   selon le périmètre touché.
3. Sources médicales obligatoires (HAS, OMS, ESC, SPILF, collèges) — jamais
   d'invention de prévalence, de posologie ou de DOI.
4. Images : CC0 / CC BY / domaine public uniquement (jamais Radiopaedia ni un
   manuel). `source` + `sourceUrl` + `license` obligatoires dans le JSON.
5. Ne pas toucher : `src/lib/auth/*` (lazy betterAuth),
   `src/lib/purchase-orders.ts`, `src/server/ariari/*`, `.env.production`
   (`VITE_*` publiques), variables existantes de `src/styles.css`.
6. Toute décision structurante se consigne dans `docs/DECISIONS.md`.

## 6. En cas de doute

- `docs/ETAT-PROJET-2026-11-12.md` — état factuel
- `docs/ROADMAP-PRODUIT-SERIEUX.md` — roadmap 12 semaines, phases et KPI
- `docs/CONTENU-PREMIUM-ECARTS.md` — ce qui manque pour vendre du Premium
- `docs/MODEL-FREEMIUM.md` — périmètre gratuit/payant validé
- `docs/DEPLOIEMENT-CLOUDFLARE.md` — production Worker
- `docs/V1-READINESS.md` — backlog P0/P1 (daté du 2026-10-22, à revérifier)
- `docs/LEGAL-GUARDRAILS.md`, `docs/MEDICAL-AUDIT-PROTOCOL.md`
