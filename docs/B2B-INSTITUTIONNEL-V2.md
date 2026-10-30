# B2B INSTITUTIONNEL V2 — Page, offre et lead capture (Semaine 7, Flux D)

**Date** : 2026-10-26
**Statut** : page et lead capture livrées (PR `feat/institutionnel-b2b`) — notification e-mail différée (aucune infra mail auto-hébergée à ce jour) ; tarifs ⚠️ à valider par le propriétaire
**Documents liés** : [`ROADMAP-V2-STRATEGIC.md`](./ROADMAP-V2-STRATEGIC.md) (Semaine 7),
[`POSITIONING-V2.md`](./POSITIONING-V2.md) (Persona 3 — Pr Ravelo),
[`PRODUCT-VISION.md`](./PRODUCT-VISION.md) (P2-6 offre École)

> Livrable de la **Semaine 7** : page institutionnelle B2B + lead capture.
> Cible : le Persona 3 de `POSITIONING-V2.md` — responsable pédagogique qui doit
> défendre l'outil devant sa hiérarchie.

---

## 1. Objectif et KPI

- **Objectif** : générer des demandes de démonstration qualifiées.
- **KPI (roadmap V2)** : > 5 demandes d'école/mois ; taux de réponse aux leads < 48 h.

## 2. Structure de la page `/institutionnel` (sections dans l'ordre)

| # | Section | Contenu |
| --- | --- | --- |
| 1 | Hero institutionnel | « Équipez votre promotion d'un socle de révision unique, sourcé et relu. » + CTA « Demander une démonstration » |
| 2 | Problème | photocopies hétérogènes, suivi de progression impossible, aucune traçabilité qualité |
| 3 | Solution | couverture du programme (240 items), sources affichées section par section, statut de relecture public, suivi de progression par promo |
| 4 | Preuves | 567 questions expliquées **et** sourcées · 78 calculateurs · protocole `v2026.10-Mada` · conseil éditorial |
| 5 | 3 offres | voir § 3 |
| 6 | FAQ établissements | facturation annuelle, sièges, accès enseignants, données des étudiants (lien `/donnees`) |
| 7 | Lead capture | voir § 4 |
| 8 | CTA final | « Parlons de votre promotion. » |

## 3. Les 3 offres institutionnelles ⚠️ (tarifs indicatifs à valider)

| Offre | Pour qui | Contenu | Prix indicatif |
| --- | --- | --- | --- |
| **Promo** | une promotion / un tutorat | licences multi-sièges (au-delà de 10), suivi de progression agrégé | ~10 000 Ar/siège/trim (dégressif) |
| **École** | faculté / école de prépa | toutes les promos + tableau de bord établissement + support prioritaire | devis annuel |
| **Département / CHU** | service hospitalier | accès formation continue des internes + rapports trimestriels | devis annuel |

## 4. Lead capture (remplace l'actuel `mailto:` sur `/contact`)

**Champs du formulaire** : établissement* · fonction* · nom* · e-mail professionnel* ·
téléphone/WhatsApp (optionnel) · nombre d'étudiants (tranche) · message (optionnel).
(*) = requis.

**Routage** : insertion dans une table `institution_leads` (Supabase, RLS admin) +
notification e-mail au propriétaire. Un lead = une ligne de plus dans le back-office,
pas un e-mail perdu.

**SLA de réponse : 48 h ouvrées.** Un établissement qui relance lui-même signale un process cassé.

> Implémenté : `POST /api/institution-leads` (validation serveur bornée, rate limit) écrit dans
> `institution_leads` — migration `0021`, RLS activé sans policy (écriture serveur uniquement).
> La notification e-mail est différée : le projet n'a pas d'infrastructure mail auto-hébergée ;
> le lead vit dans le back-office (table + dashboard Supabase) en attendant.

## 5. Copy hero FR/EN

- **FR** : « Un socle de révision sourcé et relu, avec un suivi de progression pour toute votre promotion. »
- **EN** : "A sourced, medically-reviewed revision backbone — with progression tracking for your entire cohort."
- **CTA** : « Demander une démonstration » / "Book a demo"

## 6. Cycle de vente (4 étapes)

1. **Lead** (formulaire) → 2. **Démonstration** (visio ou présentiel Antananarivo) →
3. **Pilote** : 1 promo, 1 trimestre, avec bilan d'usage → 4. **Contrat annuel**.

Le pilote est l'argument décisif : il neutralise l'objection « est-ce que nos étudiants l'utiliseront vraiment ? »

## 7. Plan d'implémentation

| Étape | Nature | Effort |
| --- | --- | --- |
| 1 | Page `/institutionnel` (sections § 2) + i18n fr/en | 1,5 j |
| 2 | Table `institution_leads` + notification e-mail + back-office | 1 j |
| 3 | Tableau de bord établissement (P2-6, après premiers clients) | 4 j |
