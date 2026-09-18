# Optimus — checklist de revue médicale V1

La V1 ne doit pas présenter un Deck comme `fully_reviewed` sur la seule base de tests automatisés ou d’une relecture éditoriale non médicale.

## Revue d’un Deck

Pour chaque Deck, le relecteur humain qualifié vérifie au minimum :

- exactitude de chaque question, réponse attendue et explication ;
- posologies, unités, contre-indications et surveillances lorsqu’elles existent ;
- conduite à tenir en urgence et absence d’ambiguïté dangereuse ;
- cohérence des seuils, scores et calculateurs cités ;
- adéquation au contexte et à la population explicitement visés ;
- date/version des recommandations utilisées ;
- sources primaires ou recommandations professionnelles appropriées ;
- absence de formulation transformant Optimus en prescription ou avis clinique individualisé ;
- cohérence entre le Deck, les cas cliniques et les contenus associés ;
- correction ou retrait de tout élément non vérifiable.

## Preuve minimale pour `fully_reviewed`

Dans `src/content/data/editorial-registry.json`, un Deck ne peut passer à `fully_reviewed` qu’après ajout de :

```json
{
  "medical_review": {
    "status": "fully_reviewed",
    "verified_at": "YYYY-MM-DD",
    "items": ["tous-les-identifiants-de-question"],
    "reviewer_name": "Nom du relecteur",
    "reviewer_qualification": "Qualification professionnelle pertinente",
    "sources": [
      "Référence/version/date de la source 1",
      "Référence/version/date de la source 2"
    ]
  }
}
```

`npm test` refuse automatiquement un statut `fully_reviewed` qui ne couvre pas toutes les questions ou qui ne contient pas l’identité déclarée du relecteur, sa qualification et au moins une source de revue.

## Ordre conseillé pour la V1

1. Urgences
2. Pharmacologie
3. Cardiologie
4. Infectiologie
5. Médecine tropicale
6. Neurologie
7. Sémiologie
8. Dermatologie
9. Physiologie
10. Anatomie

Cet ordre est un ordre de **revue de risque éditorial**, pas une évaluation de l’importance académique des spécialités.

## Après chaque revue

1. Corriger les éléments signalés.
2. Mettre à jour la source/version/date correspondante.
3. Mettre à jour le registre éditorial.
4. Exécuter `npm run release:check`.
5. Régénérer la signature/chiffrement de tout Deck Premium modifié.
6. Archiver la preuve de validation hors du code si elle contient des données personnelles ou documents professionnels du relecteur.

## Règle de sécurité

Si une information potentiellement dangereuse est découverte, appliquer immédiatement `docs/medical-content-correction.md`. La publication d’un contenu corrigé ne doit pas attendre la fin de la revue de tous les autres Decks.
