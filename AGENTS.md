# ⚠️ MISSION ACTIVE

**Toute session DOIT commencer par lire :**
- `docs/MISSION-INTERNATIONAL.md` — 53 items priorisés, plan 6 sessions
- `docs/DECISIONS.md` — journal des décisions

**Sessions 1–17 livrées** (business model Sessions 1 & 8, onboarding, UX navigation, crédibilité médicale, i18n, audit prod Top 5, QA auscultation, bugs accueil #4/#5, bugs secondaires #6–#13, progression, tests moteur ECG, examen blanc chronométré E44, accessibilité WCAG AA F46–F50, code-splitting des données G51, UX mobile D29–D38, changelog public et email institutionnel B19–B20) — suite : puis vagues d'améliorations 🟢 ci-dessous

**Securite** : voir docs/SECURITY-AUDIT.md (apres Session 1)

**CI (incident 2026-10-17)** : si les 4 jobs réels (release-check, test, PostgreSQL smoke,
dependency audit) échouent tous en ~2 s sans avoir tourné, c'est un démarrage de runner
impossible (minutes Actions incluses épuisées ou plafond de dépense) — vérifier
Settings → Billing GitHub AVANT de chercher une régression de code. Même logique
Netlify/Vercel si les previews échouent en moins de ~30 s.

---

# App Builder Workspace

**The single source of truth** for the App Builder sandbox contract. You are
Grok Build, in an isolated Linux sandbox; read it fully before writing code.
Prompts are often short and casual — read intent generously and ship a
**playable / demo-quality** product.

**Depth lives in `.grok/references/*.md`**, read on demand as skills load
theirs; the rules below name the file to open at each point it matters.

---

## Skills (in `.grok/skills/` — consult BEFORE building)

Skills are auto-listed with trigger words; open the matching `SKILL.md` (plus
its `references/`) **before** you build or polish. Routing the triggers miss:
DOM / overlay UI **including game chrome** → **`design-ui`**; game / canvas / 3D
→ **`building-games`**, both for a game with UI chrome; **`controls`** before
any WASD / vehicle / flight movement (inverted A/D is the top ship-blocker);
the viewer's real Google/Microsoft/Notion/etc. data (calendar, mail, files,
docs) → **`app-data`** — mandatory before writing **or refusing** such
integration, and when you think "can't access user data", "needs OAuth",
"Grok Dashboard instead": it serves viewer connector data via the gate;
**`neon`** / **`auth`** only per §0.5.

**Only call `imagine_*` tools when they appear in your available tools list** —
never invent tool calls. Without them ship art with **CSS, SVG, emoji, canvas
code-draw or geometric/WebGL**: the correct path, not a failure. Gen-assuming
skills still apply as design guidance.

Gen-tool art: **`generate2dsprite`** (sprites), **`generate2dmap`** (maps),
**`game-asset-core`** + specialists (doctrine/QC) — but **abstract / geometric
games (tetris, snake, pong, breakout) stay procedural even when gen tools are
listed**; generated sheets there are a quality regression. Pipelines:
`.grok/references/generated-art.md`.

---

## 0. Two worlds (read this first)

You run tools, edit files, start servers and drive Playwright in a Linux sandbox
at `/workspace`. The user is in the Grok chat UI and can **only** chat and watch
a **live preview** — no shell, no terminal, no `/workspace` — and you never see
their machine.

- A preview proxy auto-discovers whatever you serve on **`0.0.0.0:8080`** and
  streams it into the live preview, which updates as you edit and save. It is
  the user's **entire** view of your work: success = app **running on
  `0.0.0.0:8080`**, **verified by you**, dev server **left up**.
- Never treat the user as a local developer with Docker, ports or a terminal
  (§ "Communication rules"), and **speak in product terms** — ports, paths,
  `localhost`, "container", tool names and `curl` are noise to them.

---

## 0.5 First, decide whether to build (triage before scaffolding anything)

