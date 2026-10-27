# PRICING V2 — Audit du pricing réel + cadre Madagascar d'abord (Semaine 4, Flux D)

**Date** : 2026-10-27 (révisé après audit de `docs/DECISIONS.md` A02–ABO-12, PAY-RT-1→9)
**Statut** : **audit de l'existant** — la « refonte » initialement proposée est abandonnée :
la page `/tarifs` existe et l'abonnement est déjà vendable. Ce document consigne l'état
réel, valide les choix, et cadre la suite avec la décision propriétaire :
**valider le produit à Madagascar d'abord** (Lemon Squeezy live différé).
**Documents liés** : [`DECISIONS.md`](./DECISIONS.md) (A02, A03, ABO-7→ABO-12, PAY-RT-1→9),
[`ROADMAP-V2-STRATEGIC.md`](./ROADMAP-V2-STRATEGIC.md) (Semaine 4),
[`POSITIONING-V2.md`](./POSITIONING-V2.md), [`ANALYTICS-FUNNEL-V2.md`](./ANALYTICS-FUNNEL-V2.md)

---

## 1. État réel du pricing (mesuré, 2026-10-27)

| Élément | État | Réf. |
| --- | --- | --- |
| Page `/tarifs` | ✅ existe (`src/routes/tarifs.tsx`), règle : « n'annoncer payable que ce qui est RÉELLEMENT payable » | A02 |
| **Abonnement trimestriel 15 000 Ar** | ✅ **vendable** — même tunnel que les offres à l'unité, `orderProduct()` → `OPTIMUS_PRO`, `orderAmount()` → `PRICES_MGA.subscriptionQuarter`, licence datée `SUBSCRIPTION_MONTHS` mois, **premier bloc de la page, Mobile Money** | ABO-11 |
| Spécialité d'un abonnement | sentinelle `all`, normalisée côté serveur | ABO-12 |
| Offres à l'unité | deck **3 000 Ar**, spécialité **27 000 Ar** (pack `_PACK_15`) | ABO-7, tests `purchase-order.test.ts` |
| Vocabulaire commercial | aligné (« Débloquer cette spécialité · 27 000 Ar »), verrouillé par `product-copy.test.mjs` (9 tests, i18n ×4) | ABO-7/ABO-8 |
| Essai Premium 7 jours | ✅ état `premiumTrial` distinct des droits serveur, n'accorde aucun entitlement | A03 |
| Multi-devises | ✅ MGA/USD/EUR, référence Ariary, conversions indicatives constantes, devise présagée via fuseau | A01 |
| Paiement carte international | tunnel câblé + diagnostiqué (`/api/health/checkout`, `reason` sur les 503, `payment:readiness --host`), boutique **encore en mode test** | PAY-RT-1→9, P0-2 |
| Porte d'auth `/tarifs` | redirection `/login` **seulement** si session connue absente | PAY-RT-7, PR #190 |

**Conclusion** : le socle pricing est **plus avancé que la roadmap ne le supposait**.
Il n'y a rien à « refondre » — il y a un cadre à poser pour la phase Madagascar.

## 2. Cadre « Madagascar d'abord » (décision propriétaire, 2026-10-27)

| Règle | Statut |
| --- | --- |
| L'abonnement 15 000 Ar reste l'offre principale, en tête de `/tarifs`, payé en Mobile Money | ✅ déjà en place (ABO-11) — **ne pas toucher** |
| Le tunnel carte internationale reste **secondaire et discret** : la boutique étant en mode test, on ne pousse aucune promesse carte (règle de la page : ne promettre que le payable) | ✅ cohérent — ne pas changer la copy avant la bascule live (P0-2, différé) |
| Aucun changement de prix (15 000 Ar / 3 000 Ar / 27 000 Ar) : validés par l'usage et verrouillés par les tests | ✅ gel des prix jusqu'à la validation Madagascar |
| Multi-devises : conserver MGA comme référence (A01) ; les conversions EUR/USD restent indicatives, sans dépendance réseau | ✅ déjà conforme |

## 3. Ce qui reste à faire sur le pricing (après audit)

| # | Chantier | Réf. roadmap | Priorité |
| --- | --- | --- | --- |
| 1 | Bascule Lemon Squeezy **live** (clés, secret webhook, purge tests) | P0-2/P0-6 | **différée par décision propriétaire** |
| 2 | E-mails de cycle de vie (échéance −3 j, bienvenue, relance) — s'appuie sur `ANALYTICS-FUNNEL-V2.md` | P1-4 | dès l'ouverture publique |
| 3 | Codes promo / bourses (écoles, parrainage) | P1 | après la validation |
| 4 | Offre École outillée (sièges, facturation, back-office) | P2-6 | avec la page `/institutionnel` (Semaine 7) |

## 4. Boucle analytics (alignée sur la taxonomie existante)

| Événement (`ANALYTICS-FUNNEL-V2.md`) | Propriété `plan` | Source de vérité |
| --- | --- | --- |
| `paywall_viewed` | `trigger` + `offer` (`subscription` / `deck` / `specialty`) | `PremiumOffer` (ABO-11) |
| `purchase` | `offer` + `provider` (`mvola/orange` / `lemonsqueezy` en phase 3) | `orderLabel()`, `orderProduct()` |

KPI inchangés : conversion `paywall_viewed` → `purchase` ≥ 3 % ; essai → `first_content_viewed` 20–30 %.

## 5. Critères d'acceptation (pour toute future PR touchant `/tarifs`)

- [ ] La règle de la page est respectée : n'annoncer payable que ce qui est réellement payable
- [ ] `product-copy.test.mjs` et `premium-product-consistency.test.mjs` restent verts
- [ ] Aucun prix codé en dur : `PRICES_MGA` et `pricing.ts` restent la source unique
- [ ] i18n ×4 complet (garde-fou ABO-8)
- [ ] `/api/health/checkout` vert sur le déploiement avant toute communication sur le paiement carte
