# Mission International — Optimus

Chantier de mise à niveau vers un standard éditeur médical international.

## Contexte

- Produit : PWA médicale (React 19 + TanStack + Supabase)
- Cible v1 : Concours National Internat Madagascar
- Cible v2 : International (francophone puis anglophone)
- État : 6/10 local, 3/10 international

## Principes non négociables

1. Ne jamais casser un module existant
2. typecheck + tests verts avant chaque commit
3. Palette Oxford (parchemin #EDE0C8, olive #3E4A2A, or #A67C1E)
4. Commits conventionnels
5. Ne jamais exposer LICENSE_SIGNING_PRIVATE_KEY
6. Pour toute donnée médicale : citer la source
7. Prévoir la traduction dès la conception

## Top 10 prioritaire

1. A02 Page Tarifs — +40% conversions
2. A01 Prix multi-devises
3. B11 Sources bibliographiques
4. B12 Conseil éditorial
5. C21 Architecture i18n
6. A03 Essai 7 jours Premium
7. E41 SRS type Anki
8. E39 Compléter 240 items
9. B15 Validation clinique
10. E44 Examen blanc chronométré

## Liste complète — 53 items

### A — Freemium/Premium (10)
- A01 Prix multi-devises (MGA/USD/EUR auto)
- A02 Page Tarifs comparatif Free/Premium/École
- A03 Essai 7 jours Premium
- A04 Abonnement mensuel/annuel
- A05 Teaser Premium vidéo 30s
- A06 Offre École multi-sièges
- A07 Badges progressifs ("Encore 3 cas...")
- A08 Ligues expliquées
- A09 Parrainage
- A10 Code promo

### B — Crédibilité médicale (10)
- B11 Sources bibliographiques par fiche — ✅ livré (PR #49)
- B12 Page Conseil éditorial — ✅ livré (PR #49)
- B13 Date de révision par fiche — ✅ livré (PR #49)
- B14 Version médicale ("v2025.10-Mada") — ✅ livré (PR #49)
- B15 docs/CLINICAL-VALIDATION.md public — ✅ livré (PR #49)
- B16 Clarifier "Optimus Clinical AI" — ✅ livré (PR #49)
- B17 Disclaimer médical au démarrage — ✅ livré (PR #49)
- B18 Créditer Hampton/ESC dans l'UI — ✅ livré (PR #49)
- B19 Changelog public
- B20 Email institutionnel

### C — i18n (8)
- C21 Architecture i18n (fr/en/es/pt)
- C22 Détection pays
- C23 Prix auto-convertis
- C24 Implémenter ou retirer EDN/Sénégal
- C25 Multi-référentiel (Mada/EDN/USMLE)
- C26 Dates locale-aware
- C27 Contenu EN (ECG/auscultation)
- C28 Unités standardisées

### D — UX mobile (10)
- D29 Refondre "Profil local" + sync
- D30 Unifier avatar
- D31 Recherche globale
- D32 Swipe-back natif
- D33 Mode focus
- D34 "Reprendre où vous étiez"
- D35 Pull-to-refresh
- D36 Simplifier filtres programme
- D37 Empty states engageants
- D38 Badges "Nouveau"

### E — Contenu et pédagogie (7)
- E39 Compléter 240 items
- E40 Compléter 41 chapitres orientation
- E41 SRS type Anki
- E42 Badges thématiques
- E43 Sous-thèmes précis
- E44 Examen blanc chronométré
- E45 Courbe de progression

### F — Accessibilité (5)
- F46 Audit axe DevTools
- F47 Contraste WCAG AA
- F48 Mode daltonien ECG
- F49 ARIA labels boutons icône
- F50 prefers-reduced-motion

### G — Technique (3)
- G51 Code-splitting routes
- G52 Tests moteur ECG
- G53 Monitoring (Sentry)

## Plan en 6 sessions

- Session 1 : A02, A01, A03, A05, A07 (business model)
- Session 2 : B11-B18 (crédibilité médicale)
- Session 3 : C21, C22, C26, C28 (i18n)
- Session 4 : D29-D38 (UX mobile)
- Session 5 : E39-E45 (contenu)
- Session 6 : F46-F50 + G51-G53 (a11y + tech)

## Contraintes par session

1. Inventaire de l'existant avant tout patch
2. 1 commit par item
3. Ne pas toucher aux modules ECG/auscultation/calculateurs
4. Documenter dans docs/DECISIONS.md
5. Terminer par typecheck + tests verts

## Métriques de succès

| Métrique | Avant | Cible |
|---|---|---|
| Couverture items Mada | 21% | 100% |
| Chapitres orientation | 5% | 100% |
| Sources citées | 0% | 100% |
| Langues | 1 | 2 |
| Trial jours | 0 | 7 |
| SRS | Non | Oui |
| WCAG AA | Non | Oui |
| Bundle | 1600 Kio | 900 Kio |
