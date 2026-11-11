# Chantiers de sécurité — état des correctifs

> Journal des correctifs issus du pentest [`docs/PENTEST-2026-11-09.md`](./PENTEST-2026-11-09.md).
> **Une ligne par chantier, tenue à jour à chaque livraison** : commit, preuve
> et ce qui reste ouvert.
>
> Dernière mise à jour : 2026-11-11.

## Principe commun

Les catalogues cliniques (`public/data/*.json`) et les fiches
(`public/content/**`) sont des actifs **statiques** : le CDN les sert **avant
tout code applicatif**, donc sans jeton. Le verrouillage côté React ne protège
rien. La règle retenue est donc :

1. `src/content/data/*.json` reste la **source de vérité intacte** (tests
   éditoriaux et validateur continuent de lire le contenu complet) ;
2. `public/data/*.json` devient un **index dérivé** : métadonnées + teaser +
   compteur (`questionCount`, `stepCount`), jamais le contenu fermé ;
3. le contenu vit dans `private/content/<famille>/`, **hors du dossier publié**,
   et ne sort que par `/content/<famille>/**` sous jeton de contenu
   (`src/server/content-guard.ts`, HS256, 24 h, fail closed sans secret) ;
4. une **famille groupée** (`_catalog.json`) rend tout un lot en une requête,
   plutôt qu'un aller-retour par fiche ;
5. les écrans qui consomment ces données ont un état explicite « contenu
   indisponible » quand l'hydratation échoue — jamais un compteur faux.

## Chantiers livrés

| # | Chantier | Commit | Preuve |
|---|---|---|---|
| RBAC | Lisibilité du RBAC de secours + fiabilité de la suite de sécurité | `acc6f6e` | suite sécurité 12/12 |
| P0 §1 | **Decks Premium** : 775 questions / 74 decks sorties de `public/data/decks.json` ; 42 questions des 5 decks gratuits conservées ; hydratation sous jeton ; `questionCount` distinct du contenu | `60948ce` | 79 decks, 0 question premium publiée ; `/content/decks/_catalog.json` → 401 sans jeton / 200 avec ; `/data/decks.json` sans contenu premium ; `public-content-leak` (6 tests) |
| §14 | **Cas cliniques fermés** : 38 dossiers (259 étapes) sortis du catalogue public, teaser conservé (titre, résumé, patient, spécialité, `stepCount`) ; 8 cas gratuits intacts ; `caseStepCount()` + état « contenu indisponible » | `6e5f15f` | `public/data/cases.json` 312 Kio → 92 Kio ; 0 étape publiée pour un cas fermé ; `/content/cases/_catalog.json` 43 → 401 / 200 ; 38 dossiers / 259 étapes servis |
| §15 | **Démarches** : corrigés et synthèses des 43 QCM sortis de `public/data/diagnostics.json` (aperçu « première décision offerte » conservé) ; 43 fiches enrichies déplacées de `public/content/demarches/` vers `private/content/demarches/` ; fiche/flashcards/carte mentale servies sous jeton | `43e5193` | `public/data/diagnostics.json` 245 Kio → 168 Kio ; 0 `correct` publié au-delà de l'étape 1 ; `/content/demarche-answers/_catalog.json` et `/content/demarches/<file>` → 401 sans jeton / 200 avec |

## Chantiers ouverts

| # | Constat | Pourquoi ce n'est pas fait | Piste |
|---|---|---|---|
| §2 | Le verrou d'accès Premium est local (`localStorage`) | Choix produit local-first assumé ; acceptable **tant que** le contenu à forte valeur n'est pas dans le bundle — c'est désormais vrai pour decks, cas et démarches | documenter la limite dans la FAQ produit |
| §4 | Jeton de contenu en `localStorage`, cookie non `HttpOnly` | contrainte SSR ; réduit le risque XSS mais ne le supprime pas | cookie `HttpOnly` posé par le serveur à l'échange de licence, TTL 2 h |
| §5 | `/admin*` répond 200 en anonyme | aucune donnée ne sort (mutations protégées côté serveur) ; risque = cartographie de l'interface | 403 serveur sur `/admin*` sans jeton admin |
| §6 | `/api/health/checkout` décrit la configuration | par design (sonde d'exploitation) | réserver la route à un jeton d'exploitation |
| §15.2 | `correct`/`explanation` envoyés avant la réponse | le modèle actuel corrige côté client, par étape | validation serveur par étape (fin du corrigé dans le payload) |
| — | `npm run content:check` : 12 posologies non sourcées sur 11 fiches | **bloqué volontairement** : décision éditoriale du propriétaire, AGENTS.md interdit de générer/modifier du contenu médical ou une posologie non citée | traitement éditorial fiche par fiche |
| — | `npm run secret:scan` (gitleaks) | outil absent de l'environnement de dev | couvert par le job CI `secret-scan` |

## Garde-fous qui empêchent la régression

| Test | Ce qu'il interdit |
|---|---|
| `scripts/public-content-leak.test.mjs` | contenu fermé dans `public/data/**` (decks, cas, démarches) ; actif protégé incomplet ; index publié divergent du split ; dossier publié réapparu |
| `scripts/public-catalog-sync.test.mjs` | resynchronisation qui republierait du contenu fermé ; copie publique périmée |
| `scripts/bundle-content.test.mjs` | import d'une fiche de contenu dans le graphe client ; fiche dans un chunk JS ; fiche dans le dossier statique |
| `scripts/content-assets-cache.test.mjs` | cache CDN public sur `/content/**` ; `_redirects` qui contournerait le garde |
| `scripts/demarches-catalog-integrity.test.mjs` | manifeste ↔ actifs protégés désynchronisés |
| `scripts/run-security-suite.mjs` | suite de sécurité complète (verdict au code de sortie) |

## Ajouter un chantier

1. corriger selon le principe commun ci-dessus (split + `private/content/`) ;
2. ajouter la famille dans `src/lib/content/protected-assets.server.ts` et la
   route `src/routes/content.$type.$file.ts` ;
3. couvrir la non-régression dans `public-content-leak.test.mjs` ;
4. renseigner la ligne dans le tableau **Chantiers livrés**, avec le commit et
   la preuve mesurée (octets, statuts HTTP, compte d'items).
