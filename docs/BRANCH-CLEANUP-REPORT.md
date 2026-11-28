# Nettoyage des branches distantes - rapport

Genere le 2026-11-28 12:02 - **aucune branche supprimee**.

Source : git branch -r --no-merged origin/main (291 branches) croise avec l'API GitHub (524 PR, tous etats).

## Methode

Une branche peut etre reutilisee par plusieurs PR : c'est la PR la plus recente (numero le plus eleve) qui fait foi.

## Synthese

| Categorie | Nombre | Critere |
| --- | --- | --- |
| Suppression sure | 239 | PR fusionnee (le contenu est deja dans main) |
| A verifier | 24 | PR fermee sans merge, ou aucune PR |
| A conserver | 28 | PR ouverte |

## Branches supprimables (PR fusionnee)

| Branche | Commits d'avance | Dernier commit | PR |
| --- | --- | --- | --- |
| feat/page-sujet | 1 | 2026-10-17 | #70 |
| fix/cloudflare-pg-driver | 1 | 2026-10-23 | #130 |
| fix/db-diagnostic | 3 | 2026-10-23 | #126 |
| fix/db-ssl | 1 | 2026-10-23 | #123 |
| feat/case-immersion-phase1 | 7 | 2026-10-23 | #124 |
| feat/devx-mistral-cli | 1 | 2026-10-23 | #122 |
| feat/case-immersion-phase2 | 2 | 2026-10-23 | #127 |
| chore/rebuild-health-real | 1 | 2026-10-24 | #142 |
| fix/checkout-paying-lock | 1 | 2026-10-24 | #135 |
| fix/checkout-rest-rpc | 1 | 2026-10-24 | #134 |
| debug/checkout-error | 1 | 2026-10-24 | #140 |
| debug/health-extended | 1 | 2026-10-24 | #141 |
| contenu/urgences-etat-de-choc | 2 | 2026-10-24 | #147 |
| chore/rebuild-final-1 | 2 | 2026-10-24 | #138 |
| fix/remove-debug-db-route | 1 | 2026-10-24 | #143 |
| feat/light-hero-accent | 4 | 2026-10-24 | #136 |
| fix/webhook-rest-real | 1 | 2026-10-24 | #146 |
| fix/with-app-env-resolve-vite | 1 | 2026-10-24 | #144 |
| fix/webhook-rest-rpc | 1 | 2026-10-24 | #145 |
| fix/checkout-merged-env | 1 | 2026-10-24 | #139 |
| fix/webhook-ci-pglite | 1 | 2026-10-25 | #151 |
| content/phase5-premium | 5 | 2026-10-25 | #148 |
| fix/hide-pay-button-pro | 1 | 2026-10-25 | #153 |
| fix/health-ready-logic | 1 | 2026-10-25 | #152 |
| docs/cgu-cgv | 1 | 2026-10-26 | #154 |
| fix/auth-server-lazy-random | 1 | 2026-10-26 | #167 |
| fix/cf-worker-global-io | 1 | 2026-10-26 | #162 |
| fix/preview-secret-rename | 1 | 2026-10-26 | #168 |
| fix/mobile-order-rpc | 1 | 2026-10-26 | #165 |
| fix/ratelimit-final | 1 | 2026-10-26 | #171 |
| fix/provision-optimus-id | 1 | 2026-10-26 | #173 |
| fix/ratelimit-cf-workers | 1 | 2026-10-26 | #169 |
| test/disable-better-auth | 1 | 2026-10-26 | #174 |
| contenu/infectio-fievres-typhoides | 4 | 2026-10-26 | #149 |
| contenu/infectio-vih | 7 | 2026-10-26 | #166 |
| feat/pricing-v2 | 1 | 2026-10-27 | #198 |
| feat/analytics-instrumentation | 1 | 2026-10-27 | #204 |
| feat/auth-decouvrir-link | 1 | 2026-10-27 | #203 |
| docs/trust-layer-v2 | 1 | 2026-10-27 | #180 |
| fix/ariari-lazy-env | 1 | 2026-10-27 | #202 |
| feat/content-quality-check | 1 | 2026-10-27 | #186 |
| fix/ariari-use-supabase-auth | 2 | 2026-10-27 | #213 |
| feat/ariari-integration | 1 | 2026-10-27 | #201 |
| chore/content-audit-scripts | 1 | 2026-10-27 | #189 |
| docs/roadmap-v2 | 1 | 2026-10-27 | #175 |
| fix/lazy-better-auth | 1 | 2026-10-27 | #190 |
| docs/i18n-v2 | 2 | 2026-10-27 | #193 |
| docs/imaging-module | 1 | 2026-10-27 | #185 |
| docs/b2b-institutionnel-v2 | 3 | 2026-10-27 | #182 |
| debug/ariari-trace | 1 | 2026-10-27 | #212 |
| debug/ariari-bis | 1 | 2026-10-27 | #211 |
| docs/analytics-v2 | 1 | 2026-10-27 | #181 |
| docs/landing-v2-spec | 1 | 2026-10-27 | #183 |
| docs/positionnement-v2 | 2 | 2026-10-27 | #179 |
| docs/medical-audit-protocol | 1 | 2026-10-27 | #187 |
| docs/legal-guardrails | 1 | 2026-10-27 | #188 |
| docs/pricing-v2 | 2 | 2026-10-27 | #192 |
| docs/launch-plan-v2 | 1 | 2026-10-27 | #196 |
| feat/ariari-serverfn | 1 | 2026-10-28 | #219 |
| fix/ariari-sdk-officiel | 1 | 2026-10-28 | #218 |
| feat/first-content-viewed-surfaces | 1 | 2026-10-28 | #217 |
| feat/ariari-button-ui | 1 | 2026-10-28 | #220 |
| fix/ariari-supabase-v3 | 2 | 2026-10-28 | #216 |
| chore/add-mcp-config | 1 | 2026-10-29 | #223 |
| sandbox/ariari-webhook | 1 | 2026-10-29 | #225 |
| sandbox/fix-double-middleware | 1 | 2026-10-29 | #224 |
| sandbox/freebuff-webhook | 2 | 2026-10-29 | #222 |
| feat/design-dark-oxford | 1 | 2026-10-29 | #221 |
| fix/esc-2023-endocardite-doi | 1 | 2026-10-30 | #238 |
| feat/fiches-imagerie-pilote | 2 | 2026-10-30 | #230 |
| feat/fiche-endocardite | 1 | 2026-10-30 | #236 |
| feat/fiche-epilepsies | 1 | 2026-10-30 | #233 |
| fix/angine-de-poitrine | 2 | 2026-10-30 | #235 |
| chore/qa-audit-pages-publiques | 1 | 2026-10-30 | #228 |
| feat/fiche-pericardites | 1 | 2026-10-30 | #240 |
| feat/fiche-pneumothorax | 1 | 2026-10-30 | #232 |
| feat/fiche-image-block | 1 | 2026-10-30 | #229 |
| feat/fiche-infarctus-myocarde | 4 | 2026-10-30 | #231 |
| feat/fiche-oap | 1 | 2026-10-30 | #237 |
| feat/landing-trust-links | 1 | 2026-10-30 | #227 |
| feat/institutionnel-b2b | 3 | 2026-10-30 | #209 |
| feat/trust-pages | 3 | 2026-10-30 | #205 |
| feat/landing-decouvrir | 2 | 2026-10-30 | #200 |
| feat/qr-code-parrainage | 1 | 2026-10-30 | #241 |
| fix/sources-acs-audit | 2 | 2026-10-30 | #239 |
| feat/fiche-angor-instable | 1 | 2026-10-30 | #234 |
| feat/fiche-schistosomiase | 1 | 2026-10-31 | #270 |
| feat/fiche-toxoplasmose | 1 | 2026-10-31 | #300 |
| feat/fiche-tetanos | 1 | 2026-10-31 | #282 |
| fix/fiche-dyspnee-laryngee-enfant | 1 | 2026-10-31 | #312 |
| feat/fiche-thromboses-veineuses | 1 | 2026-10-31 | #249 |
| feat/fiche-schizophrenie | 1 | 2026-10-31 | #259 |
| fix/fiche-immunisation-foeto-mat | 1 | 2026-10-31 | #308 |
| feat/palettes-4-premium | 1 | 2026-10-31 | #318 |
| feat/fiche-retrecissement-mitral | 1 | 2026-10-31 | #250 |
| fix/imagerie-index-route | 1 | 2026-10-31 | #246 |
| feat/fiche-retrecissement-aortique | 1 | 2026-10-31 | #248 |
| feat/fiche-psoriasis | 1 | 2026-10-31 | #274 |
| fix/grippe-coquilles | 1 | 2026-10-31 | #289 |
| feat/fiche-rheumatisme-articulaire-aigu | 1 | 2026-10-31 | #254 |
| feat/fiche-rougeole | 1 | 2026-10-31 | #283 |
| feat/valeurs-reference | 1 | 2026-10-31 | #268 |
| fix/contact-link-import | 1 | 2026-10-31 | #242 |
| design/oxford-premium-polish | 7 | 2026-10-31 | #303 |
| fix/coquilles-grippe-rougeole | 1 | 2026-10-31 | #290 |
| feat/fiche-avc-hemorragique | 1 | 2026-10-31 | #264 |
| feat/imagerie-nav | 1 | 2026-10-31 | #255 |
| feat/imagerie-moteur-mvp | 1 | 2026-10-31 | #243 |
| feat/imagerie-quickaction | 2 | 2026-10-31 | #258 |
| feat/imagerie-linked-pathology | 1 | 2026-10-31 | #295 |
| feat/fiche-trouble-psychique-grossesse | 1 | 2026-10-31 | #263 |
| feat/fiche-troubles-acido-basique | 1 | 2026-10-31 | #302 |
| feat/fiche-transfusion | 1 | 2026-10-31 | #317 |
| feat/fiche-trouble-bipolaire | 1 | 2026-10-31 | #257 |
| fix/fiche-dermatophytes-relecture | 1 | 2026-10-31 | #279 |
| feat/fiche-varicelle-zona | 1 | 2026-10-31 | #287 |
| feat/fiche-vih | 1 | 2026-10-31 | #286 |
| fix/fiche-candidose-relecture | 1 | 2026-10-31 | #277 |
| feat/fiche-asthme-aigu-grave | 1 | 2026-10-31 | #252 |
| feat/fiche-bouffee-delirante | 1 | 2026-10-31 | #260 |
| feat/fiche-grippe | 1 | 2026-10-31 | #288 |
| feat/fiche-grossesse-hta | 1 | 2026-10-31 | #309 |
| feat/fiche-goutte | 1 | 2026-10-31 | #298 |
| feat/fiche-ectoparasitoses | 1 | 2026-10-31 | #280 |
| feat/fiche-gonocoques-chlamydia | 1 | 2026-10-31 | #281 |
| fix/rougeole-amnesie-immunitaire | 1 | 2026-10-31 | #284 |
| feat/fiche-hyperkaliemie | 1 | 2026-10-31 | #304 |
| feat/fiche-hta-secondaire | 1 | 2026-10-31 | #251 |
| feat/fiche-hemorragie-meningee | 1 | 2026-10-31 | #265 |
| fix/rougeole-coquilles-2 | 1 | 2026-10-31 | #285 |
| feat/fiche-dyspnee-laryngee-enfant | 1 | 2026-10-31 | #311 |
| feat/fiche-crise-hta | 1 | 2026-10-31 | #244 |
| feat/fiche-cysticercose | 1 | 2026-10-31 | #269 |
| fix/theme-system-resolved-label | 1 | 2026-10-31 | #313 |
| feat/fiche-polynevrites | 1 | 2026-10-31 | #273 |
| feat/fiche-candidose | 1 | 2026-10-31 | #276 |
| feat/fiche-deshydratation-nourrisson | 1 | 2026-10-31 | #316 |
| feat/fiche-detresse-resp-nouveau-ne | 1 | 2026-10-31 | #315 |
| feat/fiche-deshydratation | 1 | 2026-10-31 | #301 |
| feat/fiche-delirium-tremens | 1 | 2026-10-31 | #261 |
| feat/fiche-dermatophytes | 1 | 2026-10-31 | #278 |
| feat/fiche-hypokaliemie | 1 | 2026-10-31 | #305 |
| feat/fiche-meningites-clair | 1 | 2026-10-31 | #296 |
| feat/fiche-migraine | 1 | 2026-10-31 | #256 |
| feat/fiche-nevroses-phobiques | 1 | 2026-10-31 | #262 |
| feat/fiche-intox-oxycarbonee | 1 | 2026-10-31 | #310 |
| feat/fiche-lepra | 1 | 2026-10-31 | #272 |
| feat/fiche-lupus | 1 | 2026-10-31 | #299 |
| feat/fiche-poliomyelite | 1 | 2026-10-31 | #271 |
| feat/fiche-polyarthrite-rhumatoide | 1 | 2026-10-31 | #297 |
| feat/fiche-angines | 1 | 2026-10-31 | #294 |
| feat/fiche-oreillons | 1 | 2026-10-31 | #293 |
| chore/remove-env-production | 2 | 2026-10-31 | #267 |
| feat/fiche-paralysie-cerebrale | 1 | 2026-10-31 | #266 |
| feat/fiche-insuffisance-renale-aigue | 1 | 2026-10-31 | #306 |
| feat/fiche-insuffisance-aortique | 1 | 2026-10-31 | #245 |
| feat/fiche-infections-cutanees | 1 | 2026-10-31 | #275 |
| feat/fiche-insuff-respiratoire-chronique | 1 | 2026-10-31 | #253 |
| fix/restore-env-production | 1 | 2026-10-31 | #292 |
| feat/fiche-immunisation-foeto-mat | 1 | 2026-10-31 | #307 |
| feat/fiche-insuffisance-mitrale | 1 | 2026-10-31 | #247 |
| chore/ignore-logo-public | 1 | 2026-10-31 | #291 |
| feat/programme-accordeon | 1 | 2026-11-01 | #329 |
| feat/fiche-prostatite-aigue | 1 | 2026-11-01 | #335 |
| docs/security-architecture | 1 | 2026-11-01 | #337 |
| feat/auscultation-examen | 2 | 2026-11-01 | #348 |
| feat/auscultation-torse | 1 | 2026-11-01 | #342 |
| chore/security-jimp-lazy-env | 1 | 2026-11-01 | #336 |
| feat/fiche-accidents-transfusionnels | 1 | 2026-11-01 | #320 |
| docs/handoff-next-session | 1 | 2026-11-01 | #319 |
| feat/fiche-syndrome-nephritique | 1 | 2026-11-01 | #334 |
| feat/fiche-purpura-rhumatoide | 1 | 2026-11-01 | #339 |
| feat/fiche-pancreatite-chronique | 1 | 2026-11-01 | #332 |
| feat/fiche-ulcere-gastrique | 1 | 2026-11-01 | #349 |
| feat/fiche-ulcere-duodenal | 1 | 2026-11-01 | #346 |
| feat/fiche-syndromes-nephrotiques | 1 | 2026-11-01 | #333 |
| feat/fiche-pancreatite-aigue | 1 | 2026-11-01 | #328 |
| feat/fiche-hepatites-virales | 1 | 2026-11-01 | #327 |
| feat/fiche-diabete-acidocetose | 1 | 2026-11-01 | #324 |
| feat/fiche-broncho-alveolite-nourrisson | 1 | 2026-11-01 | #345 |
| feat/fiche-insuff-surrenale-aigue | 1 | 2026-11-01 | #326 |
| feat/fiche-infections-orl-enfant | 1 | 2026-11-01 | #350 |
| feat/fiche-hypercortisolisme | 1 | 2026-11-01 | #325 |
| feat/histologie-images | 13 | 2026-11-01 | #331 |
| feat/polish-imagerie | 1 | 2026-11-01 | #343 |
| feat/home-labo-visuel | 2 | 2026-11-01 | #344 |
| feat/polish-histologie | 2 | 2026-11-01 | #341 |
| feat/imagerie-galerie | 1 | 2026-11-01 | #347 |
| feat/imagerie-cas | 8 | 2026-11-01 | #340 |
| fix/exam-mode-types | 1 | 2026-11-02 | #357 |
| feat/fiche-otites-aigues | 1 | 2026-11-02 | #352 |
| fix/ecg-fidelite-v4 | 9 | 2026-11-02 | #365 |
| fix/ecg-trace-fidelity | 11 | 2026-11-02 | #353 |
| feat/jwt-offline-verify | 1 | 2026-11-02 | #363 |
| feat/ecg-pedagogie | 11 | 2026-11-02 | #354 |
| feat/histologie-tropique | 5 | 2026-11-02 | #367 |
| feat/fiche-salpingites | 1 | 2026-11-02 | #355 |
| feat/fiche-contraception | 1 | 2026-11-02 | #356 |
| refactor/purchase-shared-extract | 1 | 2026-11-02 | #366 |
| docs/rls-audit-update | 1 | 2026-11-02 | #351 |
| fix/fiches-hemato-lot1-typos | 1 | 2026-11-04 | #382 |
| fix/auscultation-torsoview-foyers | 1 | 2026-11-04 | #384 |
| feat/nosographie-chirurgie-viscerale-lot2-v3 | 1 | 2026-11-04 | #385 |
| feat/fiches-hemato-lot2 | 1 | 2026-11-04 | #383 |
| feat/fiches-hemato-lot1 | 1 | 2026-11-04 | #381 |
| feat/fiches-chirurgie-lot11 | 11 | 2026-11-05 | #404 |
| feat/fiches-medecine-lot3 | 7 | 2026-11-05 | #386 |
| fix/auscultation-torsoview-v11 | 1 | 2026-11-05 | #387 |
| contenu/infectio-tetanos | 11 | 2026-11-06 | #172 |
| fix/catalog-public-data-sync | 6 | 2026-11-09 | #446 |
| fix/session-cookie-httponly | 8 | 2026-11-10 | #461 |
| chore/health-client-auth | 2 | 2026-11-10 | #466 |
| fix/admin-403-guard | 7 | 2026-11-10 | #464 |
| fix/auth-status-supabase | 2 | 2026-11-10 | #462 |
| fix/auth-timeout | 3 | 2026-11-10 | #465 |
| fix/csp-unsplash-img | 3 | 2026-11-10 | #463 |
| chore/ecg-usememo-dep | 1 | 2026-11-11 | #475 |
| chore/enable-workers-dev-route | 1 | 2026-11-11 | #494 |
| feat/freemium-quota | 2 | 2026-11-11 | #485 |
| fix/supabase-env-quotes | 2 | 2026-11-11 | #469 |
| chore/ci-robustesse | 4 | 2026-11-11 | #474 |
| security/audit-2026-11-10 | 1 | 2026-11-11 | #468 |
| chore/diag-erreur-500 | 1 | 2026-11-11 | #490 |
| fix/worker-500-grok-pwa-middleware | 4 | 2026-11-11 | #493 |
| chore/diag-errorhandler-config | 1 | 2026-11-11 | #491 |
| fix/quiz-answer-server | 10 | 2026-11-11 | #472 |
| chore/short-url-optimus | 1 | 2026-11-11 | #489 |
| fix/admin-guard-base64 | 1 | 2026-11-11 | #473 |
| chore/menage-racine | 5 | 2026-11-11 | #487 |
| chore/short-worker-url | 1 | 2026-11-11 | #486 |
| diag/nitro-server-route | 1 | 2026-11-11 | #492 |
| feat/freemium-explanations | 11 | 2026-11-11 | #484 |
| chore/restore-worker-name | 1 | 2026-11-11 | #488 |
| docs/update-deploy-doc-cleanup | 1 | 2026-11-12 | #497 |
| chore/fix-auth-url-and-legacy-worker | 1 | 2026-11-12 | #495 |
| fix/restore-diagnostic-disabled-routes | 9 | 2026-11-12 | #498 |
| chore/drop-legacy-worker-deploy | 1 | 2026-11-12 | #496 |
| fix/vite-auth-respect-enabled | 1 | 2026-11-25 | #531 |
| fix/auth-workers-pg | 1 | 2026-11-25 | #533 |

