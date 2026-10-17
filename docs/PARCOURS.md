
---

## 11. Les Plans (offre produit)

Le parcours n'est pas unique. Il est généré à partir d'un **Plan** choisi à l'inscription.

| Plan | Cible | Durée | Contenu | Modèle |
|---|---|---|---|---|
| **Concours National (Madagascar)** | Étudiant préparant le concours d'internat | 12-16 sem. | Programme officiel, 240 items, 4 examens blancs | Freemium |
| **Accéléré 30 jours** | Candidat pressé / rattrapage | 30 jours | 60 items à fort rendement, 4 examens blancs, fiches express | Premium+ |
| **EDN / International** | Francophone visant la France / le Québec | 6-9 mois | Programme EDN, items transversaux, QCM calibrés | Premium (€) |
| **Libre** | Révision par spécialité | Illimité | Choix libre dans les 240 items, suivi par spécialité | Freemium |

**Règles de flexibilité** : un utilisateur peut changer de plan à tout moment. Le parcours est recalculé, la progression conservée.

**Pricing (à valider avec le propriétaire)** :
- Gratuit : 1 item offert (aperçu), fiche gratuite, pas de flashcards ni mindmap.
- Premium Madagascar : vendu en Ariary via Mobile Money (Orange Money, MVola, Airtel Money).
- Premium International : vendu en € via Stripe / PayPal.
- L'essai de 7 jours reste disponible sur toutes les offres.

**MVP (J14)** : seul le plan "Concours National" est actif. Les 3 autres sont **affichés** (teasing, "Bientôt") pour valider la demande avant de développer.

---

## 12. Internationalisation du parcours

Le contenu médical est le même (les maladies ne changent pas). Ce qui change :
- **Le programme** : l'EDN français n'a pas la même liste d'items que le concours malgache. Le plan international exige une **deuxième liste** (`programmes/edn-2026.json` par exemple).
- **Les examens blancs** : calibrés sur le format local (durée, nombre de questions, style).
- **La langue par défaut** : fr pour Madagascar et France, en pour le Québec / Afrique anglophone.

**Conséquence technique** : le planner ne doit PAS être codé en dur sur le programme malgache. Il doit lire un `programmeId` (`madagascar-2025`, `edn-2026`, `quebec-2026`) et charger la liste correspondante.

**Ce n'est pas pour aujourd'hui.** Mais le code doit être écrit **dès maintenant** avec cette abstraction, sinon on refait tout dans 6 mois.

---

*Note ajoutée le 2026-10-17.*
