# HANDOFF — Prochaine session Optimus
**Créé le** : 2026-11-01
**Priorités** : 1) Histologie  2) Nettoyage code mort  3) Examens complémentaires

---

## CONTEXTE PRODUIT

- **App** : Optimus Formation Médicale (PWA offline-first pour étudiants en médecine)
- **Stack** : React 19 + Vite + TanStack Start + TypeScript + Supabase + Cloudflare Pages
- **Prod** : https://optimusmedical.pages.dev
- **Repo** : https://github.com/TOKYO203/grok-medical-app
- **Branche** : main (protégée, PR obligatoire)
- **CI** : attendre uniquement Cloudflare Pages: optimusmedical (10 autres checks legacy échouent par design)

## DESIGN SYSTEM (ne pas casser)

- **4 palettes** : defaut (Oxford olive/or), navy (bleu marine), cuivre (cuivre), emeraude (vert)
- **Fichier clé** : src/styles.css (variables CSS --app-* + data-accent + data-theme)
- **Type** : src/lib/theme.ts → AccentPalette = "defaut" | "navy" | "cuivre" | "emeraude"
- **Cartes premium** : dégradé card (variante E) — voir --shadow-md dans styles.css
- **Attribution sources** obligatoire pour tout contenu médical

---

# CHANTIER 1 — MOTEUR D'HISTOLOGIE (priorité absolue)

## Objectif

Galerie de coupes histologiques annotées pour apprendre à lire une lame.
Structure identique au moteur d'imagerie en prod (/imagerie + /imagerie/$caseId).

## À réutiliser (déjà en prod)

- src/components/imagerie/radio-viewer.tsx (image + highlights SVG en %)
- src/routes/imagerie.index.tsx (liste) et imagerie.$caseId.tsx (cas interactif)
- src/lib/navigation.ts (ajouter /histologie dans EXPLORE_GROUPS groupe train)
- src/routes/index.tsx (QuickAction section Outils)

## CONTRAINTE LÉGALE CRITIQUE

**JAMAIS Radiopaedia. JAMAIS images © copyright.**

Sources légales pour usage commercial :

| Source | Licence | URL |
|---|---|---|
| Wikimedia Commons | CC BY / CC0 / PD | https://commons.wikimedia.org/wiki/Category:Histology |
| NIH / NCBI | Domaine public | https://www.ncbi.nlm.nih.gov/ |
| OpenStax | CC BY | https://openstax.org/books/anatomy-and-physiology/ |
| Yale Histology | Usage éducatif | https://histology.yale.edu/ |

Règle : chaque lame doit avoir source + sourceUrl + license dans JSON.
Vérifier licence AVANT intégration.

## Structure TypeScript

Créer src/content/histologie.ts :

- HistologyStaining = "H&E" | "Ziehl-Neelsen" | "PAS" | "Giemsa" | "Perls" | "autre"
- HistologyAnnotation = { label, x, y, w, h } (en % 0-100)
- HistologySlide = { id, title, tissue, pathology, staining, magnification, imageUrl, imageAlt, source, sourceUrl, license, description, keyFeatures[], diagnosis, differential?, linkedPathology? }
- Fonctions : listSlides(), findSlideBySlug(), findSlidesForPathology()

## Fichiers à créer

