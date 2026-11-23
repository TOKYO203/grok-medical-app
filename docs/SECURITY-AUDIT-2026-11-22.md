# Audit de sécurité — 2026-11-22 (repo grok-medical-app)

## Périmètre
Revue statique de la couche serveur Nitro/H3 (middleware, API, garde admin),
du service worker, des en-têtes de sécurité et de la configuration CI.

## Points déjà solides (à préserver)
- Auth API : fail closed, sessions Better Auth vérifiées, allowlist éditoriale
  (server/lib/route-auth.ts), isolation Fetch-Metadata (src/lib/auth/isolation.server.ts).
- Comparaisons de secret à temps constant + throttling (src/lib/security/admin-auth.server.ts).
- Rate limiting SQL pseudonymisé, sel obligatoire en production (server/lib/rate-limit.ts).
- Requêtes SQL exclusivement paramétrées; aucune concat actionnable trouvée.
- Uploads : auth + quota + taille + extension + signature binaire (publications/upload.ts).
- SW : aucun document ni /content/* en cache (public/sw.js).
- CI : CodeQL, gitleaks (delta), npm audit, Dependabot.

## Failles trouvées et corrigées dans ce PR
1. **Contournement de préfixe du garde admin** (faible, defense-in-depth) :
   `pathname.startsWith("/admin-login")`épargnait aussi `/admin-login-<suffixe>`,
   surface `/admin*` sans garde. Corrigé en correspondance exacte
   (`/admin-login` + `/admin-login/`).
2. **Analyse non bornée de `RECENT_WINDOW_MINUTES`** (faible, robustesse) :
   une valeur non numérique portait `recentWindow` à `NaN` et faisait échouer
   le cast SQL `$3::interval` en 500 brut. Désormais borné à [1 ; 1440] avec
   défaut 60 (server/api/surveys/[id]/responses.ts).

## Faille 3 — CORRIGÉE (commit CSP 2026-11-22)
3. ~~CSP : `script-src 'unsafe-inline'` en production~~ → **CORRIGÉ**.
   Solution retenue : allowlist par hash des scripts inline RÉELLEMENT rendus.
   Le middleware (server/middleware/security-headers.ts) lit le HTML de chaque
   réponse `text/html` en production, calcule `sha256-<code>` de chaque bloc
   `<script>` inline (thème + hydratation TanStack Start + tout inline futur)
   et remplace `script-src` par `'self' <hashes>` — plus aucun
   'unsafe-inline' en production sur les documents. `public/_headers` passe
   aussi à `script-src 'self'` (aucun HTML ni script inline servi par le CDN).
   Filet de sûreté : l'échec de lecture du HTML réintroduit 'unsafe-inline'
   UNIQUEMENT pour la réponse en cause, avec log — jamais de page blanche
   généralisée (leçon de l'incident 2026-11-20/21). Le développement local
   conserve 'unsafe-inline' (Vite injecte ses propres scripts inline). Une
   vérification post-mise-en-prod (smoke e2e + console) reste recommandée.
   `scripts/security-hardening.test.mjs` verrouille le nouveau contrat.
