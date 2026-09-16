# Optimus — procédure de correction urgente d’un contenu médical

Cette procédure décrit le traitement opérationnel d’un signalement de contenu. Elle ne remplace pas la revue médicale humaine des Decks V1.

## 1. Déclenchement

Un signalement est prioritaire lorsqu’il concerne une information susceptible d’entraîner une conduite clinique inappropriée, une dose, une contre-indication, une urgence, une interprétation diagnostique ou une recommandation devenue obsolète.

Conserver dans le ticket de correction :

- identifiant du Deck / question / cas ;
- version du contenu ;
- description factuelle du problème ;
- source ou recommandation de référence proposée ;
- date du signalement ;
- statut de revue.

Ne pas copier de données patient dans le ticket.

## 2. Triage

### Critique

Information potentiellement dangereuse si elle est appliquée en pratique. Action : masquer ou désactiver le contenu concerné avant même la correction si nécessaire, puis demander une revue médicale qualifiée en priorité.

### Majeur

Erreur factuelle ou recommandation obsolète qui compromet l’apprentissage sans danger immédiat identifié. Action : corriger avant la prochaine publication du Deck.

### Mineur

Formulation, ambiguïté, source secondaire, typographie ou amélioration pédagogique sans impact sur le fond médical. Action : intégrer au cycle éditorial normal.

## 3. Correction

1. Reproduire et localiser précisément le contenu signalé.
2. Comparer avec une source primaire ou recommandation professionnelle appropriée et datée.
3. Faire valider le changement médical par un relecteur humain qualifié.
4. Modifier le contenu et incrémenter sa version lorsque le format le prévoit.
5. Mettre à jour les sources et la date de revue.
6. Relancer les tests d’intégrité éditoriale et `npm run release:check`.
7. Régénérer la signature/chiffrement du Deck Premium concerné ; ne jamais réutiliser un artefact signé correspondant à l’ancienne version.

## 4. Publication / retrait

Pour un contenu critique déjà distribué :

- publier la version corrigée ou retirer temporairement le contenu ;
- révoquer l’artefact ou la licence si le mécanisme de livraison l’exige ;
- conserver une trace d’audit du retrait, de la correction et de la validation ;
- afficher une information de mise à jour dans l’application lorsque l’utilisateur doit remplacer une copie locale.

## 5. Clôture

Un ticket médical n’est clos qu’après :

- validation humaine qualifiée documentée ;
- version corrigée identifiable ;
- sources actualisées ;
- contrôles automatisés verts ;
- vérification que l’ancienne version critique n’est plus proposée au téléchargement.

La présence de tests automatisés ne constitue jamais, à elle seule, une validation médicale.
