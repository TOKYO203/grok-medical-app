# RAPPORT DE NETTOYAGE — branches mortes & plan code mort

**Généré le** : 2026-11-01 · **Méthode** : audit automatisé — historique complet de `main` (12 pages de commits, 1101 commits) croisé avec les 300 PR du dépôt. Une branche est classée « supprimable » si et seulement si sa PR est fermée ET que son numéro figure dans un message de commit squash-fusionné de `main` (`feat(...): ... (#N)`).

---

## ÉTAPE 5 — Branches git mortes

### Bilan

| Catégorie | Nombre | Action |
|---|---|---|
| Supprimables (PR squash-fusionnée vérifiée dans `main`) | **165** | À supprimer |
| PR ouverte (travail en cours, dont #321/#322) | 17 | **Garder** |
| PR fermée SANS trace de fusion dans `main` (commits uniques) | 20 | **Garder** (vérification manuelle conseillée) |
| Aucune PR rattachée | 2 | **Garder** (vérification manuelle) |
| `main` | 1 | Garde |
| **Total** | 205 | |

### ✅ Supprimables (165 branches) — script prêt à l'emploi

Exécuter en local (chaque suppression = 1 vérification : `git fetch --prune` après la boucle) :

```bash
for b in chore/add-mcp-config chore/content-audit-scripts chore/ignore-logo-public chore/qa-audit-pages-publiques chore/rebuild-db-final chore/rebuild-final-1 chore/rebuild-health-real chore/rebuild-v4 chore/remove-env-production chore/retry-db-checkout content/phase5-premium contenu/infectio-fievres-typhoides contenu/urgences-etat-de-choc debug/ariari-bis debug/ariari-trace debug/checkout-error debug/health-extended design/oxford-premium-polish docs/analytics-v2 docs/b2b-institutionnel-v2 docs/cgu-cgv docs/handoff-next-session docs/i18n-v2 docs/imaging-module docs/landing-v2-spec docs/launch-plan-v2 docs/legal-guardrails docs/medical-audit-protocol docs/positionnement-v2 docs/pricing-v2 docs/roadmap-v2 docs/trust-layer-v2 feat/analytics-instrumentation feat/ariari-button-ui feat/ariari-integration feat/ariari-serverfn feat/auth-decouvrir-link feat/case-immersion-phase1 feat/case-immersion-phase2 feat/content-quality-check feat/design-dark-oxford feat/devx-mistral-cli feat/fiche-accidents-transfusionnels feat/fiche-angines feat/fiche-angor-instable feat/fiche-asthme-aigu-grave feat/fiche-avc-hemorragique feat/fiche-bouffee-delirante feat/fiche-candidose feat/fiche-crise-hta feat/fiche-cysticercose feat/fiche-delirium-tremens feat/fiche-dermatophytes feat/fiche-deshydratation feat/fiche-deshydratation-nourrisson feat/fiche-detresse-resp-nouveau-ne feat/fiche-dyspnee-laryngee-enfant feat/fiche-ectoparasitoses feat/fiche-endocardite feat/fiche-epilepsies feat/fiche-gonocoques-chlamydia feat/fiche-goutte feat/fiche-grippe feat/fiche-grossesse-hta feat/fiche-hemorragie-meningee feat/fiche-hta-secondaire feat/fiche-hyperkaliemie feat/fiche-hypokaliemie feat/fiche-image-block feat/fiche-immunisation-foeto-mat feat/fiche-infarctus-myocarde feat/fiche-infections-cutanees feat/fiche-insuff-respiratoire-chronique feat/fiche-insuffisance-aortique feat/fiche-insuffisance-mitrale feat/fiche-insuffisance-renale-aigue feat/fiche-intox-oxycarbonee feat/fiche-lepra feat/fiche-lupus feat/fiche-meningites-clair feat/fiche-migraine feat/fiche-nevroses-phobiques feat/fiche-oap feat/fiche-oreillons feat/fiche-paralysie-cerebrale feat/fiche-pericardites feat/fiche-pneumothorax feat/fiche-poliomyelite feat/fiche-polyarthrite-rhumatoide feat/fiche-polynevrites feat/fiche-psoriasis feat/fiche-retrecissement-aortique feat/fiche-retrecissement-mitral feat/fiche-rheumatisme-articulaire-aigu feat/fiche-rougeole feat/fiche-schistosomiase feat/fiche-schizophrenie feat/fiche-tetanos feat/fiche-thromboses-veineuses feat/fiche-toxoplasmose feat/fiche-transfusion feat/fiche-trouble-bipolaire feat/fiche-trouble-psychique-grossesse feat/fiche-troubles-acido-basique feat/fiche-varicelle-zona feat/fiche-vih feat/fiches-imagerie-pilote feat/first-content-viewed-surfaces feat/imagerie-linked-pathology feat/imagerie-moteur-mvp feat/imagerie-nav feat/imagerie-quickaction feat/institutionnel-b2b feat/landing-decouvrir feat/landing-trust-links feat/light-hero-accent feat/palettes-4-premium feat/pricing-v2 feat/qr-code-parrainage feat/trust-pages feat/valeurs-reference fix/angine-de-poitrine fix/ariari-lazy-env fix/ariari-sdk-officiel fix/ariari-supabase-v3 fix/auth-server-lazy-random fix/cf-worker-global-io fix/checkout-merged-env fix/checkout-paying-lock fix/checkout-rest-rpc fix/cloudflare-pg-driver fix/contact-link-import fix/coquilles-grippe-rougeole fix/db-diagnostic fix/db-ssl fix/esc-2023-endocardite-doi fix/fiche-candidose-relecture fix/fiche-dermatophytes-relecture fix/fiche-dyspnee-laryngee-enfant fix/fiche-immunisation-foeto-mat fix/grippe-coquilles fix/health-ready-logic fix/hide-pay-button-pro fix/imagerie-index-route fix/lazy-better-auth fix/mobile-order-rpc fix/preview-secret-rename fix/provision-optimus-id fix/ratelimit-cf-workers fix/ratelimit-final fix/remove-debug-db-route fix/restore-env-production fix/rougeole-amnesie-immunitaire fix/rougeole-coquilles-2 fix/sources-acs-audit fix/theme-system-resolved-label fix/webhook-ci-pglite fix/webhook-rest-real fix/webhook-rest-rpc fix/with-app-env-resolve-vite refactor/profile-header sandbox/ariari-webhook sandbox/fix-double-middleware sandbox/freebuff-webhook test/disable-better-auth; do
  git push origin --delete "$b"
done
git fetch --prune
```

### 🔒 À GARDER — PR ouvertes (17)

content/phase13-demarches-lot3 · contenu/infectio-angines · contenu/infectio-grippe · contenu/infectio-meningites-clair · contenu/infectio-oreillons · contenu/infectio-rougeole · contenu/infectio-varicelle-zona · debug/ariari-500 · dependabot/github_actions/actions/upload-artifact-7 · dependabot/npm_and_yarn/eslint-plugin-react-hooks-7.1.1 · dependabot/npm_and_yarn/hookform/resolvers-6.0.0 · dependabot/npm_and_yarn/npm-minor-patch-5f1c75d63f · dependabot/npm_and_yarn/react-day-picker-10.0.2 · dependabot/npm_and_yarn/tanstack/react-table-9.3.1 · docs/auth-audit · feat/examens-complementaires · feat/histologie

### ⚠️ À GARDER — PR fermée sans fusion détectée dans `main` (20)

À vérifier manuellement avant toute suppression (le squash a pu échapper à la détection, ou la PR a été fermée sans fusion — contenu potentiellement unique) :

- `chore/ci-canary` (PR #137)
- `content/phase6-premium` (PR #155)
- `content/phase7-premium` (PR #163)
- `content/phase8-premium` (PR #164)
- `content/phase9-premium` (PR #170)
- `content/phase10-premium` (PR #176)
- `content/phase11-premium` (PR #178)
- `content/phase12-lot9` (PR #184)
- `content/phase12-lot10` (PR #191)
- `content/phase12-lot11` (PR #197)
- `content/phase13-demarches-lot1` (PR #207)
- `content/phase13-demarches-lot2` (PR #214)
- `content/phase13-sources` (PR #206)
- `contenu/infectio-tetanos` (PR #172)
- `contenu/infectio-vih` (PR #166)
- `feat/case-immersion-phase3` (PR #129)
- `feat/dark-palette-harmonization` (PR #132)
- `feat/page-sujet` (PR #70)
- `fix/ariari-use-supabase-auth` (PR #213)
- `fix/ci-green-contrast` (PR #314)

### ⚠️ À GARDER — aucune PR (2)

- `fix/better-auth-lazy`
- `wip/fullscreen-essais`

---

## ÉTAPES 1 à 4 — Code mort (à exécuter en local, 1 suppression = 1 test)

### Étape 1 — Dépendances inutilisées

```bash
npx depcheck
# pour chaque package listé :
grep -rn "from ['\"]PACKAGE" src/ server/ scripts/
# si 0 résultat → npm uninstall PACKAGE → npm run typecheck && npm run build
```

### Étape 2 — Exports TS morts

```bash
npx ts-prune --error | head -50
# 1 fichier à la fois ; vérifier usage dynamique (import.meta.glob) AVANT suppression
```

### Étape 3 — Fichiers orphelins

Boucle grep sur fichiers .ts/.tsx jamais importés.
**NE PAS supprimer** : `src/routes/*.tsx` (auto-découverts par TanStack Router), `*.test.ts`, JSON chargés par `import.meta.glob`, `scripts/`.

### Étape 4 — CSS mort

Chercher les classes `.foo` de `src/styles.css` jamais utilisées dans tsx/ts. **Attention** aux classes construites dynamiquement (`cn()`, templates strings) — la 1ʳᵉ suppression de la PR #318 (palettes) a ajouté `data-accent` : ne pas casser les variables `--app-*`.

---

## RÈGLE D'OR (rappel handoff)

1 suppression = 1 vérification = 1 test. JAMAIS de suppression en masse de code.
Pour les branches ci-dessus, la vérification a déjà été faite par audit (PR fusionnée ⟹ contenu dans `main`).
