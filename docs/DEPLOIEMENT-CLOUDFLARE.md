# Déploiement Cloudflare Pages — optimusmedical

La production est `https://optimusmedical.pages.dev` (projet Cloudflare Pages
connecté à ce dépôt, build automatique sur push vers `main`).

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
2. Workers → optimusmedical → Settings → Variables and Secrets : les variables
   runtime que le projet Pages avait (`DATABASE_URL`, `RESPONSE_SALT`,
   `RATE_LIMIT_SALT`, `LICENSE_JWT_SECRET`, …) — un Worker ne partage PAS
   l'environnement du projet Pages.
3. URL : le Worker vit sur `optimusmedical.<account>.workers.dev` ; le domaine
   `optimusmedical.pages.dev` ne peut PAS être attaché à un Worker. Prévoir le
   domaine custom (`optimus-medical.com`) ou rediriger.

### Pages : que devient l'ancienne prod ?

Le projet Pages peut être mis en pause (Settings → Builds & deployments →
Pause) une fois le Worker validé : le build Pages git ne sert plus à rien et
consomme du temps de build. Ne pas le supprimer avant d'avoir validé le
domaine custom.
