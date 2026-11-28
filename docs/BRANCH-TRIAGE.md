# Tri des branches non fusionnees hors PR ouvertes

Genere le 2026-11-28 13:08 - aucune suppression.

Les 22 branches de PR ouvertes sont exclues : elles se traitent par la revue de leur PR.

## Criteres

| Verdict | Signification |
| --- | --- |
| SUPPRIMER - ajoute .env | fichier d'environnement versionne : secret potentiel, jamais fusionnable |
| SUPPRIMER - legacy seul | n'ecrit que dans src/content/data/, chemin interdit depuis la consigne contenu |
| EXAMINER - contenu prive | fiches medicales non fusionnees : a confronter a main avant recuperation |
| EXAMINER - code | code applicatif non fusionne |

## Inventaire

| Branche | Commits | Fichiers | Legacy | Fiches privees | Dernier commit | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| feat/histologie | 55 | 34 | 12 | 0 | 2026-11-01 | SUPPRIMER - uniquement de l'ecriture legacy src/content/data |
| contenu/infectio-meningites-clair | 31 | 14 | 3 | 9 | 2026-10-27 | EXAMINER - contenu prive a recuperer, ecriture legacy (src/content/data) a ne pas reporter |
| contenu/infectio-angines | 27 | 13 | 3 | 8 | 2026-10-27 | EXAMINER - contenu prive a recuperer, ecriture legacy (src/content/data) a ne pas reporter |
| contenu/infectio-oreillons | 22 | 12 | 3 | 7 | 2026-10-27 | EXAMINER - contenu prive a recuperer, ecriture legacy (src/content/data) a ne pas reporter |
| contenu/infectio-grippe | 19 | 11 | 3 | 6 | 2026-10-27 | EXAMINER - contenu prive a recuperer, ecriture legacy (src/content/data) a ne pas reporter |
| contenu/infectio-varicelle-zona | 16 | 10 | 3 | 5 | 2026-10-27 | EXAMINER - contenu prive a recuperer, ecriture legacy (src/content/data) a ne pas reporter |
| audit-fixes | 16 | 40 | 2 | 0 | 2026-11-04 | SUPPRIMER - ajoute .env.production |
| feat/fiches-semiologie-lot6 | 12 | 10 | 10 | 0 | 2026-11-05 | SUPPRIMER - uniquement de l'ecriture legacy src/content/data |
| content/programme-chirurgie-56-60 | 11 | 6 | 1 | 5 | 2026-11-05 | EXAMINER - contenu prive a recuperer, ecriture legacy (src/content/data) a ne pas reporter |
| feat/nosographie-chirurgie-viscerale | 9 | 6 | 1 | 5 | 2026-11-02 | EXAMINER - contenu prive a recuperer, ecriture legacy (src/content/data) a ne pas reporter |
| content/programme-chirurgie-51-55 | 6 | 6 | 1 | 5 | 2026-11-05 | EXAMINER - contenu prive a recuperer, ecriture legacy (src/content/data) a ne pas reporter |
| freebuff/e5c62a96042eb9282a4e8bd5 | 5 | 232 | 0 | 198 | 2026-11-11 | EXAMINER - contenu medical non fusionne (198 fiches) |
| feat/nosographie-chirurgie-viscerale-lot2-v2 | 5 | 5 | 1 | 4 | 2026-11-04 | EXAMINER - contenu prive a recuperer, ecriture legacy (src/content/data) a ne pas reporter |
| feat/nosographie-chirurgie-viscerale-lot2 | 5 | 5 | 1 | 4 | 2026-11-04 | EXAMINER - contenu prive a recuperer, ecriture legacy (src/content/data) a ne pas reporter |
| fix/auth-workers-postgres-driver | 2 | 5 | 0 | 0 | 2026-11-25 | EXAMINER - code applicatif non fusionne |
| wip/fullscreen-essais | 2 | 1 | 0 | 0 | 2026-10-10 | EXAMINER - code applicatif non fusionne |
| content/programme-chirurgie-56-60-v2 | 1 | 6 | 1 | 5 | 2026-11-05 | EXAMINER - contenu prive a recuperer, ecriture legacy (src/content/data) a ne pas reporter |
| chore/cleanup | 1 | 1 | 0 | 0 | 2026-11-01 | EXAMINER - documentation / divers |
| dependabot/npm_and_yarn/eslint-plugin-react-hooks-7.1.1 | 1 | 2 | 0 | 0 | 2026-11-28 | EXAMINER - documentation / divers |
| probe/pages-check-20261110 | 1 | 1 | 0 | 0 | 2026-11-10 | EXAMINER - documentation / divers |
| probe/deploy-run-id | 1 | 1 | 0 | 0 | 2026-11-10 | EXAMINER - documentation / divers |
| dependabot/npm_and_yarn/npm-minor-patch-92d873e9e4 | 1 | 2 | 0 | 0 | 2026-11-28 | EXAMINER - documentation / divers |
| docs/auth-audit | 1 | 1 | 0 | 0 | 2026-10-22 | EXAMINER - documentation / divers |
| feat/lot-hemato-10 | 1 | 5 | 5 | 0 | 2026-11-04 | SUPPRIMER - uniquement de l'ecriture legacy src/content/data |
| content/programme-chirurgie-56-60-v3 | 1 | 3 | 1 | 2 | 2026-11-05 | EXAMINER - contenu prive a recuperer, ecriture legacy (src/content/data) a ne pas reporter |
| debug/ariari-500 | 1 | 1 | 0 | 0 | 2026-10-27 | EXAMINER - code applicatif non fusionne |


