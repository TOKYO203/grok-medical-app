# Déploiement Cloudflare — Worker `optimus`

**Depuis le 2026-11-12, la production est le Worker `optimus`, URL canonique
unique : https://optimus.carabin.workers.dev** (déployé automatiquement par
`.github/workflows/deploy-worker.yml` sur push vers `main` ; `BETTER_AUTH_URL`
pointe sur cette même URL). L'ancien Worker doublon `optimus-medical-prod` a
été mis à jour une dernière fois puis retiré du workflow (PR #495, #496) :
**à supprimer dans le dashboard Cloudflare**. Le projet Cloudflare Pages
`optimusmedical` est **en pause** : il ne sert plus le trafic et son build git
ne doit pas être réactivé. Les sections « Pages » ci-dessous sont conservées
pour l'historique et pour la migration inverse éventuelle.

## Ménage du 2026-11-12 (résumé)

- Incident 500 corrigé : le middleware `server/middleware/grok-pwa.ts`
  importait dynamiquement des modules virtuels à chaque requête GET et faisait
  échouer toutes les routes (PR #493).
- Le sous-domaine workers.dev du compte est `carabin` : l'URL canonique est
  `https://optimus.carabin.workers.dev` (l'ancienne `optimus.on.workers.dev`
  n'a jamais existé). `workers_dev=true` est injecté dans le wrangler.json
  généré (PR #494).
- Un seul déploiement Worker désormais : la ligne
  `--name optimus-medical-prod` a été retirée du workflow (PR #496).
- À supprimer manuellement dans les dashboards (non scriptable via API) :
  - Cloudflare : Worker `optimus-medical-prod` (doublon), projets Pages
    `optimusmedical` et `grok-medical-app` (en pause).
  - Netlify : site `cheerful-otter-56f2b3` (voir section « Vestige Netlify »).

## Redéploiement depuis `HEAD` (2026-11-12)

### Pourquoi ce redéploiement est nécessaire

Constaté le 2026-11-12 sur `https://optimus.carabin.workers.dev` :

| Sonde | Réponse observée | Lecture |
| --- | --- | --- |
| `GET /api/health/checkout` | `500` + `{"error":"health_check_unavailable"}` | cette chaîne n'existe **ni dans le code ni dans l'historique Git** |
| `POST /api/quiz/answer` | `500` + `{"status":500,"unhandled":true}` | handler de diagnostic (#490/#491) absent du dépôt |
| `POST /api/licenses/verify` | idem | idem |
| `POST /api/licenses/trial-token` | `500` | idem |
| `GET /content/pathologies/paludisme.json` | `503` | `LICENSE_JWT_SECRET` absent du runtime du Worker |

Le Worker en production **n'est donc pas construit depuis `main`**. Le
redéploiement depuis `HEAD` est la première action de remédiation.

### Pré-vol (obligatoire avant de déclencher)

```bash
npm ci --no-audit --no-fund
npm run typecheck && npm test && npm run lint
npm run build:cloudflare        # produit désormais un VRAI Worker (voir ci-dessous)
```

`build:cloudflare` délègue à `build:worker` : preset Nitro `cloudflare_module`,
`CF_WORKER=true CF_PAGES=1` exportés pour **toute** la chaîne de build (et pas
seulement pour Vite), puis `postbuild:content`, `postbuild:cfstubs`,
`postbuild:cloud`. Le garde-fou exige `.output/server/wrangler.json` avec
`assets` **et** un bundle client non vide sous `.output/public/assets` : un
artefact Vercel ne peut plus passer pour un Worker.

À noter : `npm run content:check` est **rouge** au 2026-11-12 (12 posologies non
sourcées dans 11 fiches). Ce n'est pas un bloqueur de déploiement technique,
c'est un bloqueur de mise en vente — décision contenu, pas infra.

### Déclenchement

Un push sur `main` touchant du code déclenche `.github/workflows/deploy-worker.yml`
(`paths-ignore: **.md`, `docs/**`). Sinon : Actions → *Deploy Worker* →
*Run workflow* (`workflow_dispatch`).

La chaîne est : `npm ci` → `npm run build:worker` → injection `wrangler.json`
(assets + `run_worker_first: /api/*`) → `wrangler deploy` → **`prod:verify`**.

### Vérification après déploiement

```bash
npm run prod:verify
# ou, pour attendre la propagation :
npm run prod:verify -- --attempts 6 --delay 10
```

Attendu une fois le Worker à jour **et les secrets posés** :

| Sonde | Attendu | Sinon |
| --- | --- | --- |
| `GET /api/health` | 200 + `{"status":"ok"}` | **bloquant** |
| `GET /api/health/checkout` | 200 | **bloquant** si 5xx |
| `POST /api/quiz/answer` | 4xx (corps invalide) | **bloquant** si 5xx / `unhandled` |
| `POST /api/licenses/verify` | 4xx | **bloquant** si 5xx |
| `POST /api/licenses/trial-token` | 4xx | **bloquant** si 5xx |
| `GET /content/pathologies/paludisme.json` | 401 (garde actif) | alerte si 503 (`LICENSE_JWT_SECRET` absent) |
| `GET /admin` anonyme | 403 | **bloquant** si 200 |
| `GET /` | CSP + `frame-ancestors` + XFO + HSTS | **bloquant** si absent |

Le script sort en code 1 sur un seul `fail`, et il tourne aussi automatiquement
à la fin du déploiement : un déploiement cassé devient rouge immédiatement.

### Retour arrière

1. Cloudflare → Workers → `optimus` → *Deployments* → redéployer la version
   précédente (ou `npx wrangler rollback --name optimus`).
2. Rejouer `npm run prod:verify` pour confirmer le retour à l'état antérieur.
3. Consigner l'incident dans `docs/DECISIONS.md`.

## Réglages attendus dans le dashboard Cloudflare

| Réglage | Valeur |
| --- | --- |
| Production branch | `main` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node version | 22 (`NODE_VERSION`) |

## Pourquoi le build échouait avant cette PR

`npm run build` se termine par deux smoke HTTP Node
(`scripts/smoke-built-server.mjs`, `scripts/survey-security-built-smoke.mjs`)
qui démarrent le serveur Nitro construit et lui envoient des requêtes réelles.
Ces scripts savaient trouver la sortie de deux presets uniquement :

- `netlify` → `.netlify/functions-internal/server/main.mjs`
- `vercel` → `.vercel/output/functions/__server.func/index.mjs`

Sur Cloudflare Pages, `vite.config.ts` sélectionne le preset
`cloudflare-pages` (via `CF_PAGES`, posé automatiquement par la plateforme) :
le serveur sort en `dist/_worker.js`, **ciblé pour le runtime workerd**, qui ne
peut pas être démarré dans le Node du build. Les smoke cherchaient donc un
fichier inexistant et faisa échouer **chaque déploiement Cloudflare**, ce qui a
figé la production sur un build ancien.

Le correctif : les deux smoke détectent `CF_PAGES`, vérifient que
`dist/_worker.js` existe, puis sortent proprement (exit 0). Le smoke HTTP
reste la référence sur Vercel/Netlify et dans la CI (preset `vercel`).

## Variables d'environnement

- `VITE_*` (Supabase, LemonSqueezy, licence) : dans `.env.production`,
  commité — inlinées au build, rien à configurer côté Pages.
- Sels serveur (`RESPONSE_SALT`, `RATE_LIMIT_SALT`) : secrets de runtime à
  poser dans **Settings → Environment variables** du projet Pages. Sans eux,
  les soumissions d'enquête échouent fermé (503) en production.
- `DATABASE_URL` : optionnel au build ; `scripts/migrate.mjs` saute
  proprement s'il est absent (le fallback PGLite migre seul).

## Vestige Netlify

Le site Netlify `cheerful-otter-56f2b3` est un vestige d'une ancienne
installation (crédits de build épuisés, build `build:netlify`). Il n'est pas
la production : à supprimer ou déconnecter du dépôt pour éviter toute
confusion.

## Limite de taille du bundle Functions (25 Mo)

Le bundle `dist/_worker.js` est plafonné à **25 Mo**. PGlite (Postgres WASM :
`pglite.wasm` ~3 Mo, `initdb.wasm` ~1,3 Mo, `pglite.data` ~15 Mo) ne doit
donc jamais entrer dans le graphe serveur d'un build Cloudflare : en prod CF,
`DATABASE_URL` est requis et le driver `postgres` (porsager, pur JS) prend
tout. `vite.config.ts` aliasé `@electric-sql/pglite` vers
`src/lib/db/pglite-stub.ts` quand `CF_PAGES=1` : le stub lève une erreur
explicite si le repli PGLite était malgré tout atteint.

Si un futur ajout de contenu repousse le bundle au-dessus de la limite, le log
de build liste les modules > 500 Ko : commencer par là.

## Stubs de bundle : le gate est CF_PAGES, pas STUB_CLOUDFLARE

`vite.config.ts` active les stubs Cloudflare quand **`CF_PAGES`** est posé
(chaîne **"1"**, posée automatiquement par Pages sur chaque build — jamais
"true"). `STUB_CLOUDFLARE=true` reste disponible comme override local pour
reproduire le build CF sur ta machine : `STUB_CLOUDFLARE=true npm run
build:cloudflare`.

Stubs appliqués (worker ~26,5 → ~23,8 MiB, sous la limite de 25 Mo) :

- `@electric-sql/pglite` → `src/lib/db/pglite-stub.ts` (jamais utilisé en
  prod CF : `DATABASE_URL` requis → driver `pg`)
- `postgres` → `src/lib/db/postgres-stub.ts` (idem)
- `better-auth` et `@better-auth/*` → `src/lib/auth/stub-ssr.ts`
  (`VITE_AUTH_ENABLED=false` en production)

Pièges connus :
1. Le champ **Build command du dashboard** Pages écrase le script npm : un
   préfixe `VAR=...` ajouté dans package.json n'apparaît jamais dans le log
   si le dashboard exécute sa propre commande.
2. `CF_PAGES === 'true'` ne matche jamais : la valeur est "1".
3. Ne pas mettre ce drapeau dans `.env.production` : scopé au mode, pas à la
   plateforme — casserait Vercel/Netlify.

## Architecture cible : Workers + Static Assets (déploiement GitHub Actions)

Depuis le 2026-09-04, les Workers acceptent **64 MiB non compressés sur tous
les plans** (les anciens plafonds 3 Mo free / 10 Mo payant compressés sont
supprimés), et `wrangler deploy` bundle le serveur en **un script unique** —
plus de listing de ~450 fichiers `.mjs` (crash `internal error occurred` du
wrangler plateforme 3.x des builds Pages, hors de notre contrôle).

Le plafond Pages Functions (25 MiB + wrangler plateforme figé) a été contourné
une première fois par les stubs (worker ~23,8 MiB), mais la seconde limite
(nombre de modules) est indépassable côté config : le plugin TanStack Start
n'expose aucune option de split serveur (schema vérifié dans les sources).

### Réglages

- `wrangler.jsonc` : `main` = `.output/server/index.mjs`, `assets` =
  `./dist` (binding `ASSETS`), `nodejs_compat`, observabilité activée.
- Build : `npm run build:worker` (preset `cloudflare_module`, stubs actifs).
- Déploiement : `.github/workflows/deploy-worker.yml` sur push vers main,
  `npx wrangler deploy` (wrangler 4 du repo — pas le wrangler plateforme).

### À configurer côté Cloudflare/GitHub (une fois)

1. GitHub → Settings → Secrets → Actions :
   - `CLOUDFLARE_API_TOKEN` (permissions **Workers Scripts : Edit**)
   - `CLOUDFLARE_ACCOUNT_ID`
2. Workers → optimus → Settings → Variables and Secrets : les variables
   runtime que le projet Pages avait (`DATABASE_URL`, `RESPONSE_SALT`,
   `RATE_LIMIT_SALT`, `LICENSE_JWT_SECRET`, …) — un Worker ne partage PAS
   l'environnement du projet Pages.
3. URL : le Worker `optimus` vit sur `https://optimus.carabin.workers.dev`
   (sous-domaine workers.dev du compte : `carabin`). Le domaine
   `optimusmedical.pages.dev` ne peut PAS être attaché à un Worker. Prévoir le
   domaine custom (`optimus-medical.com`) ou rediriger.

### Pages : que devient l'ancienne prod ?

Le projet Pages peut être mis en pause (Settings → Builds & deployments →
Pause) une fois le Worker validé : le build Pages git ne sert plus à rien et
consomme du temps de build. Ne pas le supprimer avant d'avoir validé le
domaine custom.
