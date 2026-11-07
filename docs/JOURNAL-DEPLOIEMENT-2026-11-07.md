# Journal de déploiement — 2026-11-07

## Contexte

La production Pages (`https://optimusmedical.pages.dev`) était figée sur un
build ancien (567 questions affichées sur /decouvrir) : tous les builds
postérieurs au 6 novembre échouaient (bundle > 25 Mo puis binding `ASSETS`
interdit en contexte Pages, corrigé par la suppression du `wrangler.jsonc`
racine, PR #426).

## Ce commit

Commit de déclenchement sans effet fonctionnel : il relance un build Pages
propre sur la tête actuelle de `main` afin de publier enfin le contenu
accumulé (667 questions, orientations diagnostiques Phase 13, fiches
nosographie chirurgie n51-60, corrections ECG/histologie/imagerie).

## Vérification attendue après déploiement

- `/decouvrir` affiche **667 questions** (et non plus 567) ;
- `/content/demarches/dyspnee` (et hémoptysie, syncope, fièvre persistante,
  adénopathie superficielle, œdèmes) répond ;
- les fiches nosographie 51-60 sont présentes.

En cas d'échec du build : voir `docs/DEPLOIEMENT-CLOUDFLARE.md`.
