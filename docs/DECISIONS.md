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

## Sessions terminées

- 2026-10-15 · **Session 1 (A02, A01, A03, A05, A07)** — business model. Note : l'i18n des pages `/tarifs` et `/pro` est volontairement reportée aux sessions C21/C23 (architecture i18n).

