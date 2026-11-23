# Protocole de première connexion — agent IA

Ce document est le point d'entrée de tout agent IA qui ouvre ce dépôt pour la première fois.
Objectif : en quelques minutes, savoir où on est, ce qui est autorisé, et quoi faire. En cas
de conflit entre documents : AGENTS.md (contrat workspace) puis présente page, puis
docs/STANDARD-FICHES-COMPLET.md (cahier des charges contenu).

## 1. Le produit en 30 secondes

- **Optimus Formation Médicale** : PWA pour étudiants en médecine, préparant le concours d'internat de Madagascar (référentiel officiel 2025, 236 items).
- **Public international** : le cœur clinique de chaque fiche est UNIVERSEL (OMS, guidelines de référence) ; chaque protocole propre à un pays est un encadré « adaptation locale » (champ `localAdaptations`), jamais la norme. Règle 6 de la charte de présentation.
- **Stack** : React 19 + Vite + TanStack Start + TypeScript + Supabase + Cloudflare Workers.
- **Prod** : Worker `optimus`, https://optimus.carabin.workers.dev — tout push sur `main` déclenche le déploiement automatique (`.github/workflows/deploy-worker.yml`). Ne pas redéployer à la main.

## 2. Ordre de lecture obligatoire

1. `AGENTS.md` (racine) — contrat workspace, règles anti-hallucination, protocole audit contenu.
2. `docs/AGENT-ONBOARDING.md` (cette page).
3. `docs/MISSION-INTERNATIONAL.md` — plan d'action priorisé des items.
4. `docs/DECISIONS.md` — journal : **une ligne par commit de chantier**.
5. **Si la session touche au contenu médical** : `docs/STANDARD-FICHES-COMPLET.md` (cahier des charges) et `scripts/pathologies-catalog-integrity.test.mjs` (règles machine) AVANT d'écrire la moindre fiche.

## 3. Où vivent les choses

| Chemin | Rôle | Règle |
|---|---|---|
| `private/content/pathologies/*.json` | Fiches pathologies (~200), PRIVÉES | Servies sous jeton de contenu ; JAMAIS dans `public/` ni `src/` |
| `private/content/signes/*.json` | Fiches signes | PAS encore conformes au standard (tâche ouverte, à aligner) |
| `src/content/data/` | Manifestes, référentiels, programmes (publics) | Ne JAMAIS y déposer une fiche |
| `src/lib/pathologies/` | Chargeur + manifeste des fiches | Chargement via `fetchWithAuth()` ; aucun import de JSON de fiche |

## 4. Commandes utiles

- `npm run content:check` — contrôle qualité contenu (posologies, patterns interdits, sources). À passer après CHAQUE fiche.
- `npm test` — tests scripts + intégrité contenu (dont le test d'intégrité des pathologies).
- `npm run typecheck`, `npm run lint` — avant de conclure une session.
- `npm run release:check` — ensemble complet (test + typecheck + lint + build).

## 5. Règles non négociables (contenu)

1. Sources UNIQUEMENT au niveau racine de la fiche, avec `verifiedAt` daté et URL en HTTPS.
2. Posologies JAMAIS chiffrées : molécules + voies, renvoi au protocole national.
3. Rien d'inventé : valeur non vérifiable → `[À COMPLÉTER AVEC SOURCE]` et signaler UNVERIFIABLE.
4. `reviewStatus` honnête : `pending-medical-review` tant qu'aucun médecin n'a signé ; `reviewed/fully_reviewed` exigent `reviewedBy`.
5. Au moins un callout `urgence`, normalisation Unicode NFC, alignement des tables, unicité de tous les identifiants.
6. Un protocole national ne figure JAMAIS dans le corps universel d'une fiche, seulement en `localAdaptations[]` ou encadré étiqueté.
7. Contrôles avant chaque push : `npm test` + `npm run content:check` au vert.

## 6. Workflow type : enrichir une fiche

1. Choisir l'item prioritaire (`docs/MISSION-INTERNATIONAL.md`, sinon poids au concours).
2. Lire la fiche présente dans `private/content/pathologies/` : si elle existe, l'ENRICHIR et l'aligner au standard — ne jamais repartir de zéro.
3. Vérifier chaque fait avec des sources à jour et datées (OMS d'abord ; protocole national en adaptation locale).
4. Éditer le JSON, passer les contrôles (§ 5.7).
5. Push direct sur `main` : **1 commit = 1 fiche**, message descriptif.
6. Ajouter une ligne dans `docs/DECISIONS.md`.
7. Le déploiement part tout seul après le push.

## 7. Pièges connus — ne pas retomber dedans

- CI rouge qui échoue tous jobs en ~2 s = minutes Actions épuisées (Billing GitHub), pas une régression de code.
- Page blanche en prod = suspect n°1 : durcissement CSP / scripts inline (cf. correctif commit `39260c8`) ; vérifier `server/middleware/security-headers.ts` et `public/_headers` avant de suspecter l'infra.
- Le format mindmap du dépôt est `root/branches/children/leaves` avec `id/label/detail` : suivre le prototype, pas un format externe.
- Le schéma de fiche en production est `schemaVersion: 1` : ne pas incrémenter sans décision tracée.

## 8. État des chantiers contenu (à jour du 2026-11-21)

- Fiche **Migraine** corrigée et conforme (commit `fef9724`).
- Fiche **Paludisme** enrichie au standard complet (commits `63dfe32` + `9d99bbb`) : drapeaux rouges structurés, encadré « Adaptation locale — Madagascar (PNLP) » (ASAQ 1re intention, AL 2e), 3 sources datées, zéro posologie chiffrée. **Prototype de référence du standard.**
- Le verrou « NE PAS TOUCHER LE CONTENU » (cahier des charges manquant) a été LEVÉ : le cahier des charges est `docs/STANDARD-FICHES-COMPLET.md`.
- Prochaines fiches à enrichir (ordre suggéré) : éclampsie, hémorragies de la délivrance, état de choc, polytraumatisme, tuberculose, VIH — puis poursuite selon `docs/MISSION-INTERNATIONAL.md`.
- Fiches `signes` : non conformes au standard, à aligner en tâche de fond (minimum vital : `schemaVersion`, `reviewStatus`, `updatedAt`, `verifiedAt`, disclaimer, correction de l'attribution « JNDES » dans l'hypocalcémie).