## Conclusion (verifiee piece par piece)

### 8 branches de contenu : supprimables

`contenu/infectio-*` (5) et `content/programme-chirurgie-*` (2) + `feat/nosographie-chirurgie-viscerale` :

- **aucune fiche ajoutee n'est absente de `main`** (verifie fiche par fiche) ;
- la fiche temoin `angines.json` est **plus recente dans `main`** (2026-10-31) que dans la branche (2026-10-27), avec 290 lignes ajoutees cote `main` ;
- elles ecrivent toutes dans `src/content/data/`, chemin interdit depuis la consigne contenu.

Fusionner reviendrait a faire regresser des fiches deja enrichies. Suppression sans perte.

### `feat/fiches-semiologie-lot6` : supprimable

Ses 9 fichiers sont des doublons de `private/content/pathologies/` (les six verifies existent tous dans `main`), ecrits a l'ancien emplacement.

### `feat/histologie` : 8 SVG uniques, faible valeur

27 fichiers ajoutes, **8 absents de `main`** : uniquement des placeholders `public/histologie/*.svg` (`hodgkin`, `lepra`, `paludisme`…). Le module histologie est deja livre dans `main` (3 visuels). A recuperer si de nouvelles lames sont prevues, sinon supprimable.

### `audit-fixes` : ne pas fusionner

Ajoute `.env.production` — un fichier d'environnement versionne, donc un secret potentiel. Contient aussi 8 fichiers uniques (`migrations/TODO-advance-premium-rpc.md`, composants `profil/*`, `programmes/international-amee.json`). A examiner uniquement pour ces fichiers, jamais en fusion de branche.

### Reste

Les **22 PR ouvertes** ne sont pas traitees ici : elles se jugent par la revue de leur PR, pas par leur branche.

## Execution (2026-11-28)

Suppression par preuve : une branche n'est supprimee que si **aucun fichier ajoute** n'est absent de `main` (`git diff --name-status` + `git cat-file -e` fichier par fichier).

| Lot | Branches | Preuve |
| --- | --- | --- |
| 1 | 10 (8 lots de contenu + semiologie-lot6 + `audit-fixes`) | 0 fichier unique ; `audit-fixes` ajoutait `.env.production` |
| 2 | 8 (variantes `-v2`/`-v3`, sondes `probe/*`, `wip/*`, `debug/*`) | 0 fichier unique |
| 3 | 1 (`feat/lot-hemato-10`) | 5 fiches legacy, toutes deja presentes en `private/` |

**19 branches supprimees**, aucune perte de fichier unique — sauf les doublons legacy volontairement ecartes.

## Ce qui reste hors PR (6 branches)

| Branche | Contenu unique | Recommandation |
| --- | --- | --- |
| `feat/nosographie-chirurgie-viscerale-lot2` et `-v2` | 4 fiches **absentes de `main`** : `cancer-estomac`, `cancers-colon-rectum`… | **recuperer** les fiches, puis supprimer les deux branches |
| `feat/histologie` | 8 SVG `placeholder-*` | recuperer si de nouvelles lames sont prevues, sinon supprimer |
| `freebuff/e5c62a96042eb9282a4e8bd5` | 162 fichiers (cas cliniques, docs) | **a inspecter** : provenance inconnue, volume important |
| `chore/cleanup` | 1 doc (`docs/CLEANUP-REPORT.md`) | sans interet probable |
| `docs/auth-audit` | 1 doc (`docs/AUTH-AUDIT.md`) | a recuperer si l'audit n'est pas dans `main` |
