# Modèle freemium Optimus — « Le gratuit fait goûter, le premium fait passer »

> Référence produit validée le 2026-11-11. Toute évolution du périmètre
> gratuit/payant doit être cohérente avec ce document (ou le faire évoluer
> dans la même PR).

## Principe directeur

Le gratuit ne doit jamais frustrer dans la boucle quotidienne ; le premium ne
s'achète pas pour *éviter une douleur*, mais pour *gagner en profondeur et en
réalisme d'examen*. Un étudiant qui paie pour supprimer une frustration
devient un client rancunier ; un étudiant qui paie pour monter en gamme
devient un ambassadeur.

Le gratuit donne la *sensation* du produit (boucle, classement, une dose
quotidienne). Le premium donne la *matière* (volume, profondeur, mode
examen). La limite gratuite est **quotidienne et visible**, pas mensuelle.

## Répartition

| Fonctionnalité | 🆓 Gratuit | 💳 Premium |
|---|---|---|
| Volume de questions | 10 questions/jour (compteur visible), decks `free` | Illimité, 74 decks avancés |
| Correction | Juste/faux seulement — **explications verrouillées** | Explication détaillée + sources |
| Cas cliniques | Aucun en permanent ; 1 cas vitrine hebdomadaire en lecture seule | Tous les dossiers complets |
| Démarches | 1 démarche offerte par semaine, tournante | Les 43 + fiches enrichies |
| ECG / imagerie | 5 traces/jour | Banque complète + mode examen chronométré |
| Flashcards | 20 cartes/jour, réponses masquées | Illimité, réponse + explication |
| Mode examen | Aperçu de 5 questions (une fois) | Simulations complètes chronométrées |
| Classement | Gratuit (preuve sociale, acquisition) | Filtres par spécialité et par niveau |
| Historique & stats | Progression de base conservée | Statistiques avancées (points faibles, mastery, prédictions) |
| Essai 7 jours | Tout débloqué, déclenché après 3-5 jours de streak | — |

## Leviers psychologiques

1. **Routine intacte** : le gratuit garde la boucle complète (objectif
   quotidien, streak, classement). Le rituel se construit avant l'achat.
2. **Effet de dotation** : l'essai 7 jours se déclenche au pic d'engagement
   (streak 3-5 jours), pas à l'inscription. La fin d'essai est une perte à
   éviter, pas une fonctionnalité à découvrir.
3. **Aversion à la perte** : à l'expiration, rien n'est détruit (progression,
   mastery, historique conservés). Message : « ta progression t'attend ».
4. **Effet Zeigarnik** : fin de session gratuite sur une question premium
   visible mais verrouillée (« Cette question fait partie des 74 decks Pro »).
5. **Effet leurre (prix)** : module 15 000 Ar et spécialité 22 000 Ar rendent
   l'abonnement trimestriel (35 000 Ar, ~11 667 Ar/mois) évident. Les trois
   prix restent visibles ensemble.
6. **Preuve sociale** : le classement reste gratuit — canal d'acquisition.
   Les filtres fins sont premium.
7. **Équité perçue** : prix Ariary/Mobile Money pour Madagascar (−60 %
   affiché), prix international séparé (19 $ le trimestre).

## Chantiers techniques (ordre d'impact)

1. **Verrouiller les explications en gratuit** : les decks `free` gardent
   `correct` (correction immédiate) mais perdent `explanation` dans la
   projection ; `POST /api/quiz/answer` sert l'explication aux sessions
   premium/essai uniquement (`{ explanation: null, locked: true }` sinon) ;
   le client affiche « Explication disponible avec Pro » + CTA `/pro`.
2. **Quota 10 questions/jour** en gratuit (compteur dans le store, déjà
   proche de `daily.answered`).
3. **Mode examen premium** (gate + aperçu 5 questions une fois).
4. **Stats avancées premium** (points faibles par compétence, courbes).
5. **Cas vitrine hebdomadaire** en lecture seule.
6. **Flashcards démarches** : réponses masquées en gratuit (supprime la
   zone grise « réponse visible par design »).
7. **ECG/imagerie : quota 5/jour** en gratuit.

## Invariants

- Aucune donnée utilisateur n'est jamais supprimée à la descente de gamme.
- Toute limite gratuite est annoncée AVANT la friction (compteur, teaser),
  jamais après un échec.
- La correction des QCM premium reste côté serveur (pentest P2).
