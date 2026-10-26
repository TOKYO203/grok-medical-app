# LANDING V2 — Spécification de la page d'accueil (Semaine 2, Flux B)

**Date** : 2026-10-26
**Statut** : spec + copy intégrale prêtes pour implémentation React — positionnement validé avec le propriétaire
**Documents liés** : [`POSITIONING-V2.md`](./POSITIONING-V2.md) (source de toute la copy),
[`ROADMAP-V2-STRATEGIC.md`](./ROADMAP-V2-STRATEGIC.md) (§ Point 2 — sections obligatoires),
[`TRUST-LAYER-V2.md`](./TRUST-LAYER-V2.md) (trust badges)

> Livrable de la **Semaine 2** : landing page V1 (hero, value prop, trust, pricing, CTA).
> La copy ci-dessous reprend mot pour mot `POSITIONING-V2.md` § 3 — toute modification
> doit y être répercutée pour garder une source unique.

---

## 1. Sections obligatoires (ordre imposé par la roadmap)

```
hero → trust badges → 3 piliers de valeur → 3 personas → preuve de qualité → pricing → FAQ → CTA final
```

## 2. Copy intégrale (FR = langue primaire, EN = variante)

### 2.1 Hero
- **Headline FR** : « Réussissez l'internat avec des fiches sourcées, pas des photocopies. »
- **Subheadline FR** : « Le programme d'internat de Madagascar, item par item : chaque fiche cite sa source, chaque question est expliquée, votre journée de révision est déjà planifiée. »
- **CTA primaire** : « Commencer gratuitement » (1 fiche + 1 cas) · **CTA secondaire** : « Voir le programme couvert »
- **EN** : headline/subheadline de `POSITIONING-V2.md` § 3.1 — "Clinical reasoning for the next generation of medical learners."

### 2.2 Trust badges (sous le hero, 4 items)
567 questions expliquées **et** sourcées · sources OMS/HAS/sociétés savantes section par section · statut de relecture médicale affiché · « Outil pédagogique, pas outil de diagnostic ».

### 2.3 Les 3 piliers de valeur
1. **Le programme réel** — « Révisez exactement les 240 items du concours, pas un programme étranger. »
2. **Tout est sourcé** — « Chaque affirmation affiche sa source et son statut de relecture. »
3. **Toujours savoir quoi réviser** — « Une file de révision unique. Une session = 12 minutes. »

### 2.4 Personas (3 blocs courts, citation = le message d'achat)
Miora (internat Madagascar) : « Ton item du programme, avec sa source, prêt à réviser aujourd'hui. » · Jean-Marc (EDN/francophone) : « Des questions cliniques expliquées et sourcées, en français, au prix d'un café par mois. » · Pr Ravelo (établissement) : lien vers `/institutionnel` (Semaine 7).

### 2.5 Preuve de qualité
Tableau de 4 mesures (reprise `PRODUCT-VISION.md` § 1.1) : 567/567 questions expliquées+sourcées · 110 fiches signes, 220 sources HTTPS · 78 calculateurs, 9 catégories · 4 langues (fr/en/es/pt).

### 2.6 Pricing
**Gratuit** : 1 fiche + 1 cas + essai 7 jours · **Premium** : 15 000 Ar/trimestre (Mobile Money) ou 19 €/3 mois (carte) · **Institution** : « Pour votre école » → `/institutionnel`.

### 2.7 FAQ (5 questions)
Couverture réelle du programme ? · Est-ce fiable médicalement ? · Quels moyens de paiement ? · Ça marche hors ligne / connexion instable ? · Qui relit le contenu ?

### 2.8 CTA final
« Ton item t'attend. » + CTA « Commencer gratuitement ».

## 3. Notes d'implémentation

| Sujet | Contrainte |
| --- | --- |
| i18n | catalogues existants fr/en/es/pt — l'es est un miroir du FR en attendant une relecture hispanophone |
| SEO | title FR + description = subheadline ; Open Graph avec la carte de session existante |
| Tracking | CTA primaire = `landing_cta_click` (croisé avec le KPI « Landing → CTA 5–10 % » de `ANALYTICS-FUNNEL-V2.md`) |
| Performance | landing sans lib lourde ; SSR existant conservé ; budget JS à ne pas dégrader |
| Règles copy | `POSITIONING-V2.md` § 3.4 — bénéfice utilisateur, apprentissage clinique, zéro jargon tech |

## 4. Critères d'acceptation

- [ ] Les 8 sections présentes dans l'ordre § 1
- [ ] Copy FR conforme mot pour mot à `POSITIONING-V2.md` (toute divergence justifiée)
- [ ] Test 5 utilisateurs : promesse reformulée en < 10 s
- [ ] CTA instrumenté ; taux de clic mesurable dès la mise en ligne
- [ ] 4 langues livrées sans casse (CI i18n)
