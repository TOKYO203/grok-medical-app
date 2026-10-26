# ANALYTICS FUNNEL V2 — Événements, entonnoir et KPI sheet (Semaine 6, Flux D)

**Date** : 2026-10-26
**Statut** : plan d'instrumentation prêt à implémenter — décision d'outillage ⚠️ à valider
**Documents liés** : [`ROADMAP-V2-STRATEGIC.md`](./ROADMAP-V2-STRATEGIC.md) (Semaine 6),
[`PRODUCT-VISION.md`](./PRODUCT-VISION.md) (§ 1.2 faiblesse n°2, § 4 🥈, § 6 métriques)

> Livrable de la **Semaine 6** : analytics funnel + KPI sheet + events tracked.
> Constat de départ (`PRODUCT-VISION.md`) : **aucun analytics produit, aucun e-mail**
> — chaque décision produit est aujourd'hui une opinion. Ce document définit
> **7 événements, pas cent**, suffisant pour piloter.

---

## 1. Règles de confidentialité (contexte médical — non négociable)

1. **Identifiants anonymes uniquement** : jamais d'e-mail, de nom ou d'identifiant
   permutable dans les événements.
2. **Aucune donnée de santé dans les événements** : on instrumente le *comportement*
   (fiche consultée = identifiant de fiche), jamais le contenu médical saisi.
3. **Consentement** : bannière avant tout envoi (rejet = aucun event), cohérente avec
   la page `/donnees` existante.
4. **Wrapper vendor-agnostic** : un seul module `src/lib/analytics.ts`
   (`track(event, props)`) — le fournisseur doit pouvoir changer sans toucher au code
   métier.

## 2. Recommandation d'outillage ⚠️ (à valider)

| Option | Coût | Avantage | Inconvénient |
| --- | --- | --- | --- |
| **Umami / Plausible self-hosted** (recommandé) | ~0 € + hébergement Netlify/VPS | données chez soi, léger, RGPD-friendly sans cookie banner complexe | moins de fonctions funnel natif |
| PostHog (EU) | gratuit < 1 M events | funnels, cohortes, flags | tiers à documenter dans `/donnees` |

## 3. Les 7 événements (spécification)

| # | Événement | Déclencheur | Propriétés | Emplacement probable |
| --- | --- | --- | --- | --- |
| 1 | `signup` | compte créé | `method` (email/google) | écran d'inscription |
| 2 | `onboarding_done` | wizard niveau/objectif terminé | `level`, `goal` | fin d'onboarding |
| 3 | `first_content_viewed` | 1ʳᵉ fiche ou 1ᵉʳ deck ouvert (une fois par utilisateur) | `content_type` (fiche/deck/signe/calculateur) | route contenu |
| 4 | `session_completed` | session de QCM terminée | `deck_id`, `score`, `duration_s` | écran de résultats |
| 5 | `day_streak` | série atteinte (calculée à l'affichage) | `streak_days` | accueil/profil |
| 6 | `paywall_viewed` | paywall affiché | `trigger` (essai expiré/contenu premium) | gating premium |
| 7 | `purchase` | licence activée (webhook) | `plan` (trim-MGA/3mois-EUR), `provider` (mvola/lemonsqueezy) | webhook serveur |

**Règle d'ajout** : tout nouvel événement doit être rattaché à une décision qu'il éclaire
(métrique du § 5). Sinon, il n'est pas ajouté.

## 4. Entonnoir de conversion

```
visite landing → signup → onboarding_done → first_content_viewed (24 h)
              → session_completed (répétition J+3/J+7)
              → paywall_viewed → purchase
```

## 5. KPI sheet (définitions et cibles, reprise `PRODUCT-VISION.md` § 6)

| KPI | Définition | Cible V1.5 | Source |
| --- | --- | --- | --- |
| **Activation J0** | `signup` → `first_content_viewed` < 24 h | ≥ 60 % | events 1, 3 |
| **Rétention J7** | ≥ 2 jours actifs sur 7 | ≥ 35 % | sessions |
| **Rétention J30** | ≥ 6 jours actifs sur 30 | ≥ 20 % | sessions |
| **Conversion paywall** | `paywall_viewed` → `purchase` | ≥ 3 % | events 6, 7 |
| **Landing → CTA** | clic CTA / visite landing | 5–10 % | roadmap V2 |
| **Activation essai** | essai commencé → `first_content_viewed` | 20–30 % | roadmap V2 |
| **Sessions/semaine** | `session_completed` / étudiant actif | ≥ 3 | event 4 |

**Requêtes de référence** (à reproduire dans l'outil retenu) :
- activation J0 : `signup` ∧ `first_content_viewed`(≤24 h) / `signup` ;
- conversion J+7 : `purchase` ≤ 7 j après `signup` / `signup`.

## 6. E-mails de cycle de vie (même chantier, P1-4)

5 séquences : bienvenue (J0) · relance J+3 (si pas `first_content_viewed`) · « votre série » J+7 · échéance −3 j · contenu mis à jour. Ces déclencheurs s'appuient **exactement** sur les événements 1, 3, 5 et 7 ci-dessus.

## 7. Plan d'implémentation (ordre)

| Étape | Livrable | Effort |
| --- | --- | --- |
| 1 | `src/lib/analytics.ts` + bannière consentement + test unitaire | 1 j |
| 2 | Instrumentation des 7 événements | 1 j |
| 3 | Dashboard KPI (requêtes § 5) | 0,5 j |
| 4 | Brancher les 5 e-mails (Resend ou équivalent) | 1 j |
