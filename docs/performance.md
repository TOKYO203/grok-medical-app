# Performance Optimus V1

Ce document fixe les garde-fous de performance de la V1. Ils protègent le projet contre une dérive du poids des artefacts client ; ils ne remplacent pas une mesure réelle des Core Web Vitals sur un déploiement accessible publiquement.

## Budgets de build obligatoires

Le script `scripts/performance-budget.mjs` est exécuté automatiquement par `npm run build` et `npm run build:netlify`.

| Budget | Limite V1 |
| --- | ---: |
| Un chunk JavaScript client | 400 KiB max |
| Une feuille CSS client | 100 KiB max |
| JavaScript client total produit par le build | 1 536 KiB max |

Le build échoue si l'une de ces limites est dépassée. Les seuils ont été posés à partir de la baseline V1 mesurée avant activation du gate : plus gros chunk ≈ 304 KiB, store ≈ 201 KiB et CSS principal ≈ 53 KiB. Ils laissent une marge de maintenance sans autoriser une croissance silencieuse importante.

Commande manuelle après un build :

```bash
npm run postbuild:budget
```

## Audit petits écrans

Le smoke Playwright `scripts/mobile-ui-smoke.mjs` couvre les viewports 320×568, 360×800 et 390×844 sur les routes principales `/`, `/parcours`, `/cas`, `/profil` et `/pro`.

Il considère notamment comme échec :

- tout statut HTTP d'erreur ;
- tout débordement horizontal du document ;
- toute erreur console/page ;
- une navigation mobile dont une cible tactile est inférieure à 44×44 CSS px ;
- l'absence de contenu principal (`main`).

Commande QA lorsque Chromium Playwright est installé :

```bash
npm run qa:mobile -- http://127.0.0.1:8080/
```

Les tests unitaires du `release:check` vérifient toujours la présence de ces règles même si le navigateur Playwright n'est pas disponible dans un runner donné.

## Core Web Vitals

Les budgets ci-dessus surveillent les artefacts. La validation finale V1 doit également mesurer sur un déploiement représentatif :

- LCP (Largest Contentful Paint) ;
- INP (Interaction to Next Paint) ;
- CLS (Cumulative Layout Shift).

Ces mesures doivent être réalisées sur mobile et desktop avec un déploiement réellement accessible. Tant que la preview Vercel est bloquée par la limite de builds du plan, Optimus ne doit pas prétendre disposer d'une validation Core Web Vitals de production.

## Priorités d'optimisation si un budget approche de sa limite

1. réduire ou lazy-loader les gros contenus médicaux chargés par la route d'accueil ;
2. séparer les données rarement utilisées du store principal ;
3. garder les écrans administratifs et Premium en chunks de route séparés ;
4. éviter d'ajouter des bibliothèques d'animation ou audio lourdes — Optimus utilise déjà CSS/Web Audio pour le feedback sensoriel ;
5. optimiser les images et autres médias avant d'augmenter un seuil de budget.

Un seuil ne doit être relevé qu'après mesure et justification documentée.
