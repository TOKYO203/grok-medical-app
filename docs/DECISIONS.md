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
| 2026-10-15 | — | `src/routeTree.gen.ts` régénéré avec `/conseil-editorial` et `/validation-clinique` (correctif CI sur le job test) | Le fichier d'arborescence est versionné : sans mise à jour, le job test (qui ne passe pas par `routes:generate`) échoue sur les `Link` typés d'`a-propos.tsx` | Vibe |

## 2026-10-15 — Session 3 : i18n

| Date | ID | Décision | Motif | Auteur |
|------|----|----------|-------|--------|
| 2026-10-15 | C21 | Architecture i18n étendue à fr/en/es/pt : type `Locale` élargi dans `src/i18n/core.ts`, catalogues jumeaux `es.ts`/`pt.ts` (clés identiques à fr/en, vérifiées par `messages.test.ts`), `CATALOGS` à quatre langues — le sélecteur du profil s'enrichit automatiquement via `LOCALES` | Item C21 du plan ; le socle Phase 3 (fr/en) garantit le repli sur le français, l'extension ne touche ni les composants ni le store (validation `isLocale` existante) | Vibe |
| 2026-10-15 | C22 | Détection de la langue au premier lancement : `src/i18n/detect.ts` devine la locale depuis `navigator.languages` (repli français), appliquée depuis un pont de la route racine — jamais deux fois : choix explicite marqué (`markLocaleChosen` au clic du sélecteur), locale persistée non française respectée, no-op côté serveur | Servir la bonne langue aux visiteurs internationaux sans écraser un choix existant ; la détection locale (sans géolocalisation réseau) respecte le mode hors-ligne de la PWA | Vibe |
| 2026-10-15 | C26 | Dates locale-aware : `src/i18n/format.ts` (table locale → étiquette Intl, `formatShortDate`/`formatFullDate`/`formatDateTime`) branché sur `/contact` (brouillons), `/admin-licences` (dates des clés) et `relativeTime` de l'historique IA (paramètre `locale`, repli français) ; les libellés relatifs (« à l'instant », « il y a 3 min ») restent en français, leur traduction suit le contenu IA (C27) | Une seule table de correspondance pour toutes les dates affichées : le format suit la langue choisie au lieu d'un `fr-FR` codé en dur dans chaque composant | Vibe |
| 2026-10-15 | C28 | Unités cliniques standardisées : registre `CLINICAL_UNITS` créé dans `src/lib/units.ts` — symboles SI-first (bpm, mmHg, g/L, g/dL, mmol/L, °C, kg, kg/m², cm, mL, %, ms, mV, mg, µg, mL/min) — avec `formatMeasurement(value, unitId, locale)` (Intl.NumberFormat : séparateur décimal selon la langue, espace fine insécable entre valeur et symbole) et `parseMeasurement` (virgule ou point décimaux), verrouillé par `src/lib/units.test.ts` ; convention consignée dans `docs/CLINICAL-VALIDATION.md` (section « Unités standardisées ») | Une seule source de vérité pour le rendu des unités, sans toucher aux moteurs interdits (ECG, auscultation, calculateurs) et sans changer un affichage existant : le câblage UI suivra la refonte des écrans de mesure | Vibe |

## Sessions terminées

- 2026-10-15 · **Session 1 (A02, A01, A03, A05, A07)** — business model. Note : l'i18n des pages `/tarifs` et `/pro` est volontairement reportée aux sessions C21/C23 (architecture i18n).
- 2026-10-15 · **Session 2 (B11, B13, B14, B15, B12, B16, B17, B18)** — crédibilité médicale. Note : l'i18n des pages `/conseil-editorial` et `/validation-clinique` est volontairement reportée aux sessions C21/C23 (architecture i18n).
- 2026-10-15 · **Session 3 (C21, C22, C26, C28)** — i18n. Note : le câblage UI des unités standardisées (C28) suivra la refonte des écrans de mesure ; les libellés relatifs de l'historique IA suivront la traduction du contenu IA (C27).