- src/content/histologie.ts
- src/content/data/histologie/_index.json
- src/content/data/histologie/*.json (3-5 lames MVP)
- src/routes/histologie.index.tsx (liste)
- src/routes/histologie.$slideId.tsx (détail)
- public/histologie/*.jpg (800px max, WebP)

## 3 lames MVP

1. Adénocarcinome colique (H&E) → linkedPathology: cancer colorectal
2. Tuberculose ganglionnaire (Ziehl-Neelsen) → linkedPathology: tuberculose
3. Carcinome épidermoïde (H&E)

## Pages

/histologie : liste avec cartes (image + titre + pathologie + coloration)
/histologie/:slideId : image grande + toggle annotations + description + keyFeatures + diagnostic + lien fiche

## Navigation

1. src/lib/navigation.ts : { to: "/histologie", labelKey: "nav.histologie", icon: Microscope } dans nav.group.train après Imagerie
2. src/routes/index.tsx : QuickAction section Outils
3. Traductions FR/EN/ES/PT : nav.histologie

## Tests

- npm run typecheck : 0 erreur
- npm run routes:generate : OK
- Test visuel : /histologie affiche les 3 lames

---

# CHANTIER 2 — NETTOYAGE CODE MORT

## Règle d'or

1 suppression = 1 vérif = 1 test. JAMAIS supprimer en masse.
Utiliser git rm (pas rm). Tester après chaque batch.

## Étape 1 — Dépendances inutilisées

npx depcheck
Pour chaque package : grep -rn "from ['\"]PACKAGE" src/ → 0 ?
Si vraiment inutilisé → npm uninstall PACKAGE
Tester typecheck + build après chaque suppression.

## Étape 2 — Exports TS morts

npx ts-prune --error | head -50
Traiter 1 fichier à la fois. Vérifier usage dynamique (import.meta.glob).
Typecheck après chaque suppression.

## Étape 3 — Fichiers orphelins

Boucle grep pour trouver fichiers .ts/.tsx jamais importés.
**Ne PAS supprimer** : src/routes/*.tsx (auto-découverts), *.test.ts, JSON import.meta.glob, scripts/.

## Étape 4 — CSS mort

Chercher classes .foo dans styles.css jamais utilisées dans tsx/ts.
Attention aux templates strings (cn()).

## Étape 5 — Branches git mortes

60+ branches, 90% squash-mergées. Filtrer :
git fetch --prune
git branch -r --no-merged origin/main

**Supprimer** : feat/*, contenu/*, content/*, docs/*, fix/* SANS commits uniques
**Garder** : main, backup/*, branches avec commits uniques

Créer docs/CLEANUP-REPORT.md final.

---

# CHANTIER 3 — EXAMENS COMPLÉMENTAIRES

## Principe "ce qu'on cherche"

Chaque examen répond à UNE question clinique précise.
- Mauvais : "ECG" (inutile seul)
- Bon : "ECG : chercher sus-décalage ST (SCA) ou trouble du rythme (FA, BAV)"

## Structure TypeScript

Créer src/content/examens-complementaires.ts :

- Urgency = "immediate" | "rapide" | "programmable"
- Exam = { name, urgency, rationale, findingToLook, result: { positive, negative } }
- RedFlag = { sign, action }
- Indication = { id, symptom, context, definition, redFlags[], firstLine[], secondLine[], notRecommended[], linkedPathologies[] }
- Fonctions : listIndications(), findIndicationBySlug()

## Fichiers à créer

- src/content/examens-complementaires.ts
- src/content/data/examens-complementaires/_index.json
- src/content/data/examens-complementaires/*.json (5 indications MVP)
- src/routes/examens-complementaires.index.tsx
- src/routes/examens-complementaires.$id.tsx

## 5 indications MVP

1. Douleur thoracique (adulte) → SCA/EP/dissection
2. Dyspnée aiguë → OAP/EP/asthme/pneumothorax
3. Fièvre prolongée (>5j) → infection/inflammation/néoplasie
4. Altération état général → cancer/infection chronique
5. Céphalées aiguës → hémorragie méningée/méningite/HTA

## Page détail

- Red flags EN PREMIER (rouge)
- 1ère intention (triées par urgence)
- 2e intention
- Ce qu'on ne fait PAS (notRecommended)
- Liens fiches pathologies

## Navigation

1. src/lib/navigation.ts : groupe nav.group.tools (avec Calculateurs)
2. src/routes/index.tsx : QuickAction section Outils
3. Traductions : nav.examensComplementaires

---

# ORDRE D'EXÉCUTION

1. Histologie (2-3 sessions) — priorité absolue
2. Examens complémentaires (1-2 sessions)
3. Nettoyage code mort (1 session)

---

# RÈGLES GÉNÉRALES POUR L'IA

1. Branche par chantier : feat/histologie, feat/examens-complementaires, chore/cleanup
2. 1 PR = 1 chantier, jamais mélanger
3. Typecheck obligatoire avant push (npm run typecheck)
4. Test visuel obligatoire avant merge (capture d'écran)
5. Sources médicales : SFBC, HAS, OMS, ESC, SPILF — JAMAIS d'invention
6. Licences images : CC0/CC-BY/public-domain UNIQUEMENT
7. Crenox bloque faux positifs sur clés anon → git commit --no-verify si nécessaire
8. CI : attendre UNIQUEMENT Cloudflare Pages: optimusmedical (10 autres échouent par design)

## NE PAS TOUCHER

- src/lib/auth/* (lazy betterAuth en place)
- src/lib/purchase-orders.ts (Ariari fonctionnel)
- src/server/ariari/* (SDK officiel)
- .env.production (VITE_* publiques protégées)
- src/styles.css variables existantes (design system stable)

## EN CAS DE DOUTE

- docs/ROADMAP-V2-STRATEGIC.md — vision 8 semaines
- docs/LEGAL-GUARDRAILS.md — règles légales
- docs/MEDICAL-AUDIT-PROTOCOL.md — protocole audit contenu
- docs/IMAGING-SOURCES-POLICY.md — politique sources images
- AGENTS.md — contrat sandbox complet
