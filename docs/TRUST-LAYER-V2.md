# TRUST LAYER V2 — Audit du socle de confiance médicale (Semaine 3, Flux C)

**Date** : 2026-10-26
**Statut** : audit + copy prête à intégrer — l'implémentation des pages (code) reste à faire
**Documents liés** : [`ROADMAP-V2-STRATEGIC.md`](./ROADMAP-V2-STRATEGIC.md) (§ Point 3 — Trust framework médical),
[`CLINICAL-VALIDATION.md`](./CLINICAL-VALIDATION.md), [`medical-review-checklist.md`](./medical-review-checklist.md),
[`medical-content-correction.md`](./medical-content-correction.md)

> Livrable de la **Semaine 3** : visibilité du trust layer. Constat central : **le socle
> existe déjà et il est solide** — protocole public, checklist de revue, procédure de
> correction urgente, registre éditorial verrouillé par les tests. Le travail de la
> Semaine 3 est un travail de **mise en avant**, pas de refonte.

---

## 1. Audit — exigences de la roadmap vs état réel

| Exigence (roadmap V2) | État actuel | Écart | Livrable Semaine 3 |
| --- | --- | --- | --- |
| Editorial policy (page publique) | Protocole technique (`CLINICAL-VALIDATION.md` + page `/validation-clinique`) | pas de **politique éditoriale** grand public : périmètre, promesse, « ce que c'est / ce que ce n'est pas » | copy § 3.1 (prête) |
| Clinical validation | ✅ `/validation-clinique` + protocole versionné `v2026.10-Mada` | aucun | rien — à lier depuis la landing |
| Methodology | dispersée (checklist de revue, SI-first, garde-fous automatisés) | pas de page « comment le contenu est produit » | copy § 3.2 (prête) |
| Review process | ✅ statuts publics datés (`structural_only` → `priority_items_reviewed` → `fully_reviewed`), preuve minimale verrouillée par `npm test` | process interne public, mais pas de page publique « comment on relit » | copy § 3.2 (sous-section) |
| Sources & references | `.env` des sources : `src/content/medical-sources.ts`, 220 sources HTTPS sur les signes, références créditées (Hampton, ESC) | pas de **page publique** qui liste les familles de sources | copy § 3.3 (prête) |
| Changelog public | ✅ `/changelog` | aucun | rien |
| Editorial board | page conseil éditorial + registre (`editorial-registry.json`) verrouillé par tests | membres **nommés** à confirmer (P0-8 de `PRODUCT-VISION.md` : relecteurs 1-2 praticiens) | § 4 recommandation |
| Disclaimer médical | position affichée (« outil éducatif, pas de diagnostic ») | pas de disclaimer standardisé répété sur chaque fiche | copy § 3.4 (prête) |

## 2. Éléments visibles dans chaque fiche — état vs cible

| Élément exigé (roadmap) | État | Action |
| --- | --- | --- |
| Source | ✅ `MedicalSources` + `ContentTrustCard`, section par section | conserver |
| Date de mise à jour | ✅ version de contenu datée | afficher aussi la date par fiche si disponible |
| Reviewer / institution | partiel (registre éditorial, pas au niveau fiche) | étendre `medical_review.reviewer_name` au niveau fiche (déjà prévu par le registre) |
| Statut (draft / reviewed / published / deprecated) | ✅ statuts publics datés | ajouter `deprecated` dans l'UI |
| Niveau d'evidence | ❌ absent | à ajouter au gabarit d'item (décision 5.3 de `PRODUCT-VISION.md`) |
| Disclaimer médical | partiel | composant réutilisable § 3.4 |
| « What this is / what this is not » | ❌ absent sur les fiches | § 3.1, à reprendre en bandeau |

## 3. Copy prête pour les pages publiques manquantes

### 3.1 Editorial policy — « Notre politique éditoriale » (FR/EN)

**FR — Ce qu'Optimus est**
> Un outil pédagogique pour les étudiants en médecine : des fiches, des cas et des
> questions **sourcées** (OMS, HAS, sociétés savantes), relues par des médecins, avec un
> statut de relecture public et daté sur chaque deck.

