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
