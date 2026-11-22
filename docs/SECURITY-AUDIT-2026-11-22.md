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
   (`/admin-login` + `/admin-login/`).`
2. **Analyse non bornée de `RECENT_WINDOW_MINUTES`** (faible, robustesse) :
   une valeur non numérique portait `recentWindow` à `NaN` et faisait échouer
   le cast SQL `$3::interval` en 500 brut. Désormais borné a [1 ; 1440] avec
   défaut 60 (server/api/surveys/[id]/responses.ts).

## Faille connue non corrigée ici (plan d'action)
3. **CSP : `script-src 'unsafe-inline'` en production**
   (server/middleware/security-headers.ts + public/_headers).
   Régression assumée après l'incident du 2026-11-20/21 (page blanche : TanStack
   Start émet des scripts inline d'hydratation hors THEME_BOOT_SCRIPT).
   Solution ciblée : CSP par nonce — générer un nonce par requête dans le
   middleware, l'exposer au rendu (head) et faire porter le nonce par les
   scripts inline émis par TanStack (ou basculer les données d'hydratation hors
   scripts inline), puis retirer `'unsafe-inline'` des deux politiques (CDN et
   worker) et vérifier par un test de smoke e2e.