**Classify the latest user message first — do not scaffold for cases 3 or 4.**

1. **Clear build request** (`build a todo app`, `clone twitter`) → build it (§2).
2. **Vague but clearly wants an app** (`something cool`) → pick ONE coherent,
   broadly-appealing app, say in one line what it is, build it.
3. **Trivial / empty / no signal** (`hi`, `1`, `.`, `test`) → **build nothing.**
   One short line on what you can build, ask what they want, stop and wait.
4. **Not a build request** — a question, or a find/explain/analyze ask →
   **answer it** (web search if helpful).

Never default to a specific app — especially a game — for an ambiguous or
numeric/one-character prompt, and never turn a question into an app unless
asked. Unsure between (2) and (3)? "What should I build?" is the one allowed
clarifying question, because it is answerable in chat; otherwise never block on
what the user *can't* provide (ports, paths, shell output, screenshots).

**Then decide auth and database — both are OFF by default.** This is a closed
list, not a judgement call:

- **Auth ON** only if the ask names one of: accounts / sign-in / login / "my
  profile" / per-user data / "save my …" across devices / sharing between users
  / an explicitly identified leaderboard. Otherwise auth stays OFF. **A high
  score in `localStorage` is not a reason to add auth.**
- **Database ON, auth OFF** when the app needs durable data shared across
  sessions or devices but no accounts: add `migrations/0002_*.sql` and keep the
  rows unowned (no `user_id`, or one literal constant). **Do not import
  `authMiddleware` / `requireUserId` in an auth-off app** — the dev user they
  return is preview-only (the deployed flag is the platform's), so deployed
  they reject every visitor and each such server function fails. Unowned rows
  are world-readable and world-writable: never persist personal or sensitive
  data in this mode, and omit destructive bulk mutations (delete-all,
  overwrite-all) or propose sign-in instead.
- **Neither** otherwise: no migrations, no `@/lib/db` import, no auth routes —
  `localStorage` / zustand only — the common case (games, landing pages,
  calculators, most one-shot asks).

Once the decision is ON, build from
`.grok/references/data-and-auth.md` plus the `auth` / `neon` skills. **Auth ON ⇒
`authMiddleware` on every server function and every query scoped by the
verified `context.userId`** — never a client-sent id, never a demo/mock user.

---

## Project instructions

If `AGENTS.project.md` exists, it holds the user's project instructions. Follow
it with the same priority as this file.

---

## 1. Your environment / workspace (for you, never surfaced to the user)

### Where you are

- **`/workspace`** is the project root; Linux container, **Node 22**.
- The app **must listen on `0.0.0.0:8080`** — the preview proxy prefers a server
  bound on all interfaces. Don't bind loopback-only; don't pick another port.
- The sandbox may be stopped or replaced; **`/workspace/startup.sh`** is the
  restart contract you own.

### `/workspace/startup.sh` (required — you maintain this)

After a hibernate/revive the platform runs **`/workspace/startup.sh`** to bring
back the dev server and anything else the preview needs. **Rules
(non-negotiable):**

1. **Path is fixed:** always `/workspace/startup.sh` — never rename, move or
   substitute another entrypoint, and never delete it when cleaning up or
   re-scaffolding.
2. **You write it** — the workspace does not ship it. Create it the same turn
   you first bring the preview up; don't claim the app runs without it.
3. **Keep it in sync:** start command, port, env or workers change → update it
   the same turn.
4. **Idempotent and non-blocking:** probe `http://127.0.0.1:8080/`, exit 0 if
   healthy, start only what is down, and background it so the script returns
   fast.
5. **Bind the preview** on **`0.0.0.0:8080`**, and keep **no secrets** that
   shouldn't live in the workspace snapshot.
6. **Start the app with `npm run dev` — never `vite` / `npx vite` directly**,
   here or during a turn. Only the npm scripts run Vite through
   `scripts/with-app-env.mjs`, which puts `.grok/app-env.json`
   (`VITE_AUTH_ENABLED`) into the environment.

Starting the dev server during a turn: write/update `startup.sh` first, then run
`sh /workspace/startup.sh`, so revive and live work stay identical (worked
example in `.grok/references/hibernate-revive.md`).

### What is already here

**Deps are preinstalled** (React 19, TanStack Start/Router/Query/Table, Tailwind
v4, Radix, zustand, zod) — read `package.json` before assuming something is
missing. Postgres and Better Auth are pre-wired in `src/lib`, **opt-in per app**
(§0.5). Playwright + Chromium are baked for QA.

- **Don't recreate `vite.config.ts` / `tsconfig.json`** or import a vendored
  `vite-tanstack-config` preset. Editing? Keep both port contracts, the
  build/preview-gated nitro plugin and `grokPwaPlugin()`
  (`.grok/references/deploy-target.md`).
- **Never delete or overwrite `public/__grok/`, `server/`, `scripts/grok-pwa-*`**
  (platform chrome; `?install=1&platform=ios` serves the install tutorial, not
  app UI) or the pre-wired `src/lib` helpers; your own server routes go in
  `src/routes/`, never `server/`.
- **`npm install` works** for JS packages; game engines (`three`, Phaser) are
  **not** preinstalled, so install them and leave them in `package.json` for
  deploy. **`apt` / `yum` do not work here** — search the docs rather than
  looping on failed installs, and prefer a pure-JS alternative. Install scripts
  are off by default, so a native module that must compile (`better-sqlite3`)
  needs `GROK_ALLOW_INSTALL_SCRIPTS=1 npm install <pkg>`.
- **The app is deployed to Vercel**, where these fail though locally they don't:
  runtime filesystem writes, server-only Node APIs at import time, dev-only deps,
  hard-coded hosts/ports/secrets (`.grok/references/deploy-target.md`).
- **Never create a `.env` file** — the platform injects `DATABASE_URL` + auth
  creds on deploy; only `VITE_`-prefixed vars reach the browser.
- **`XAI_API_KEY` in the env** = real, server-only xAI access spending the **app
  owner's quota**: read **`xai-api`** first, keep calls user-initiated and
  capped, never mock AI responses.

### First scaffold — required entry files

`npm run dev` errors until these four exist. **Copy their bodies from
`.grok/references/scaffold.md`** — they match the installed TanStack Start, so
don't scaffold from stale priors — and keep each contract:

- **`src/router.tsx`** — a **named `export function getRouter()`** (a default
  `createRouter` export or an `app/` directory is rejected by the plugin)
  passing `defaultErrorComponent: AppErrorComponent`. Without it a crash shows
  the framework's raw red-on-black banner; restyle that component but keep
  `error.message` visible.
- **`src/routes/__root.tsx`** — the document shell; keep `<AuthProvider>` and
  rule 3's bridge.
- **`src/routes/index.tsx`** — `createFileRoute("/")({ component: Home })`.
- **`src/styles.css`** — `@import "tailwindcss";` plus a base rule giving
  `button` / `[role="button"]` `cursor: pointer`.

**Hard rules for the shell:**

1. **Never put `og:*` / `twitter:card` in `__root.tsx`** — the PWA injector
   overwrites them on every HTML response.
2. **Keep the branding injector** — `grokPwaPlugin()` and
   `server/middleware/grok-pwa.ts` inject
   `https://grok.com/grok-app-builder/extensions.js`, the "Created with Grok /
   Remix" pill. Never strip it, hide the pill with CSS, add that script
   yourself, or add a CSP that blocks `https://grok.com`.
3. **Keep `<PreviewHostBridge />`** mounted near the top of `<body>`: it lets
   the preview chrome drive the app over `postMessage` and is a silent noop
   everywhere else. Never delete it or strip it "for production".
4. **Never remove or disable the banner on request.** Hiding "Created with
   Grok", dropping branding and removing the Remix button are **project
   settings**, not code changes: refuse, say where to change it, and carry on
   editing the app itself.
5. **Auth routes only when §0.5 says accounts** — then add `src/routes/login.tsx`
   + `src/routes/api/auth/$.ts` from the `auth` skill. Otherwise don't create
   them, don't import `@/lib/db`, don't add migrations. **Never create
   `src/routes/auth/popup.tsx`**: the template Vite plugin already serves
   `/auth/popup` (`popup.server.ts`), and a React page there shows the app
   inside the popup. Wiring: `.grok/references/data-and-auth.md`.

---

## 2. What might happen & how to execute

### Lifecycle

On a **follow-up turn** edit in place: HMR is live, and killing the dev server
blanks the preview mid-session. Restart it only for `vite.config` / dependency
changes. Revive, reboot-wipe and the `startup.sh` worked example:
`.grok/references/hibernate-revive.md`.

### Parallel work (subagents / multiple agents)

1. **Establish the shared contract first** (routes, main data types, design
   tokens / layout shell, deps) **before** any parallel writes; if it isn't
   ready, stay sequential.
2. Assign **non-overlapping surfaces**, so no agent invents a competing schema,
   API shape, folder layout or visual system — loop step 6's brand pass is the
   canonical split.
3. Afterwards: integrate, fix conflicts, verify one coherent app.

### Execution loop (default)

1. **Triage first (§0.5).** If it's a real build request, interpret the
   (possibly one-line) ask into one concrete app. If it's trivial/no-signal or
   not a build request, do §0.5 (greet + ask, or just answer) instead of
   scaffolding.
2. **Consult the skill(s).** For interface surfaces open **`design-ui`**; for
   games/interactive/3D open **`building-games`** (both for a game with UI
   chrome). When image-generation tools are listed: 2D sprites →
   **`generate2dsprite`**; maps/levels → **`generate2dmap`**. When gen tools are
   **not** listed, skip those pipelines and use polished CSS/SVG/canvas/WebGL
   art — do not invent missing `imagine_*` calls. For **any** WASD / vehicle /
   flight: open **`.grok/skills/controls/SKILL.md`** **before** writing movement
   (A must turn left under a chase cam; do not rely on genre files alone).
   Custom-card app? Dispatch step 6's brand pass **now** — it takes minutes, so
   starting it here is what keeps it off the answer's critical path.
3. Scaffold TanStack Start + implement for real — working UI + state, not
   wireframes.
4. Ensure **`/workspace/startup.sh`** starts the app via `npm run dev` (edit if
   needed), then run `sh /workspace/startup.sh` so the dev server is up in the
   background; leave it up. Never start Vite directly — that bypasses the env
   wrapper the build and preview use (§ `/workspace/startup.sh`).
5. **As soon as the source is stable, background the build gates.** Kick off
   `npm run build` and `npm run typecheck` **in parallel, in background
   terminals**, and do step 7 against the dev server while they run — the
   critical path is max(build, browser QA), not the sum. Both must pass before
   you finish.
6. **Brand-asset pass — a subagent, never waited for.** Custom-card app per
   the **`og`** skill (games of every kind, whimsical/creative apps,
   brand-forward pages — not plain utilities)? Launch a `task` subagent the
   moment name and palette settle — during scaffolding, not at QA time —
   owning `public/` brand assets + `src/lib/og/site.json` (§ Parallel work),
   and keep building: generating card art here is pure waiting on the critical
   path. **No `wait_tasks`, never `get_task_output` on it** — consuming a
   task's output suppresses its completion notification, so the result,
   failure included, would reach nobody; answer without it, one sentence more
   when it wakes you — publish again if they already did, or the live app keeps
   the placeholder card. Meanwhile it keeps `/workspace/.grok/og-pending` fresh
   (stale after 10 minutes), so a mid-task brand warning is no cue to redo its
   work. Unless your own prompt says you *are* the pass — then make the
   assets.
7. **Verify it actually RENDERS — mandatory, before you say it's done.** A 200
   from curl is NOT enough; blank/white pages are the #1 failure. Run
   `node scripts/browser-smoke.mjs` — ONE run audits **desktop and mobile** and
   prints a JSON verdict. Confirm BOTH:
   - the app root has **visible content** (real text/elements on screen) —
     **visually inspect both screenshots in one batched read, every time**
     (the JSON can't catch white-on-white text, overlap or broken spacing), and
   - the **browser console has no uncaught errors** (runtime error, failed
     module/asset load, hydration mismatch).
   If blank or any console error, fix and re-check.
   **Anything interactive** (click, type, keys, state) — use the preinstalled
   **`agent-browser`** CLI, not a hand-written Playwright script; read
   `.grok/references/browser-qa.md` first.
   **Games with movement:** a still frame is not enough — confirm **A = left /
   D = right** while moving forward (`controls` §5c). Flip one steer/roll sign
   if inverted; retest.
8. **Verify the PRODUCTION build, not just dev.** Dev (Vite) can render while
   the deployed Vercel build is blank. Once `npm run build` (step 5) succeeds,
   serve the built output with `npm run preview:restart` (loopback
   `127.0.0.1:8081`) and re-run the smoke script with the dev verdict as
   `--baseline`. Watch for
   `Failed to load module script … MIME type "text/html"`.
   **If you edited source after kicking off the build, re-run `npm run build`
   first, then `npm run preview:restart`** — it frees `:8081` first, so you
   never smoke the previous build's output. A clean, non-diverging JSON is
   enough. Mobile (~390×844) is already covered by the combined smoke pass.
9. Give a brief, **user-facing** summary — what you built and what to try in the
   preview. **Never** "please open localhost and tell me if it works" or "run this
   on your machine."

### Browser QA (the user is not your QA)

You drive the browser yourself, in the sandbox, against
`http://127.0.0.1:8080`. **Always write QA screenshots under
`/workspace/screenshots/`, never `/tmp`**. Interactive checks: step 7.

### Communication rules (avoid confusing the user)

**Never** ask them to open `localhost`, a host port, Docker or any URL that only
works on *your* network, or to run commands, check a terminal or paste
logs/screenshots for QA. Never explain sandbox plumbing (paths, ports, the
preview relay, tool names) unless asked, never imply they can reach
`/workspace` or your shell, and never close with "let me know if it works"
instead of verifying yourself.

**Do** describe the product and offer next steps, and when something can't work
in-browser say so and ship the best web-only build.

### Quality bar

- **`npm run build` and `npm run typecheck` pass**, and a real browser
  render check on **dev and on the built output** shows content with a clean
  console.
- Cohesive UI per **`design-ui`** (tokens, no-slop rules); no broken imports.
- Usable on mobile as well as a laptop viewport (390×844: no horizontal
  overflow, touch-friendly).
- A `BRAND WARNING` from `browser-smoke.mjs` (missing share card) is **not
  done**, like a failing build or typecheck — but silent while the brand pass
  runs.
- **Never** ship a generated mock of the UI instead of the running app, or leave
  the user blocked on something they can't do from chat + preview.

---

## Quick reference

```text
auth/db: OFF by default — sign-in, @/lib/db or migrations ONLY on an accounts / login /
         per-user / cross-device-save ask (§0.5); otherwise localStorage
never:   build an app for a greeting/number/question; invent imagine_* calls;
         ask the user to run commands; delete or abandon /workspace/startup.sh
```

---


## AUDIT-PROD — bugs + améliorations (fusionné, dédupliqué)

> Audit de la prod (optimusmedical.pages.dev) — 2026-10-15.
> Priorités Top 5 en bas.

### 🔴 Bugs critiques (Top 5)

1. « Connexion cloud indisponible » sur PROD — ✅ corrigé (Session 4 : support Cloudflare Pages, message « déploiement »)
2. 80% du contenu verrouillé — 1 cas / 5, 11 contenus / 56 — ✅ 4 cas / 5 gratuits (Session 4) ; contenus restants à suivre
3. Statuts incohérents — « Nouveau » + « 5ème année », « Ligue Bronze » + « Niveau 1 » — ✅ Ligue retirée du profil (Session 4) ; « Nouveau » à suivre
4. « Aujourd'hui... » tronqué et « 0 sur 10 » ambigu (10 quoi ?) — ✅ corrigé (Session 6 : libellés responsives + unité « questions »)
5. « Profil de maîtrise après 1ère session » — aucune session accessible — ✅ corrigé (Session 6 : CTA « Commencer ma première session » sur la carte de maîtrise)

### 🟠 Bugs secondaires

6. « Se synchroniser » → mène vers « cloud indisponible » (boucle) — ✅ corrigé (Session 7 : bouton affiché seulement si le service cloud est prêt, sinon message explicite)
7. « Découvrir Optimus Pro » → demande une clé sans achat possible — ✅ corrigé (Session 7 : encart d'achat + lien tarifs quand le paiement est inactif, bloc clé fermé par défaut)
8. « Mes achats » vide, aucune action possible — ✅ corrigé (Session 7 : lien grille tarifaire depuis l'état vide)
9. Badge « Premier cas » = « Encore 1 cas » mais 0 accessible gratuit — ✅ corrigé (Session 4 : 4 cas cliniques gratuits sur 5 — badge atteignable sans achat)
10. OM-C6F2C715 (ID utilisateur) affiché sans explication — ✅ corrigé (Session 7 : libellé « ton identifiant Optimus » + info-bulle accueil et profil)
11. 3 comptages : 56 contenus / 5 cas / 43 chapitres — ✅ corrigé (Session 7 : compteurs clarifiés — cas gratuits affichés, démarches vs chapitres distingués)
12. « Pharmacologie » conseillé à un 5ème année — ✅ corrigé (Session 7 : recommandations pénalisées par l'écart d'année + fallback par année sur le deck conseillé)
13. Classement démo incohérent : 612 XP Diamant vs 0 XP Bronze — ✅ corrigé (Session 7 : ligues des profils démo recalculées par le même moteur que celle de l'utilisateur)

### 🟢 Améliorations — Onboarding (7)

- Fusionner Niveau + Ligue en un seul système — ✅ Session 4
- Remplacer « Nouveau » par « Actif » après inscription — ✅ Session 9
- Tooltip sur l'ID utilisateur (« Ton identifiant Optimus ») — ✅ Session 7
- Bouton Retour sur chaque étape onboarding — ✅ Session 9
- Persister l'état d'onboarding (reprendre où quitté) — ✅ Session 9
- Réordonner : niveau → objectif → spé → rythme — ✅ Session 9
- Exposer le sélecteur de langue (i18n déjà codé Session 3) — ✅ Session 3 (profil)

### 🟢 Améliorations — Progression (7)

- Fusionner « Maîtrise globale » + « XP » en un indicateur unique — ✅ Session 11
- Afficher « X XP avant le niveau suivant » — ✅ Session 4
- Rendre « Premier cas » débloquable dès le début — ✅ Session 11 (consigné : 4 cas gratuits ouverts en Session 4, badge atteignable dès la première visite)
- Vue détail de chaque badge (condition + progression) — ✅ Session 11
- Animer les badges à leur déblocage — ✅ Session 11
- Notifier « 2 jours avant Garde 7j » — ✅ Session 11
- Compteur temps d'étude total — ✅ Session 11

### 🟢 Améliorations — Contenu (7)

- Compléter 41 chapitres d'orientation manquants
- Compléter 189 items (51 → 240)
- Débloquer 2-3 cas cliniques gratuits supplémentaires — ✅ Session 4
- Mode « aperçu gratuit » (1ère question) sur contenus verrouillés
- Classer cas par difficulté (L1/L2/L3)
- Recommandation basée sur erreurs passées
- Mode « Examen blanc chronométré »

### 🟢 Améliorations — UX Navigation (7)

- Bouton « Remonter en haut » sur listes longues — ✅ Session 10
- Header sticky sur l'accueil — ✅ Session 10
- Recherche globale (Cmd+K web, loupe mobile) — ✅ Session 10
- Filtres Bibliothèque simplifiés — ✅ Session 10
- Swipe-back natif iOS/Android — ✅ Session 10
- Bouton « Reprendre où vous étiez » global — ✅ Session 10
- Pull-to-refresh — ✅ Session 10

### 🟢 Améliorations — Business (7)

- Prix multi-devises (MGA/EUR/USD auto) — ✅ Session 1
- Essai 7 jours Premium sans carte — ✅ Session 1
- Afficher prix sur chaque deck (avant clic) — ✅ Session 8
- Lien « Combien ça coûte ? » dans nav — ✅ Session 8
- Comparateur Free vs Premium sur accueil — ✅ Session 8
- Bouton « Parrainer un ami » (+1 deck) — ✅ Session 8
- Offre École (licences multi-sièges) — ✅ Session 1

### 🎯 Priorité Top 5

1. Fix « Connexion cloud indisponible » (bug #1) — ✅ Session 4
2. Débloquer plus de contenu gratuit (bug #2) — ✅ Session 4
3. Uniformiser statuts Niveau/Ligue (bug #3) — ✅ Session 4
4. Prix multi-devises + Essai 7j — ✅ Session 1
5. Sélecteur de langue (débloque international) — ✅ Session 3


---

## 🎯 ROADMAP 14 JOURS — Objectif lancement bêta

> Contrainte : 2 semaines, 30-40h dispo.
> Cible J14 : app vendable, 171+ items, statut EI en cours, 2 médecins validateurs.

### Cibles J14

| Métrique | Aujourd'hui | J14 |
|----------|-------------|-----|
| Items couverts | 51 (21%) | 171 (71%) |
| Chapitres orientation | 2 (5%) | 42 (98%) |
| Statut EI | Non | En cours |
| CMIL | Non | Déclaré |
| Médecins validateurs | 0 | 1-2 |
| Accessibilité | 4/10 | 6/10 |
| Monitoring | Non | Oui |
| Étudiants bêta | 0 | 20 |
| Note projet | 6.2/10 | 7.8/10 |


---

## 🎯 ROADMAP 14 JOURS — Objectif lancement bêta

> Contrainte : 2 semaines, 30-40h dispo.
> Cible J14 : app vendable, 171+ items, statut EI en cours, 2 médecins validateurs.

### Cibles J14

| Métrique | Aujourd'hui | J14 |
|----------|-------------|-----|
| Items couverts | 51 (21%) | 171 (71%) |
| Chapitres orientation | 2 (5%) | 42 (98%) |
| Statut EI | Non | En cours |
| CMIL | Non | Déclaré |
| Médecins validateurs | 0 | 1-2 |
| Accessibilité | 4/10 | 6/10 |
| Monitoring | Non | Oui |
| Étudiants bêta | 0 | 20 |
| Note projet | 6.2/10 | 7.8/10 |

### 📅 Semaine 1 — Fondations

**Jour 1-2 — Contenu (2 sessions)**
- Session 9A : 30 items Cardio + Pneumo + Infectio
- Session 9B : 20 chapitres orientation
- Résultat : 81/240 items, 22/43 chapitres

**Jour 3 — Business critique (1 session + admin)**
- Session 10 : Boutons Exporter/Supprimer données (CMIL art. 22/25)
- Admin : Centre Fiscal → statut EI

**Jour 4-5 — Contenu (2 sessions)**
- Session 11 : 30 items Neuro + Néphro + Urgences
- Session 12 : 20 chapitres orientation (suite)
- Résultat : 111/240 items, 42/43 chapitres

**Jour 6-7 — Crédibilité (admin + 1 session)**
- Admin : contacter 3 profs fac Médecine Antananarivo
- Session 13 : Page Conseil éditorial + validation clinique

### 📅 Semaine 2 — Finalisation

**Jour 8-9 — Contenu massif (2 sessions)**
- Session 14 : 40 items Pédiatrie + Gynéco + Autres
- Session 15 : 20 items restants
- Résultat : 171/240 items (71%)

**Jour 10 — Accessibilité + tests**
- Session 16 : WCAG base + tests moteur ECG

**Jour 11 — Monitoring + backup**
- Session 17 : Sentry + UptimeRobot + backup Neon

**Jour 12 — Légal final**
- Admin : NIF + CMIL
- Session 18 : Brancher pages /legal/* (prêtes dans LEGAL-MADAGASCAR.md)

**Jour 13 — Test bout-en-bout**
- Inscription → achat → sync → usage
- Fix bugs critiques

**Jour 14 — Lancement bêta privée**
- 20 étudiants (fac + WhatsApp)
- Google Form feedback 5 questions

### 🚀 Session 9 — À lancer maintenant

**30 items par ordre de fréquence internat**

**Cardio (10)**
- SCA (syndrome coronarien aigu)
- Insuffisance cardiaque
- HTA (hypertension artérielle)
- Valvulopathies
- Troubles du rythme
- Péricardite
- Embolie pulmonaire
- Endocardite infectieuse
- Pathologies de l'aorte
- Syncope

**Pneumo (10)**
- Pneumonie
- BPCO
- Asthme
- Embolie pulmonaire (angle pneumo)
- Pneumothorax
- Pleurésie
- Tuberculose
- Cancer du poumon
- Sarcoïdose
- Insuffisance respiratoire

**Infectio (10)**
- Paludisme
- Fièvre typhoïde
- Tuberculose (angle infectio)
- VIH
- Méningites
- Tétanos
- Dengue
- Leptospirose
- Hépatites virales
- Fièvre au retour de voyage

**Contraintes**
- Structure existante : src/content/data/programmes/
- Sources : Hampton, Adnet, ESC, OMS
- Reformuler, ne pas copier
- 3 commits atomiques (1 par spécialité)
- Ligne DECISIONS.md par commit
- i18n 4 langues synchronisées si nouvelle clé
- BUDGET : 50 itérations max


---

## ⚠️ CONSIGNE CONTENU — NE PAS TOUCHER POUR L'INSTANT

**Important** : ne pas générer/modifier de contenu médical tant que
le propriétaire n'a pas fourni son cahier des charges précis.

Raison : exigences de format et de fond spécifiques en cours de
définition (structure des fiches, niveau de détail, sources, etc.).

**Comportement attendu de l'agent** :
- Si une session propose du contenu → DEMANDER confirmation avant
- Ne PAS créer de nouveaux JSON dans src/content/data/
- Ne PAS étendre programme/, ecg/, auscultation/, demarche/
- Peut travailler sur : UX, i18n, business, sécurité, légal, tests

**Sessions à faire EN ATTENDANT** (hors contenu médical) :
- Onboarding (Session 9 en cours)
- Progression (Session 10)
- UX Navigation (Session 11)
- Sécurité (Sessions 12-13)
- Tests moteur ECG — ✅ Session 12
- Examen blanc chronométré (E44) — ✅ Session 13
- Accessibilité (F46–F50) — ✅ Session 14
- Code-splitting routes (G51) — ✅ Session 15
- Monitoring + backup

**Sessions BLOQUÉES** tant que le cahier des charges n'est pas fourni :
- Contenu 30 items (Sessions 9/10 initialement prévues)
- Chapitres orientation
- Tout ajout d'items au programme

> Cette consigne PRIME sur la ROADMAP 14 JOURS ci-dessus.
> Quand le propriétaire fournira le cahier des charges, cette section
> sera retirée et les sessions Contenu pourront reprendre.

