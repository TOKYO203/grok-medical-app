# PRICING V2 — Pricing refondu : Gratuit / Premium / Institution (Semaine 4, Flux D)

**Date** : 2026-10-27
**Statut** : structure et copy prêtes — bascule Lemon Squeezy en live **délibérément différée** (décision propriétaire : valider le produit à Madagascar d'abord)
**Documents liés** : [`ROADMAP-V2-STRATEGIC.md`](./ROADMAP-V2-STRATEGIC.md) (Semaine 4, amélioration n° 5 country-aware pricing),
[`POSITIONING-V2.md`](./POSITIONING-V2.md) (§ 1.3 gratuité validée),
[`B2B-INSTITUTIONNEL-V2.md`](./B2B-INSTITUTIONNEL-V2.md) (offre Institution),
[`PRODUCT-VISION.md`](./PRODUCT-VISION.md) (Pilier 4), [`ANALYTICS-FUNNEL-V2.md`](./ANALYTICS-FUNNEL-V2.md)

> Livrable de la **Semaine 4** : pricing refondu. Cadre posé par le propriétaire :
> **Madagascar d'abord** — MGA et Mobile Money sont l'offre principale ; la carte
> internationale (Lemon Squeezy, EUR) attend la validation locale.

---

## 1. Les 3 plans

| Plan | Prix | Paiement | Contenu | Rôle |
| --- | --- | --- | --- | --- |
| **Gratuit** | 0 Ar | — | 1 fiche + 1 cas + essai 7 jours | **activation J0** (cible ≥ 60 %), pas de monétisation |
| **Premium** ⭐ | **15 000 Ar/trimestre** (≈ 3,2 €) | **Mobile Money uniquement** (MVola / Orange Money) | tout le contenu Premium, SRS, statistiques, mode examen | **offre principale** Madagascar |
| **Institution** | ~10 000 Ar/siège/trim (dégressif) ou devis annuel | facture établissement | voir [`B2B-INSTITUTIONNEL-V2.md`](./B2B-INSTITUTIONNEL-V2.md) | revenu B2B, Semaine 7 |

### Règles Madagascar-first
1. La page pricing **n'affiche pas de paiement carte** tant que Lemon Squeezy n'est pas
   basculé en live (P0-2/P0-6 différés) — aucun « bientôt l'euro » qui décrédibilise.
2. Le prix s'affiche **en ariary d'abord**, sans équivalent EUR mis en avant
   (l'équivalent discret ≈ 3,2 € peut rester en note de bas de page pour les candidats B2B).
3. Ancre de valeur autorisée : « la prépa privée coûte 1 000 000+ Ar ; une licence
   Premium de trimestre, 15 000 Ar » (`POSITIONING-V2.md` Persona 1).

## 2. Structure de la page `/tarifs`

1. Rappel de la promesse (1 ligne, `POSITIONING-V2.md` tagline)
2. 3 cartes : Gratuit (gauche) · **Premium (centre, badge « Le plus choisi »)** · Institution (droite, CTA « Nous contacter »)
3. Comparatif par fonctionnalité (coches) — Maximum ~8 lignes, pas un tableau Excel
4. Preuve de confiance reprise du trust layer (statut de relecture, sources)
5. FAQ pricing (5 questions, § 4)
6. CTA final « Commencer gratuitement »

## 3. Copy des cartes (FR)

- **Gratuit** — « Découvrez ce qu'Optimus change dans votre révision. » CTA : « Commencer gratuitement »
- **Premium** — « Tout le programme, tout le trimestre. 15 000 Ar. » CTA : « Activer avec MVola / Orange Money »
- **Institution** — « Pour votre promotion entière. » CTA : « Demander une démonstration » (`/institutionnel`)

## 4. FAQ pricing (5 questions)

1. Quels moyens de paiement ? — MVola et Orange Money, aujourd'hui ; d'autres moyens suivront.
2. L'essai de 7 jours engage-t-il ? — Non, aucun prélèvement automatique.
3. Que se passe-t-il à la fin du trimestre ? — la licence expire, renouvellement en un paiement.
4. Existe-t-il une offre pour un groupe / une promo ? — oui, voir `/institutionnel`.
5. Puis-je être remboursé(e) ? — oui sous 7 jours si le contenu ne vous a pas servi (à confirmer par le propriétaire ⚠️).

## 5. Boucle avec l'analytics (`ANALYTICS-FUNNEL-V2.md`)

| Événement | Propriété ajoutée |
| --- | --- |
| `paywall_viewed` | `plan` (free-trial/premium), `trigger` |
| `purchase` | `plan` = `trim-MGA`, `provider` = `mvola/orange` |

KPI à suivre dès la mise en ligne : conversion `paywall_viewed` → `purchase` ≥ 3 %.

## 6. ⚠️ Prérequis techniques avant de vendre (rappel `PRODUCT-VISION.md`)

| Prérequis | Réf. | État |
| --- | --- | --- |
| Abonnement Mobile Money **vendable** (ABO-10 dans `orderProduct()` + contrainte SQL) | P0-3 | **bloquant** — sans lui, 15 000 Ar payé ne produit aucune licence |
| Lemon Squeezy live | P0-2/P0-6 | **différé par décision propriétaire** |

## 7. Critères d'acceptation

- [ ] 3 cartes conformes § 2, prix en Ar uniquement
- [ ] Aucune mention de paiement carte tant que Lemon Squeezy n'est pas live
- [ ] `paywall_viewed` et `purchase` instrumentés avec la propriété `plan`
- [ ] i18n FR complet (`I18N-V2.md`), aucun texte codé en dur
