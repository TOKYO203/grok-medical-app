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
| 2026-10-15 | B13 | Statut de revue médicale par deck affiché sur la page parcours via `src/content/deck-review-status.ts`, miroir compact du registre `editorial-registry.json`, synchronisation verrouillée par `scripts/deck-review-status.test.mjs` | Le registre existait mais son statut n'était visible nulle part dans l'UI ; un miroir compact évite d'embarquer le JSON complet dans le bundle (budget perf) | Vibe |
| 2026-10-15 | B14 | Version du contenu médical `v2026.10-Mada` créée dans `src/content/medical-version.ts`, distincte de la version applicative (`version-engine.ts` 1.0.0), affichée dans le pied de `/a-propos` | Séparer le cycle de vie du contenu médical de celui de l'application, sans toucher au codename « Optimus Clinical AI » verrouillé par les garde-fous | Vibe |
| 2026-10-15 | B15 | Protocole de validation clinique rendu public : `docs/CLINICAL-VALIDATION.md` + page `/validation-clinique` (résumé + lien vers le document source sur GitHub) | Un visiteur doit pouvoir juger la méthode sans fouiller le dépôt ; le document reste la source de vérité | Vibe |
| 2026-10-15 | B12 | Page `/conseil-editorial` : mission, processus, état de la relecture par deck (consommé depuis B13/B14), cadre d'usage, crédits, contact — liée depuis `/a-propos` avec `/validation-clinique` | Regrouper la gouvernance éditoriale en un point d'entrée unique, lisible sans compte | Vibe |
| 2026-10-15 | B16 | « Optimus Clinical AI » clarifié partout : tuteur pédagogique, ni diagnostic ni conduite à tenir, pas un dispositif médical — bandeau du widget `ClinicalAIWidget.tsx`, paragraphe dédié dans `/a-propos`, pages `/conseil-editorial` et `/validation-clinique`, `docs/CLINICAL-VALIDATION.md` | Le nom « Clinical AI » laissait croire à un outil d'aide à la décision clinique ; on nomme le périmètre réel | Vibe |
| 2026-10-15 | B17 | Disclaimer médical affiché à l'écran 4 de l'onboarding (composant `MedicalDisclaimer` existant, au-dessus du bouton « Commencer »), sans case à cocher | Le disclaimer n'était visible qu'en pied de page après l'entrée dans l'app ; réutiliser le composant existant n'ajoute ni friction ni clés i18n | Vibe |
| 2026-10-15 | B18 | Crédits ECG visibles dans l'UI : J. Hampton, *The ECG Made Easy* (Elsevier) et recommandations ESC affichés sur `/ecg` ; crédits également portés par `/conseil-editorial` et `docs/CLINICAL-VALIDATION.md` | Citer les références de lecture à l'endroit où l'étudiant apprend, sans toucher au moteur `src/lib/ecg` (module interdit) | Vibe |

## Sessions terminées

- 2026-10-15 · **Session 1 (A02, A01, A03, A05, A07)** — business model. Note : l'i18n des pages `/tarifs` et `/pro` est volontairement reportée aux sessions C21/C23 (architecture i18n).
- 2026-10-15 · **Session 2 (B11, B13, B14, B15, B12, B16, B17, B18)** — crédibilité médicale. Note : l'i18n des pages `/conseil-editorial` et `/validation-clinique` est volontairement reportée aux sessions C21/C23 (architecture i18n).

