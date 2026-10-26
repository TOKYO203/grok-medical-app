# PROTOCOLE D'AUDIT IA — Contenu médical Optimus (v1.0)

> Statut : obligatoire avant toute publication de fiche.
> Pointeur : AGENTS.md § "Audit IA du contenu médical".

## Objectif
Détecter avant relecture humaine les erreurs médicales, incohérences et hallucinations. Ne remplace pas la signature d'un médecin, réduit le bruit.

## Cadre
- Modèle : Claude Sonnet 4, GPT-5, Gemini 2.5 Pro (premium) / Haiku (basse priorité)
- 1 fiche = 1 audit (pas de batch dans un prompt)
- Rapport : docs/MEDICAL-AUDIT-LOG.md
- Priorisation : scripts/content-risk-audit.mjs

## 5 axes à vérifier

### Axe 1 — Cohérence médicale (OMS/HAS/SPILF 2023-2025)
Posologies conformes ? Seuils biologiques exacts ? Scores corrects ? Définitions justes ?

### Axe 2 — Cohérence interne
Contradictions dans la fiche ? Unités cohérentes ? Pourcentages compatibles ?

### Axe 3 — Cohérence sources
Source traite du sujet ? Récente (<3 ans) ou obsolète (>5 ans) ? Manquantes ?

### Axe 4 — Contexte Madagascar
Pathologie pertinente ? Traitements disponibles ? Données locales à ajouter ?

### Axe 5 — Anti-hallucination
Chiffres sans source ? DOI fictif ? Guideline inexistante ? "Étude récente" sans ref ?

## Niveaux de confiance (obligatoires dans le rapport)
- 🟢 HIGH : certitude (guidelines connues)
- 🟡 MEDIUM : probable, à vérifier
- 🔴 LOW : suspect
- ⚪ UNVERIFIABLE : ne peut pas juger (URL, actualité)

## Ce que l'IA NE fait PAS
- Inventer une correction (supposition)
- Affirmer qu'une URL répond 200
- Juger le style/pédagogie
- PASS sans vérifier les 5 axes

## Format du rapport
Voir docs/MEDICAL-AUDIT-TEMPLATE.md (dans le même fichier)

---

## Workflow

1. Fiche existe (status draft ou published)
2. Audit IA via prompt standard
3. Rapport dans MEDICAL-AUDIT-LOG.md
4. Corrections appliquées
5. Relecture humaine (interne ou médecin)
6. status: reviewed puis published + reviewedBy + reviewedAt

## Priorisation

scripts/content-risk-audit.mjs :
- score >= 8 : critique, modèle premium
- score 5-7 : moyenne, modèle standard
- score < 5 : basse, modèle économique

## Critères de sortie (fiche publiable)

- Audit IA : PASS ou PASS_WITH_NOTES
- Corrections LOW/Fail appliquées
- Points UNVERIFIABLE vérifiés manuellement
- Relecture humaine signée (reviewedBy + reviewedAt)
- npm run content:check vert

## Prompt standard (a coller avec le JSON)

Lis docs/MEDICAL-AUDIT-PROTOCOL.md.
Audit la fiche selon les 5 axes.
Aucune correction par supposition.
Signaler UNVERIFIABLE pour URLs et actualite.
Ne pas juger le style.

Fiche : [JSON ici]

## Revision

Nouvelle classe d'erreur : enrichir axes.
Nouveau pays ou specialite : enrichir axe 4.
Revision trimestrielle.
