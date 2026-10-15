# Journal des décisions — Optimus

Format : `YYYY-MM-DD | ID | Décision | Motif | Auteur`

## 2026-10-12 — Kickoff Mission International

| Date | ID | Décision | Motif |
|------|-----|---------|--------|
| 2026-10-12 | — | Création MISSION-INTERNATIONAL.md | Cadrer 53 items |
| 2026-10-12 | — | Plan en 6 sessions | Éviter la dispersion |

## 2026-10-15 — Session 1 : business model freemium/premium

| Date | ID | Décision | Motif | Auteur |
|------|----|----------|-------|--------|
| 2026-10-15 | A02 | Page `/tarifs` : comparatif Gratuit/Premium, offres deck/spécialité, offre École | Item n°1 du Top 10 — +40 % conversions visées | Fetra |
| 2026-10-15 | A01 | Prix multi-devises MGA/USD/EUR : référence Ariary, conversions indicatives constantes (`src/content/pricing.ts`), devise présagée via fuseau horaire | Informer les visiteurs internationaux sans dépendre d'un service de taux externe ni du réseau | Vibe |
| 2026-10-15 | A03 | Essai Premium 7 jours : état local `premiumTrial` distinct des droits serveur — ouvre les cas et démarches Premium, n'accorde aucun entitlement, ne déchiffre pas les Decks chiffrés | Un essai ne doit pas pouvoir se transformer en licence : impossible d'émettre une preuve serveur côté client | Vibe |
| 2026-10-15 | A05 | Teaser « Optimus en 30 secondes » : séquence animée CSS (4 scènes × 7,5 s), sans fichier vidéo | PWA hors-ligne : aucun binaire lourd à télécharger, respecte prefers-reduced-motion | Vibe |
| 2026-10-15 | A07 | Badges progressifs : `nextBadgeGoal()` calcule « Encore 3 cas… » depuis les mêmes signaux que `unlockBadges` | Une seule source de vérité pour les seuils, motivation visible sur le profil | Vibe |
| 2026-10-15 | — | Test `specialty-label` aligné sur l'ordre de priorité corrigé par le commit direct 2e8acd7ca1 (cardio > neuro > dermato > infectio > urgences) : « Dermatologie · Infectiologie » se range sous Dermatologie | Le commit direct avait mis à jour le code et son commentaire mais pas le test — CI rouge sur main depuis ; les garde-fous de la session 1 sont passés | Vibe |
| 2026-10-15 | — | Budget de performance relevé 1704 → 1728 KiB (total mesuré 1706,2 KiB) après la Session 1 (page `/tarifs`, prix multi-devises, essai 7 jours, teaser 30 s, badges progressifs) | Suivre le précédent documenté du garde-fou : relevé par chantier en gardant une marge volontairement faible (~21,8 KiB) pour détecter toute dérive de bundle | Vibe |

## 2026-10-15 — Session 2 : crédibilité médicale

| Date | ID | Décision | Motif | Auteur |
|------|----|----------|-------|--------|
| 2026-10-15 | B11 | Sources par fiche : architecture déjà en place consignée sans nouveau patch — `Question.sources` rendu par `MedicalSources` (fiche, cas) et `ContentTrustCard` (parcours), registres `medical-sources.ts` / `source-registry.ts`, garde-fous `content-quality` + `editorial-registry` | L'inventaire de session montre l'item déjà livré en amont : on consigne l'état plutôt que dupliquer du code | Vibe |

## Sessions terminées

- 2026-10-15 · **Session 1 (A02, A01, A03, A05, A07)** — business model. Note : l'i18n des pages `/tarifs` et `/pro` est volontairement reportée aux sessions C21/C23 (architecture i18n).