## A conserver (PR ouverte)

| Branche | PR | Anciennete (j) |
| --- | --- | --- |
| dependabot/npm_and_yarn/tanstack/react-table-9.3.1 | #157 | 34 |
| dependabot/npm_and_yarn/hookform/resolvers-6.0.0 | #156 | 34 |
| dependabot/npm_and_yarn/react-day-picker-10.0.2 | #158 | 34 |
| dependabot/github_actions/actions/upload-artifact-7 | #161 | 34 |
| dependabot/npm_and_yarn/eslint-plugin-react-hooks-7.1.1 | #160 | 34 |
| feat/examens-complementaires | #322 | 27 |
| feat/strategie-plateforme-reference-18294560752717970350 | #434 | 20 |
| docs/pentest-2026-11-09 | #447 | 19 |
| security/remove-env-production | #470 | 18 |
| security/hardening-audit-2026-11 | #471 | 18 |
| security/audit-2026-11-12 | #499 | 16 |
| security/fix-admin-verify-cookie | #500 | 15 |
| security/audit-2026-11-15 | #501 | 13 |
| fix/medical-corrections-2026-11-16 | #503 | 12 |
| fix/revue-medicale-correctifs | #504 | 11 |
| security/audit-2026-11-18 | #505 | 10 |
| fix/quiz-answer-order-bias | #506 | 10 |
| security/hardening-2026-11-21 | #508 | 7 |
| dependabot/npm_and_yarn/npm-minor-patch-7732bc374c | #512 | 6 |
| ci/verify-2026-11-22 | #509 | 6 |
| mobile/capacitor-base | #510 | 6 |
| security/audit-2026-11-22 | #511 | 6 |
| chore/seo-robots-sitemap-favicon | #516 | 5 |
| audit-securite-2026-11-23 | #521 | 5 |
| feat/phase0-prod-hardening | #515 | 5 |
| security/hardening-2026-11-24 | #524 | 4 |
| fix/admin-session-localstorage-secret | #530 | 3 |
| security-audit-2026-11-27 | #550 | 1 |

