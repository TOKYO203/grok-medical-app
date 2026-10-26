# MODULE IMAGERIE — Spécification pédagogique

> **Statut** : spec approuvée, production à démarrer quand le premier relecteur médical est identifié.
> **Référence** : AGENTS.md section "Règles spécifiques — Module Imagerie".

## Objectif pédagogique

Transformer un étudiant débutant (4ème-6ème année) en lecteur méthodique :
1. Appliquer une approche systématique (ABCDE) sur chaque examen.
2. Identifier les signes radiologiques élémentaires.
3. Relier un signe à une hypothèse diagnostique.
4. Éviter les pièges (artefacts, variantes anatomiques).

## Structure d'un module (obligatoire)

1. Titre
2. Objectifs d'apprentissage (3-5 points)
3. Rappel anatomique (schéma légendé)
4. Approche systématique (checklist ABCDE)
5. Signes élémentaires (description + image + signification)
6. Pièges et artefacts
7. Cas cliniques interactifs (2 min par module)
8. Points clés (5 puces)

## Plan des 10 premiers modules (V1)

| # | Module | Signes à couvrir (5-8) |
|---|---|---|
| 1 | Radiographie thoracique — bases | Opacité, hyperclarté, épanchement, cardiomégalie, pneumothorax, atélectasie |
| 2 | Radiographie thoracique — pathologie | Pneumonie, tuberculose, BPCO, OAP, miliaire |
| 3 | Radiographie abdominale | NHA, niveaux hydro-aériques, aérobilie, pneumopéritoine |
| 4 | Radiographie osseuse — bases | Fracture, luxation, trait, cal, ostéolyse |
| 5 | Scanner cérébral — bases | Densité, hématome, AVC ischémique/hémorragique, œdème |
| 6 | Scanner thoracique — bases | Verre dépoli, condensation, kyste, masse, adénopathie |
| 7 | Échographie abdominale | Foie, vésicule, rein, rate, ascite, lithiase |
| 8 | Échographie pelvienne | Utérus, ovaires, grossesse, kystes |
| 9 | ECG — bases (déjà partiel) | Rythme, axe, hypertrophie, ischémie |
| 10 | Radiopédiatrie | Âge osseux, malformations, corps étrangers |

## Format JSON (schéma `imaging`)

Voir `docs/IMAGING-JSON-SCHEMA.md` (à créer avec devx).

## Garde-fous médicaux

Voir AGENTS.md section IMAGING.

## Validation

- Chaque module = 1 relecteur médical (interne senior ou médecin)
- Remplissage obligatoire de `reviewedBy` + `reviewedAt`
- Statuts : draft → reviewed → published → deprecated

## Coût estimé

- 10 modules × 8 signes × 3 images = 240 images à sourcer
- 10 modules × 2 cas cliniques = 20 cas interactifs
- Relecture : 2-3 weekends (interne senior bénévole ou 20€/module)
