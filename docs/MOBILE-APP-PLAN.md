# Plan application mobile (Capacitor) - Optimus

Decision : remplacer la PWA par une vraie app mobile via Capacitor (reutilisation ~95% du code existant).
Cible : Android d abord, iOS ensuite. Perimetre : toute l app (catalogue, quiz, premium, achats).

## Pourquoi Capacitor ici

- Le repo est React 19 + Vite 8 + TanStack Start (SSR nitro) + Worker Cloudflare + Supabase.
- Le contenu premium (fiches, cas Signes) est servi par le Worker derriere des jetons de contenu
  lies a l identite (/content/$type/$file, cf. SECURITE PREMIUM dans vite.config.ts).
  Un bundle client seul ne peut PAS servir ce contenu sans casser le garde : la WebView charge
  l app deployee en phase 1, puis on reimplementera le stockage hors-ligne en phase 2.

## Phase 1 - coque distante (cette branche)

1. capacitor.config.ts ajoute (appId mg.optimus.medical).
2. server.url lu depuis CAP_SERVER_URL au build : phase 1 = URL du Worker en prod.
3. Workflow GitHub Actions android-release.yml : assemble un APK debug a la demande
   (workflow_dispatch) des que android/ est present.
4. PWA conservee en repli (pas de regression pour les utilisateurs actuels).

## Phase 2 - hors-ligne reellement local

- Mode SPA (ssr desactive) ou pre-rendu embarque, decks chiffres embarques,
  (deck:encrypt + signature existants), PGLite local, sync reprise par le Worker.
- Alignement achats : validations Play Billing / Lemonsqueezy webhook a reviser (issues #6, #8).

## Commandes a lancer UNE fois localement (generent android/, non reproductibles ici)

    npm install @capacitor/core @capacitor/cli @capacitor/android
    npx cap init "Optimus" "mg.optimus.medical" --web-dir dist-mobile
    npm run build:dev
    npx cap add android
    npx cap sync android
    git add android/ capacitor.config.ts package.json package-lock.json
    git commit -m "mobile: socle Capacitor Android"

> android/ doit etre commite (convention Capacitor : wrapper Gradle versionne).

## Etape suivante

- Ouvrir le workflow Android (Capacitor) -> workflow_dispatch -> recuperer l artifact APK debug.
- Tester sur un appareil : splash, icones, OAuth (deep-link/callback), quotas offline.