## A verifier

| Branche | Commits d'avance | Dernier commit | PR | Motif |
| --- | --- | --- | --- | --- |
| wip/fullscreen-essais | 2 | 2026-10-10 | - | verifier (sans PR) |
| docs/auth-audit | 1 | 2026-10-22 | #111 | verifier (fermee recemment) |
| contenu/infectio-meningites-clair | 31 | 2026-10-27 | #215 | verifier (fermee recemment) |
| contenu/infectio-grippe | 19 | 2026-10-27 | #195 | verifier (fermee recemment) |
| contenu/infectio-oreillons | 22 | 2026-10-27 | #199 | verifier (fermee recemment) |
| debug/ariari-500 | 1 | 2026-10-27 | #210 | verifier (fermee recemment) |
| contenu/infectio-varicelle-zona | 16 | 2026-10-27 | #194 | verifier (fermee recemment) |
| contenu/infectio-angines | 27 | 2026-10-27 | #208 | verifier (fermee recemment) |
| feat/histologie | 55 | 2026-11-01 | #330 | verifier (fermee recemment) |
| chore/cleanup | 1 | 2026-11-01 | #323 | verifier (fermee recemment) |
| feat/nosographie-chirurgie-viscerale | 9 | 2026-11-02 | #374 | verifier (fermee recemment) |
| feat/lot-hemato-10 | 1 | 2026-11-04 | - | verifier (sans PR) |
| feat/nosographie-chirurgie-viscerale-lot2 | 5 | 2026-11-04 | #379 | verifier (fermee recemment) |
| feat/nosographie-chirurgie-viscerale-lot2-v2 | 5 | 2026-11-04 | #380 | verifier (fermee recemment) |
| audit-fixes | 16 | 2026-11-04 | - | verifier (sans PR) |
| content/programme-chirurgie-56-60-v2 | 1 | 2026-11-05 | #394 | verifier (fermee recemment) |
| content/programme-chirurgie-56-60-v3 | 1 | 2026-11-05 | #396 | verifier (fermee recemment) |
| content/programme-chirurgie-56-60 | 11 | 2026-11-05 | #391 | verifier (fermee recemment) |
| feat/fiches-semiologie-lot6 | 12 | 2026-11-05 | #398 | verifier (fermee recemment) |
| content/programme-chirurgie-51-55 | 6 | 2026-11-05 | #393 | verifier (fermee recemment) |
| probe/deploy-run-id | 1 | 2026-11-10 | #456 | verifier (fermee recemment) |
| probe/pages-check-20261110 | 1 | 2026-11-10 | #455 | verifier (fermee recemment) |
| freebuff/e5c62a96042eb9282a4e8bd5 | 5 | 2026-11-11 | - | verifier (sans PR) |
| fix/auth-workers-postgres-driver | 2 | 2026-11-25 | #532 | verifier (fermee recemment) |

