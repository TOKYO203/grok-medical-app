# Performance Optimus V1

Ce document fixe les garde-fous de performance de la V1. Ils protègent le projet contre une dérive du poids des artefacts client ; ils ne remplacent pas une mesure réelle des Core Web Vitals sur un déploiement accessible publiquement.

## Budgets de build obligatoires

Le script `scripts/performance-budget.mjs` est exécuté automatiquement par `npm run build` et `npm run build:netlify`.

| Budget | Limite V1 |
| --- | ---: |
| Un chunk JavaScript client | 584 KiB max |
| Une feuille CSS client | 104 KiB max |
| JavaScript client total produit par le build | 1 888 KiB max |

La source de vérité est `PERFORMANCE_BUDGET` dans `scripts/performance-budget.mjs` (ce tableau ne fait que la refléter). Le build échoue si l'une de ces limites est dépassée ; chaque relèvement y est daté et motivé, avec une marge volontairement faible (le plafond est un garde-fou, pas une cible).

> ⚠️ **Mesurer comme la CI, sinon la mesure ne vaut rien.** Le total dépend de la configuration compilée : la CI et le déploiement n'ont pas de `.env.local`, donc `VITE_AUTH_ENABLED` est absent et l'authentification reste **active** ; un poste de dev qui porte `VITE_AUTH_ENABLED=false` dans son `.env.local` (non versionné) compile **sans** le client d'auth. Au commit de référence : auth ON = 1 846,6 KiB en local et 1 871,3 KiB en CI (écart de toolchain ~25 KiB) ; auth OFF = 1 822,5 KiB — soit ~65 KiB de fausse marge. Pour reproduire la CI en local :

```bash
mv .env.local .env.local.bak   # le restaurer ensuite (trap)
node scripts/with-app-env.mjs vite build
node scripts/performance-budget.mjs
```

Commande manuelle après un build (mesure seule, sans rebuild) :

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
