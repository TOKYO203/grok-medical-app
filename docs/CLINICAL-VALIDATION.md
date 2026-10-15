# Protocole de validation clinique du contenu

Ce document décrit publiquement comment le contenu médical d'Optimus est produit,
contrôlé et corrigé. Il est résumé dans l'application sur la page `/validation-clinique`.

- Version du contenu médical : `v2026.10-Mada` (source unique : `src/content/medical-version.ts`)
- Registre éditorial mis à jour le : 2026-10-08 (`src/content/data/editorial-registry.json`)
- Dernière mise à jour de ce protocole : 2026-10-15

## Position

Optimus est un **outil éducatif** destiné aux étudiants en médecine. Il ne pose aucun
diagnostic, ne prescrit rien et ne fournit aucune conduite à tenir. Une suite de tests
automatisés ne constitue jamais, à elle seule, une validation médicale : la relecture
humaine reste la règle, et sa trace est publique.

## Cycle de validation

1. **Sources par fiche.** Chaque question, cas clinique et deck référence au moins une
   source médicale (portails officiels, sociétés savantes), rendue sous le contenu par
   `MedicalSources` et `ContentTrustCard`. Le garde-fou `scripts/content-quality.test.mjs`
   rejette toute question sans source.
2. **Garde-fous automatisés.** `scripts/editorial-registry.test.mjs` verrouille le registre
   éditorial (identités, périmètres, chevauchements déclarés) ; `scripts/deck-review-status.test.mjs`
   garantit que le statut de revue affiché dans l'UI reflète exactement le registre.
3. **Relecture humaine.** Les items prioritaires sont relus par un médecin. Le statut de
   chaque deck est public et daté, sans sur-claim :
   - `structural_only` — structure vérifiée, relecture médicale prioritaire en cours ;
   - `priority_items_reviewed` — items prioritaires relus par un médecin (date publiée) ;
   - `fully_reviewed` — revue complète, avec relecteur et sources de revue déclarés.
4. **Signalement.** Une erreur signalée depuis l'application (bouton de signalement sous
   le contenu) déclenche la procédure `docs/medical-content-correction.md` : masquage
   immédiat du contenu concerné, correction par un relecteur humain qualifié, puis
   `npm run release:check` avant republication.

## Optimus Clinical AI

« Optimus Clinical AI » est un **tuteur pédagogique** : il commente la progression et
oriente la révision. Il ne produit ni diagnostic, ni conduite à tenir, et n'est pas un
dispositif médical au sens réglementaire.

## Références de lecture créditées

- **ECG** : J. Hampton, *The ECG Made Easy* (Elsevier) — crédit affiché sur la page ECG ;
  le moteur `src/lib/ecg/analyzeEcg.ts` cite la même référence.
- **Cardiologie** : recommandations de la Société européenne de cardiologie (ESC).
- **Sources généralistes** : portails référencés dans `src/content/medical-sources.ts`.

## Version du contenu

La version du contenu médical (`v2026.10-Mada`) est indépendante de la version de
l'application : elle est incrémentée à chaque cycle de relecture documenté, et affichée
dans le pied de la page « À propos » ainsi que sur les pages de gouvernance.
