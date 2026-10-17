# Parcours utilisateur & Rétention — Spécification

## 1. Les 3 profils utilisateurs
- **Le candidat** (60%) : Concours National, 2-4h/jour.
- **Le révisant** (30%) : Consolidation par spécialité, 30 min/jour.
- **Le curieux** (10%) : Découverte, 5-10 min.

## 2. Onboarding (3 écrans)
1. Objectif (Concours, Spécialité, Découverte)
2. Volume horaire (15min, 30min, 1h+)
3. Diagnostic (Débutant, Révision, Urgence)

## 3. L'écran "Parcours"
Timeline verticale (style Duolingo). Nœuds = items. Boss tous les 5 items.
Bouton CTA fixe en bas : "Reprendre".

## 4. La boucle d'étude
Démarrage -> QCM -> Fiche -> Flashcards -> Mindmap -> Fin de session (Récap).

## 5. Gamification éthique
- **XP** : 10 XP/QCM (débloque fiches bonus).
- **Flamme** : Tolérance 2 gels par mois.
- **Badges** : Maîtrise (ex: tous les items cardio >80%), pas de badges de simple présence.
- **Classement** : Opt-in, par faculté, pas de compétition toxique.

## 6. Notifications
- Douces : "Ton item du jour : Embolie pulmonaire (20 min)."
- Alerte de gel : "Tu as 4h pour garder ta série."

## 7. Technique (Fichiers)
- `src/lib/parcours/planner.ts` (génère le plan)
- `src/components/parcours/path-node.tsx` (nœuds)
- `src/components/resume-where-card.tsx` (existant à brancher)

## 8. Anti-patterns (Interdits)
- Pas de vies/cœurs bloquants.
- Pas de gemmes payantes pour sauter des items.
- Pas de dark patterns.
- Pas de confettis roses.

## 11. Les Plans (offre produit)
| Plan | Cible | Contenu | Modèle |
|---|---|---|---|
| **Concours National** | Madagascar | 240 items, 4 examens blancs | Freemium |
| **Accéléré 30 jours** | Rattrapage | 60 items à fort rendement | Premium+ |
| **EDN / International** | France/Québec | Programme EDN, QCM calibrés | Premium (€) |
| **Libre** | Révision | Choix libre | Freemium |

**Flexibilité** : Changement de plan possible, progression conservée.
**Pricing** : Mobile Money (Mada), Stripe (International). Essai 7j.

## 12. Internationalisation du parcours
- Le contenu médical est le même.
- Le programme change : nécessite `programmes/edn-2026.json`.
- **Abstraction technique** : `programmeId` (`madagascar-2025`, `edn-2026`) obligatoire dès le début.

## 13. Module "Signes & Triades" (Raisonnement inversé)

**Concept** : Ne pas apprendre les triades par cœur. Les déduire d'une situation clinique.

**Mécanique (UX)** :
1. **Cas clinique** : Mini-scénario (ex: "Obésité, vergetures, HTA").
2. **Question** : "Quel syndrome évoquez-vous ?" (Choix multiples).
3. **Révélation** : La triade/tétrade s'affiche, les signes du cas sont surlignés.
4. **Collection** : La carte est ajoutée au "Pokédex" de l'étudiant (gamification).

**Contrainte** : Nécessite le cahier des charges médical du propriétaire (contient des signes cliniques).
**Structure technique** : Réutiliser `quiz-player.tsx`. Créer un wrapper `CasCliniqueWrapper`.
