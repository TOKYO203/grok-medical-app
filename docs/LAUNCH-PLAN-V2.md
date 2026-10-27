# LAUNCH PLAN V2 — Plan de lancement de la phase de validation Madagascar (Semaine 8)

**Date** : 2026-10-27
**Statut** : proposition — les jalons ⚠️ dépendent du propriétaire
**Documents liés** : [`ROADMAP-V2-STRATEGIC.md`](./ROADMAP-V2-STRATEGIC.md) (Semaine 8),
[`POSITIONING-V2.md`](./POSITIONING-V2.md), [`PRICING-V2.md`](./PRICING-V2.md),
[`ANALYTICS-FUNNEL-V2.md`](./ANALYTICS-FUNNEL-V2.md), [`PRODUCT-VISION.md`](./PRODUCT-VISION.md) (§ 6 métriques),
[`TODO.md`](../TODO.md) (phase beta 20+ utilisateurs)

> Livrable de la **Semaine 8** : polish + QA + plan de lancement. Objectif de la phase :
> **valider le produit à Madagascar** (décision propriétaire), mesurer, puis décider
> de l'ouverture internationale — pas l'inverse.

---

## 1. Jalon d'entrée (gate de lancement — tout doit être vert)

| # | Contrôle | Réf. |
| --- | --- | --- |
| G1 | `/api/health/checkout` vert sur le déploiement (le tunnel Mobile Money encaisse réellement) | PAY-RT-4 |
| G2 | Achat réel MVola 15 000 Ar → licence `active` visible back-office, bonne échéance | ABO-11, P0-3 résolu |
| G3 | Back-office opérationnel : SQL admin exécuté, faille `is_admin` fermée | P0-1 |
| G4 | Bug « Disallowed operation » résolu et vérifié en prod | prérequis roadmap V2 |
| G5 | Analytics branché : les 7 événements remontent (test live sur le déploiement) | `ANALYTICS-FUNNEL-V2.md` |
| G6 | 1 relecteur médical nommé (au minimum) sur l'editorial board | P0-8 |
| G7 | `release-check` vert : tests, smokes, budget perf, audit mise en page 320–390 px (dont `/tarifs`) | AUTH-15/16/17 |

## 2. Déroulé en 3 étapes

### Étape 1 — Pilote fermé (2 semaines, ~20 étudiants)
- Recrutement : 2 promos contactées à Antananarivo, mix DFM2/fin d'études.
- Accès direct + abonnement Mobile Money **réel** (G2 doit être vert avant).
- Mesure : activation J0 ≥ 60 %, rétention J7 ≥ 35 %, ≥ 3 sessions/semaine,
  signalements « erreur » < 2 / 1 000 consultations.
- Sortie de pilote ⚠️ : go/no-go sur **la rétention J7**, pas sur les compliments.

### Étape 2 — Ouverture Madagascar (après go)
- Landing live (spec `LANDING-V2-SPEC.md`), pages trust publiques, `/tarifs` en face.
- Acquisition WhatsApp-first : carte de partage de session (QW5), parrainage,
  2 facultés partenaires (relais `/institutionnel`).
- Veille : SLA signalements < 7 j (délai de correction), `/changelog` alimenté.

### Étape 3 — Décision internationale (après validation)
- Prérequis : Lemon Squeezy **live** (P0-2/P0-6, aujourd'hui différé), e-mails
  de cycle de vie (P1-4), pages segmentées EUR (cf. `PRICING-V2.md` § 3).
- Critère d'ouverture ⚠️ : conversion paywall ≥ 3 % **mesurée en phase 2**.

## 3. Risques et parades

| Risque | Parade |
| --- | --- |
| Paiement Mobile Money en échec le jour J | health check G1 + `payment:readiness --host` en pré-lancement ; support WhatsApp dédié |
| Couverture perçue faible (9,6 % → montée en charge éditoriale en cours) | communication ciblée sur les spécialités **couvertes** ; jamais de promesse de couverture totale |
| Classement fictif décrédibilise | basculé en réel ou retiré avant l'ouverture (décision 5.4 `PRODUCT-VISION.md`) |
| Le plugin IA sème le doute médical | cadrage B16 affiché (tuteur pédagogique, pas un dispositif médical) — déjà livré |

## 4. Checklist de lancement (jour J)

- [ ] G1→G7 verts, captures archivées
- [ ] `/changelog` et `/validation-clinique` à jour, editorial board nommé
- [ ] Message d'annonce prêt (FR, ton `POSITIONING-V2.md` : bénéfices, pas fonctionnalités)
- [ ] Plan de communication WhatsApp : 3 groupes pilotes, 2 ambassadeurs par promo
- [ ] File de suivi KPI ouverte (requêtes de référence `ANALYTICS-FUNNEL-V2.md` § 5)

## 5. Gouvernance de la phase

- Revue hebdomadaire : KPI + signalements + décisions consignées dans `DECISIONS.md`.
- Toute décision de pricing/langue passe par les critères d'acceptation de
  `PRICING-V2.md` § 5 et `I18N-V2.md` § 3.