## Commande de suppression (NON executee)

```cmd
git push origin --delete chore/add-mcp-config
git push origin --delete chore/ci-robustesse
git push origin --delete chore/content-audit-scripts
git push origin --delete chore/diag-erreur-500
git push origin --delete chore/diag-errorhandler-config
git push origin --delete chore/drop-legacy-worker-deploy
git push origin --delete chore/ecg-usememo-dep
git push origin --delete chore/enable-workers-dev-route
git push origin --delete chore/fix-auth-url-and-legacy-worker
git push origin --delete chore/health-client-auth
git push origin --delete chore/ignore-logo-public
git push origin --delete chore/menage-racine
git push origin --delete chore/qa-audit-pages-publiques
git push origin --delete chore/rebuild-final-1
git push origin --delete chore/rebuild-health-real
git push origin --delete chore/remove-env-production
git push origin --delete chore/restore-worker-name
git push origin --delete chore/security-jimp-lazy-env
git push origin --delete chore/short-url-optimus
git push origin --delete chore/short-worker-url
git push origin --delete content/phase5-premium
git push origin --delete contenu/infectio-fievres-typhoides
git push origin --delete contenu/infectio-tetanos
git push origin --delete contenu/infectio-vih
git push origin --delete contenu/urgences-etat-de-choc
git push origin --delete debug/ariari-bis
git push origin --delete debug/ariari-trace
git push origin --delete debug/checkout-error
git push origin --delete debug/health-extended
git push origin --delete design/oxford-premium-polish
git push origin --delete diag/nitro-server-route
git push origin --delete docs/analytics-v2
git push origin --delete docs/b2b-institutionnel-v2
git push origin --delete docs/cgu-cgv
git push origin --delete docs/handoff-next-session
git push origin --delete docs/i18n-v2
git push origin --delete docs/imaging-module
git push origin --delete docs/landing-v2-spec
git push origin --delete docs/launch-plan-v2
git push origin --delete docs/legal-guardrails
git push origin --delete docs/medical-audit-protocol
git push origin --delete docs/positionnement-v2
git push origin --delete docs/pricing-v2
git push origin --delete docs/rls-audit-update
git push origin --delete docs/roadmap-v2
git push origin --delete docs/security-architecture
git push origin --delete docs/trust-layer-v2
git push origin --delete docs/update-deploy-doc-cleanup
git push origin --delete feat/analytics-instrumentation
git push origin --delete feat/ariari-button-ui
git push origin --delete feat/ariari-integration
git push origin --delete feat/ariari-serverfn
git push origin --delete feat/auscultation-examen
git push origin --delete feat/auscultation-torse
git push origin --delete feat/auth-decouvrir-link
git push origin --delete feat/case-immersion-phase1
git push origin --delete feat/case-immersion-phase2
git push origin --delete feat/content-quality-check
git push origin --delete feat/design-dark-oxford
git push origin --delete feat/devx-mistral-cli
git push origin --delete feat/ecg-pedagogie
git push origin --delete feat/fiche-accidents-transfusionnels
git push origin --delete feat/fiche-angines
git push origin --delete feat/fiche-angor-instable
git push origin --delete feat/fiche-asthme-aigu-grave
git push origin --delete feat/fiche-avc-hemorragique
git push origin --delete feat/fiche-bouffee-delirante
git push origin --delete feat/fiche-broncho-alveolite-nourrisson
git push origin --delete feat/fiche-candidose
git push origin --delete feat/fiche-contraception
git push origin --delete feat/fiche-crise-hta
git push origin --delete feat/fiche-cysticercose
git push origin --delete feat/fiche-delirium-tremens
git push origin --delete feat/fiche-dermatophytes
git push origin --delete feat/fiche-deshydratation
git push origin --delete feat/fiche-deshydratation-nourrisson
git push origin --delete feat/fiche-detresse-resp-nouveau-ne
git push origin --delete feat/fiche-diabete-acidocetose
git push origin --delete feat/fiche-dyspnee-laryngee-enfant
git push origin --delete feat/fiche-ectoparasitoses
git push origin --delete feat/fiche-endocardite
git push origin --delete feat/fiche-epilepsies
git push origin --delete feat/fiche-gonocoques-chlamydia
git push origin --delete feat/fiche-goutte
git push origin --delete feat/fiche-grippe
git push origin --delete feat/fiche-grossesse-hta
git push origin --delete feat/fiche-hemorragie-meningee
git push origin --delete feat/fiche-hepatites-virales
git push origin --delete feat/fiche-hta-secondaire
git push origin --delete feat/fiche-hypercortisolisme
git push origin --delete feat/fiche-hyperkaliemie
git push origin --delete feat/fiche-hypokaliemie
git push origin --delete feat/fiche-image-block
git push origin --delete feat/fiche-immunisation-foeto-mat
git push origin --delete feat/fiche-infarctus-myocarde
git push origin --delete feat/fiche-infections-cutanees
git push origin --delete feat/fiche-infections-orl-enfant
git push origin --delete feat/fiche-insuffisance-aortique
git push origin --delete feat/fiche-insuffisance-mitrale
git push origin --delete feat/fiche-insuffisance-renale-aigue
git push origin --delete feat/fiche-insuff-respiratoire-chronique
git push origin --delete feat/fiche-insuff-surrenale-aigue
git push origin --delete feat/fiche-intox-oxycarbonee
git push origin --delete feat/fiche-lepra
git push origin --delete feat/fiche-lupus
git push origin --delete feat/fiche-meningites-clair
git push origin --delete feat/fiche-migraine
git push origin --delete feat/fiche-nevroses-phobiques
git push origin --delete feat/fiche-oap
git push origin --delete feat/fiche-oreillons
git push origin --delete feat/fiche-otites-aigues
git push origin --delete feat/fiche-pancreatite-aigue
git push origin --delete feat/fiche-pancreatite-chronique
git push origin --delete feat/fiche-paralysie-cerebrale
git push origin --delete feat/fiche-pericardites
git push origin --delete feat/fiche-pneumothorax
git push origin --delete feat/fiche-poliomyelite
git push origin --delete feat/fiche-polyarthrite-rhumatoide
git push origin --delete feat/fiche-polynevrites
git push origin --delete feat/fiche-prostatite-aigue
git push origin --delete feat/fiche-psoriasis
git push origin --delete feat/fiche-purpura-rhumatoide
git push origin --delete feat/fiche-retrecissement-aortique
git push origin --delete feat/fiche-retrecissement-mitral
git push origin --delete feat/fiche-rheumatisme-articulaire-aigu
git push origin --delete feat/fiche-rougeole
git push origin --delete feat/fiche-salpingites
git push origin --delete feat/fiches-chirurgie-lot11
git push origin --delete feat/fiche-schistosomiase
git push origin --delete feat/fiche-schizophrenie
git push origin --delete feat/fiches-hemato-lot1
git push origin --delete feat/fiches-hemato-lot2
git push origin --delete feat/fiches-imagerie-pilote
git push origin --delete feat/fiches-medecine-lot3
git push origin --delete feat/fiche-syndrome-nephritique
git push origin --delete feat/fiche-syndromes-nephrotiques
git push origin --delete feat/fiche-tetanos
git push origin --delete feat/fiche-thromboses-veineuses
git push origin --delete feat/fiche-toxoplasmose
git push origin --delete feat/fiche-transfusion
git push origin --delete feat/fiche-trouble-bipolaire
git push origin --delete feat/fiche-trouble-psychique-grossesse
git push origin --delete feat/fiche-troubles-acido-basique
git push origin --delete feat/fiche-ulcere-duodenal
git push origin --delete feat/fiche-ulcere-gastrique
git push origin --delete feat/fiche-varicelle-zona
git push origin --delete feat/fiche-vih
git push origin --delete feat/first-content-viewed-surfaces
git push origin --delete feat/freemium-explanations
git push origin --delete feat/freemium-quota
git push origin --delete feat/histologie-images
git push origin --delete feat/histologie-tropique
git push origin --delete feat/home-labo-visuel
git push origin --delete feat/imagerie-cas
git push origin --delete feat/imagerie-galerie
git push origin --delete feat/imagerie-linked-pathology
git push origin --delete feat/imagerie-moteur-mvp
git push origin --delete feat/imagerie-nav
git push origin --delete feat/imagerie-quickaction
git push origin --delete feat/institutionnel-b2b
git push origin --delete feat/jwt-offline-verify
git push origin --delete feat/landing-decouvrir
git push origin --delete feat/landing-trust-links
git push origin --delete feat/light-hero-accent
git push origin --delete feat/nosographie-chirurgie-viscerale-lot2-v3
git push origin --delete feat/page-sujet
git push origin --delete feat/palettes-4-premium
git push origin --delete feat/polish-histologie
git push origin --delete feat/polish-imagerie
git push origin --delete feat/pricing-v2
git push origin --delete feat/programme-accordeon
git push origin --delete feat/qr-code-parrainage
git push origin --delete feat/trust-pages
git push origin --delete feat/valeurs-reference
git push origin --delete fix/admin-403-guard
git push origin --delete fix/admin-guard-base64
git push origin --delete fix/angine-de-poitrine
git push origin --delete fix/ariari-lazy-env
git push origin --delete fix/ariari-sdk-officiel
git push origin --delete fix/ariari-supabase-v3
git push origin --delete fix/ariari-use-supabase-auth
git push origin --delete fix/auscultation-torsoview-foyers
git push origin --delete fix/auscultation-torsoview-v11
git push origin --delete fix/auth-server-lazy-random
git push origin --delete fix/auth-status-supabase
git push origin --delete fix/auth-timeout
git push origin --delete fix/auth-workers-pg
git push origin --delete fix/catalog-public-data-sync
git push origin --delete fix/cf-worker-global-io
git push origin --delete fix/checkout-merged-env
git push origin --delete fix/checkout-paying-lock
git push origin --delete fix/checkout-rest-rpc
git push origin --delete fix/cloudflare-pg-driver
git push origin --delete fix/contact-link-import
git push origin --delete fix/coquilles-grippe-rougeole
git push origin --delete fix/csp-unsplash-img
git push origin --delete fix/db-diagnostic
git push origin --delete fix/db-ssl
git push origin --delete fix/ecg-fidelite-v4
git push origin --delete fix/ecg-trace-fidelity
git push origin --delete fix/esc-2023-endocardite-doi
git push origin --delete fix/exam-mode-types
git push origin --delete fix/fiche-candidose-relecture
git push origin --delete fix/fiche-dermatophytes-relecture
git push origin --delete fix/fiche-dyspnee-laryngee-enfant
git push origin --delete fix/fiche-immunisation-foeto-mat
git push origin --delete fix/fiches-hemato-lot1-typos
git push origin --delete fix/grippe-coquilles
git push origin --delete fix/health-ready-logic
git push origin --delete fix/hide-pay-button-pro
git push origin --delete fix/imagerie-index-route
git push origin --delete fix/lazy-better-auth
git push origin --delete fix/mobile-order-rpc
git push origin --delete fix/preview-secret-rename
git push origin --delete fix/provision-optimus-id
git push origin --delete fix/quiz-answer-server
git push origin --delete fix/ratelimit-cf-workers
git push origin --delete fix/ratelimit-final
git push origin --delete fix/remove-debug-db-route
git push origin --delete fix/restore-diagnostic-disabled-routes
git push origin --delete fix/restore-env-production
git push origin --delete fix/rougeole-amnesie-immunitaire
git push origin --delete fix/rougeole-coquilles-2
git push origin --delete fix/session-cookie-httponly
git push origin --delete fix/sources-acs-audit
git push origin --delete fix/supabase-env-quotes
git push origin --delete fix/theme-system-resolved-label
git push origin --delete fix/vite-auth-respect-enabled
git push origin --delete fix/webhook-ci-pglite
git push origin --delete fix/webhook-rest-real
git push origin --delete fix/webhook-rest-rpc
git push origin --delete fix/with-app-env-resolve-vite
git push origin --delete fix/worker-500-grok-pwa-middleware
git push origin --delete refactor/purchase-shared-extract
git push origin --delete sandbox/ariari-webhook
git push origin --delete sandbox/fix-double-middleware
git push origin --delete sandbox/freebuff-webhook
git push origin --delete security/audit-2026-11-10
git push origin --delete test/disable-better-auth
```


## Execution (2026-11-28)

| Lot | Critere | Supprimees | Verification |
| --- | --- | --- | --- |
| 1 | PR fusionnee (tableau ci-dessus), par lots de 50 | **239** | non fusionnees : 291 -> 52 |
| 2 | Fusionnees par **ascendance Git** (hors tetes de PR ouvertes) | **59** | branches distantes : 112 -> 53 |
| **Total** | | **298** | aucune erreur de push |

Intactes apres execution :

- les **28** branches de PR ouvertes (dont 6 Dependabot) ;
- les **24** branches a verifier (travail non fusionne ou PR fermee sans merge).

Verification apres chaque lot : `git branch -r --no-merged origin/main` a decru du nombre attendu, et aucun push n'a ete rejete.
