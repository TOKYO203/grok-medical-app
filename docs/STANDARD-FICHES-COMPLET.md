# Cahier des charges — standard des fiches médicales (pathologies)

Ce document est LE cahier des charges demandé par la consigne « contenu » d'AGENTS.md.
Toute fiche enrichie ou créée le suit intégralement. Fiche de référence en production :
`private/content/pathologies/paludisme.json` (commits 63dfe32 + 9d99bbb, 2026-11-21).

## 1. Plan standard de la fiche

| Bloc | Contenu exigé |
|---|---|
| En-tête | Intitulé exact de l'item (numéro référentiel + spécialité), objectif, statut de revue, `disclaimer`, `dosagePolicy` |
| Drapeaux rouges | `redFlags[]` machine-lisible (signe + conduite immédiate), affichés EN PREMIER |
| I. Description | Définition, classification utile, épidémiologie (données mondiales d'abord, puis focus local), mécanismes clés (3-5 points max) |
| II. Signes cliniques | Forme typique d'abord, formes compliquées (critères cités nommément), formes selon terrain |
| III. Diagnostic | Examens hiérarchisés (1re intention d'abord), critères diagnostiques cités, démarche décisionnelle, différentiels |
| IV. Traitement | Mesures de soutien, traitement de référence internationale, encadrés « adaptation locale » (molécule/voie/calandrier, JAMAIS de dose chiffrée), surveillance, interdits (« À NE PAS FAIRE » en callout urgence) |
| V. Prévention | Individuelle + collective universelle, encadré focus local si pertinent |
| VI. Conclusion | « À retenir » en 5 points + mémo d'examen (callout `memo`) |
| En fin de fiche | Flashcards (>= 10, une info par carte), mindmap (standard qualité), sources racine (DOI ou URL + `verifiedAt`) |

## 2. Portée internationale (règle structurante)

- Le produit s'adresse à des étudiants du monde entier : le cœur clinique repose sur les recommandations internationales (OMS, guidelines de référence).
- Tout protocole propre à un pays vit EXCLUSIVEMENT dans `localAdaptations[]` (racine) et/ou un callout étiqueté « Adaptation locale — Pays », avec sa source datée.
- Un protocole national n'est jamais présenté comme norme universelle, et l'inverse non plus.

## 3. Articulation du JSON (schemaVersion 1 — ne pas incrémenter sans décision)

```jsonc
{
  "schemaVersion": 1, "kind": "pathology", "slug": "...", "title": "...", "subtitle": "...",
  "objective": "ce que l'étudiant doit savoir faire", "language": "fr",
  "updatedAt": "YYYY-MM-DD", "reviewStatus": "pending-medical-review",
  "curriculum": { "collection": "...", "chapterNumber": n, "specialty": "...", "referential": { "programme": "madagascar-2025", ... } },
  "related": { "deckIds": [], "caseIds": [] },
  "editorial": { "reviewStatus": "pending-medical-review", "reviewedBy": null, "verificationNotes": [/* datées */], "qcChecklist": [/* >= 1 */] },

  "disclaimer": "Support pédagogique. Ne remplace ni un avis médical ni les protocoles locaux.",
  "dosagePolicy": "Molécules citées sans posologies : se référer aux protocoles locaux et au contexte du patient.",

  "redFlags": [ { "sign": "...", "action": "conduite immédiate" } ],
  "localAdaptations": [ { "country": "...", "programme": "...", "note": "...", "sourceId": "SRC-..." } ],

  "sections": [ { "id": "...", "title": "...", "blocks": [ { "type": "paragraph | list | callout | table", ... } ] } ],
  "flashcards": [ { "id": "fc-..", "front": "...", "back": "...", "tags": [] } ],
  "mindmap": { "root": { "id": "root", "label": "...", "detail": "..." }, "branches": [ { "id": "...", "label": "...", "detail": "...", "children": [ { "id": "...", "label": "...", "leaves": [ { "id": "...", "label": "..." } ] } ] } ] },
  "mnemonics": [],
  "sources": [ { "id": "SRC-...", "title": "...", "citation": "...", "organization": "...", "year": 2026, "url": "https://...", "doi": "10.... (optionnel)", "verifiedAt": "YYYY-MM-DD", "usedFor": ["..."], "note": "..." } ],
  "specialty": "..."
}
```

## 4. Les 9 gates qualité

1. Une puce = un fait, et un seul : une liste-item qui contient deux informations est scindée.
2. Chaque affirmation clinique rattachée à une source racine datée (guide international OMS ou autre ; protocole national pour les encadrés).
3. Posologies JAMAIS chiffrées (mg, µg, UI, mg/kg interdits) : molécules + voies, renvoi au protocole national.
4. Numérotation des sections générée au rendu, jamais stockée en dur.
5. Sources UNIQUEMENT au niveau racine.
6. Chaque « mot discriminant » provient du référentiel ou de la recommandation citée, jamais inventé.
7. Mindmap conforme : branches = actions d'examen (diagnostiquer, évaluer la gravité, traiter, prévenir...), branche sécurité obligatoire, feuilles courtes.
8. `reviewStatus: "pending-medical-review"` tant qu'aucun médecin n'a signé (réed/fully_reviewed exigent `reviewedBy` + preuve).
9. Cœur universel + `localAdaptations[]` : un protocole national n'apparaît jamais dans le corps principal.

## 5. Checklist de sortie de session (par fiche)

- [ ] Fichier parse en JSON valide ; toutes les chaînes en Unicode NFC.
- [ ] Identifiants uniques (sections, sources, flashcards, mindmap) ; flashcards >= 10.
- [ ] Au moins un callout `urgence` ; tons limités à la palette (`urgence/prudence/reflexe/retenir/memo`).
- [ ] URL toutes en HTTPS ; DOI valides ; `verifiedAt` daté sur chaque source.
- [ ] `npm test` et `npm run content:check` au vert.
- [ ] 1 commit = 1 fiche sur `main` ; ligne ajoutée dans `docs/DECISIONS.md`.
- [ ] Fiche marquée `pending-medical-review` (validation humaine = étape séparée, jamais simulée).