**FR — Ce qu'Optimus n'est pas**
> Ni un outil de diagnostic, ni une aide à la prescription, ni un substitut au jugement
> clinique. Aucun contenu ne doit être appliqué à un patient. En situation réelle,
> les recommandations locales et l'avis d'un clinicien priment toujours.

**EN — What Optimus is / What Optimus is not** : même structure, miroir exact.

Règle éditoriale (interne, déjà en vigueur — à afficher) :
- chaque question référence au moins une source, sinon `content-quality.test.mjs` rejette la publication ;
- une suite de tests automatisés ne constitue **jamais** une validation médicale ;
- un deck `fully_reviewed` exige la preuve complète (relecteur nommé, qualification, sources de revue).

### 3.2 Methodology — « Comment nous produisons le contenu »

1. **Programme d'abord** : chaque contenu est rattaché à un item du programme officiel (240 items, Madagascar 2025).
2. **Sources avant texte** : rédaction à partir de sources primaires ou de recommandations professionnelles datées ; unités SI-first (`src/lib/units.ts`).
3. **Garde-fous automatisés** : registre éditorial et statuts de revue verrouillés par les tests (`editorial-registry.test.mjs`, `deck-review-status.test.mjs`).
4. **Relecture humaine** : statuts publics datés — `structural_only` → `priority_items_reviewed` → `fully_reviewed` (preuve minimale : relecteur nommé + qualification + sources).
5. **Correction traçable** : tout signalement suit `medical-content-correction.md` (triage critique/majeur/mineur, masquage immédiat si critique, `release:check` avant republication).

### 3.3 Sources & references — « Nos sources »

Familles affichées (miroir de `src/content/medical-sources.ts`) :
- **Organisations de santé** : OMS, ministères de santé ;
- **Agences et autorités** : HAS et équivalents francophones ;
- **Sociétés savantes** : ESC (cardiologie), sociétés savantes par spécialité ;
- **Références pédagogiques créditées** : ex. J. Hampton, *The ECG Made Easy* (crédit affiché sur la page ECG) ;
- **Recommandations** : datées et versionnées, jamais citées sans version.

### 3.4 Disclaimer médical standardisé (composant réutilisable)

- **FR** : « Optimus est un outil pédagogique destiné aux étudiants en médecine. Il ne
  pose aucun diagnostic, ne prescrit rien et ne fournit aucune conduite à tenir. En
  situation clinique réelle, suivez les protocoles de votre établissement et l'avis d'un
  clinicien. »
- **EN** : "Optimus is an educational tool for medical students. It does not diagnose,
  prescribe, or provide clinical management. In real clinical settings, follow your
  institution's protocols and a clinician's judgment."

## 4. Recommandations (décisions propriétaire)

| # | Recommandation | Réf. |
| --- | --- | --- |
| 1 | Nommer 1–2 relecteurs médicaux (le seul gap P0 du trust layer) | P0-8 `PRODUCT-VISION.md` |
| 2 | Ajouter le « niveau d'evidence » au gabarit d'item | décision 5.3 |
| 3 | Reprendre le bandeau « ce que c'est / ce que ce n'est pas » sur les fiches | roadmap § Point 2 |
| 4 | Afficher le disclaimer standardisé § 3.4 en pied de chaque fiche et deck | roadmap § Point 3 |

## 5. Prochaines étapes

| Étape | Nature | Qui |
| --- | --- | --- |
| Implémenter les pages publiques (`/editorial-policy`, `/methodologie`, `/sources`) + composant disclaimer | code (React) | dev (Flux B/C) || Implémenter les pages publiques (`/politique-editoriale`, `/methodologie`, `/sources`) + composant disclaimer (déjà livré : `src/components/legal/medical-disclaimer.tsx`) | code (React) | dev (Flux B/C) |
| Nommer les relecteurs et compléter l'editorial board | décision + éditorial | propriétaire |
| Lier trust badges depuis la landing (Semaine 2) | code | dev |
