# Roadmap — vers un produit sérieux (2026-11-12)

> Suite de `docs/ETAT-PROJET-2026-11-12.md` et `docs/CONTENU-PREMIUM-ECARTS.md`.
> Hypothèse de travail : ~10 h/semaine côté propriétaire + 1 relecteur médical
> (médecin ou interne senior) disponible 2–4 h/semaine. Les durées sont des
> semaines calendaires, pas des semaines de dev.
> ⚠️ Le contenu médical reste **gelé** jusqu'au cahier des charges : les phases 1
> et 2 démarrent par la relecture de l'existant, pas par de la production.

---

## 0. Ce que « sérieux » veut dire ici

Cinq critères vérifiables, dans cet ordre. Un produit qui en tient trois est une
démo convaincante ; quatre, un produit vendable ; cinq, une référence.

| # | Critère | Test de vérité |
| --- | --- | --- |
| S1 | **Sécurité et disponibilité** | peut-on restaurer la base après sinistre, et le sait-on ? |
| S2 | **Validation médicale** | une fiche affichée est-elle relue, datée, attribuée ? |
| S3 | **Complétude par spécialité** | un étudiant de gynéco ou de pédiatrie trouve-t-il son item **et** ses questions ? |
| S4 | **Mesure** | sait-on combien d'utilisateurs activent, révisent, paient, et où ils bloquent ? |
| S5 | **Honnêteté commerciale** | la page de vente ne promet-elle que ce qui est vrai ? |

Le produit actuel est fort sur S3 (couverture) et S5 (règle « ne promettre que le
payable »), moyen sur S1, faible sur S2 et S4.

## 1. Point de départ mesuré (12/11/2026)

| Élément | État |
| --- | --- |
| Couverture programme | 236/236 items (100 %), 1 848 sections, 659 sources |
| Validation | **0 fiche relue** (236 `pending-medical-review`, 43 démarches sans `reviewStatus`) |
| QCM | 817 questions, 74 decks Pro, **13 spécialités sans aucun deck** |
| Modules | 23 ECG, 10 sons, 13 lames, 5 cas d'imagerie (1 seule modalité) |
| Langue contenu | 100 % `fr` (UI en 4 langues, prix international affiché) |
| Sauvegardes | ❌ workflow de *test* de procédure seulement `db-recovery.yml` |
| Monitoring | ❌ aucun (pas de Sentry, pas d'uptime) |
| Hors-ligne | ❌ navigation jamais mise en cache (`public/sw.js`) → app inutilisable hors réseau |
| Back-office | ⚠️ deux portes : `/admin*` (`ADMIN_PASSWORD` + hash en base) et `admin-local/` (`is_admin`) |
| Production | Worker `optimus` — https://optimus.carabin.workers.dev |

---

## 2. Les phases

### Phase 0 — Le filet de sécurité (semaine 1)

**Objectif** : pouvoir se tromper sans perdre l'entreprise.

| Livrable | Détail | Effort |
| --- | --- | --- |
| Sauvegardes production | `pg_dump` quotidien chiffré des **deux** projets Supabase + rétention écrite ; test de restauration daté dans `docs/production-runbook.md` (RPO/RTO cibles) — ✅ **livré le 2026-11-12** : `scripts/backup-postgres.mjs`, `db-backup.yml` (restauration vérifiée à chaque exécution). Restent à faire côté propriétaire : créer les 3 secrets GitHub et activer le PITR des deux projets | 1 j |
| Monitoring d'erreurs | Sentry (ou équivalent) côté Worker + alerte sur 5xx ; sonde uptime externe sur `/api/health` — ✅ **livré le 2026-11-12** sans SDK ni dépendance : `GET /api/health`, alerte webhook sur 5xx (`server/lib/error-alert.ts`, anti-bruit 1/min), sonde planifiée (`uptime.yml`). Restent côté propriétaire : poser `ERROR_ALERT_WEBHOOK` et `UPTIME_ALERT_WEBHOOK` | 0,5 j |
| Back-office unique | `/admin*` autorisé par `is_admin` lu en base (session Supabase), chaque action journalisée avec `admin_user_id` ; `admin-local/` passe en outil de secours documenté | 1,5 j |
| Vérité commerciale | `/tarifs` et `/a-propos` : « fiches en cours de relecture médicale », jamais « validé » ; retirer toute promesse internationale non tenue | 0,5 j |
| Gates verts | `npm ci` puis `typecheck`, `test`, `build` sur `main` ; noter les échecs CI hérités par design | 0,5 j |

**Sortie de phase** : une restauration a été exécutée et datée ; une erreur 500
déclenche une alerte reçue ; une seule porte admin ; la copy ne ment pas.

### Phase 1 — Validation médicale, par vagues (semaines 2 à 4)

**Objectif** : rendre vraie la phrase « contenu relu ».

1. **Comité de relecture** : 1 médecin + 1 interne senior, grille à 5 axes
   (`docs/MEDICAL-AUDIT-PROTOCOL.md`), désaccords consignés.
2. **File priorisée** : les 60 items les plus fréquents à l'internat d'abord
   (cardio, infectio, pneumo, urgences, néphro, endocrino), puis vagues de 40.
3. **Traçabilité** : ajouter `reviewedBy`, `reviewedAt`, `contentVersion` aux
   fiches **et** aux démarches ; bascule `pending-medical-review → reviewed`
   uniquement par le relecteur ; affichage dans la fiche.
4. **Garde-fou** : `npm run content:check` refuse une fiche `published` sans
   reviewer ; `editorial-registry.json` devient la source de vérité du statut.

**Cible à 3 semaines** : **≥ 100 fiches relues** (≈ 40 % du catalogue, ≈ 80 %
des usages réels), 0 fiche affichée sans nom de relecteur.

**Risque principal** : un seul relecteur = goulot et point de défaillance.
Mitigation : vagues courtes, périmètre explicite, et si possible un second
relecteur rémunéré à la fiche.

### Phase 2 — Compléter les QCM par spécialité (semaines 4 à 6)

**Objectif** : que l'abonnement serve à toutes les spécialités du programme.

- 13 spécialités sans deck → **3 decks chacune** (facile/moyen/difficile),
  soit ~39 decks / ~390 questions.
- Chaque question : explication + source + difficulté L1–L3 + compétence.
- Priorité aux spécialités où les **fiches existent déjà** (gynéco 28, hémato 18,
  endocrino 11, pédiatrie 11) : le contenu de référence est là, seule la banque
  de questions manque.

**Sortie de phase** : chaque spécialité du programme a ≥ 1 deck ; ratio
≥ 6 questions/item sur les 60 items de la phase 1.

### Phase 3 — Un Premium qui se justifie (semaines 6 à 8)

| Livrable | Pourquoi | Effort |
| --- | --- | --- |
| **Statistiques par spécialité** (points faibles, taux de réussite, temps) dans `/profil` | différenciateur le plus attendu, données déjà collectées par deck | 1,5 j |
| **Examen blanc complet configurable** (nb d'items, durée, correction différée) | l'aperçu de 12 questions existe, la simulation complète non | 1,5 j |
| **Hors-ligne réel** : page de repli précachée + navigation « réseau puis repli », jamais de HTML périmé | une PWA qui exige le réseau n'est pas une PWA | 1,5 j |
| **Cas vitrine hebdomadaire** + quotas ECG/imagerie 5/j | complète le modèle freemium validé | 1 j |
| Normalisation données : 5 cas sans `access`, 3 fiches sans `specialty`, `reviewStatus` des démarches | angles morts silencieux | 0,5 j |

**Sortie de phase** : un utilisateur gratuit comprend exactement ce qui est
payant ; un abonné a trois raisons mesurables de rester (stats, examen, offline).

### Phase 4 — Profondeur des modules et décision international (semaines 9 à 12)

- **Imagerie** : 30 cas, 4 modalités (radio, TDM, échographie, IRM), `reviewedBy`
  obligatoire, 1 cas lié à une fiche existante.
- **Auscultation** : 20–30 sons (10 aujourd'hui), en couvrant les souffles
  valvulaires et les 3 sons pulmonaires manquants.
- **Histologie** : 30 lames, annotées, avec relecture.
- **Examens complémentaires** : 5 indications (structure déjà spécifiée dans
  l'ancien handoff : red flags → 1re intention → 2e intention → ce qu'on ne fait pas).
- **Décision i18n contenu** : soit traduire 20 fiches + 5 decks en anglais, soit
  retirer le prix international et l'argument « international ». Pas d'entre-deux.

### Phase 5 (optionnel) — Écoles et institutions

Après 3 mois de produit validé : licences multi-sièges, facturation, espace
enseignant, export de promotion. À ne pas ouvrir avant que S1–S4 tiennent.

---

## 3. Séquencement et dépendances

```text
S1  Phase 0 — filet (semaine 1)
       │  (rien ne se lance sans sauvegarde + alerte)
       ▼
S2  Phase 1 — relecture par vagues (semaines 2–4)
       │  dépend du relecteur, pas du dev
       ├──────────────┐
       ▼              ▼
S3  Phase 2 — QCM    Phase 3 — Premium + offline (semaines 6–8)
    par spécialité        (dev, parallélisable avec la relecture)
       │
       ▼
S4  Phase 4 — modules + i18n (semaines 9–12)
```

Deux règles de parallélisation : la relecture médicale n'attend jamais le dev ;
le développement ne démarre pas un nouveau module avant que le précédent soit
relu.

## 4. Tableau de bord (revue hebdomadaire, 30 min)

| KPI | Aujourd'hui | Objectif 3 mois |
| --- | --- | --- |
| Fiches relues | 0 / 236 | ≥ 120 / 236 |
| Spécialités avec ≥ 1 deck | 9 / 22+ | **toutes** |
| Questions par item (items relus) | 3,5 | ≥ 6 |
| Sauvegarde restaurée (date) | jamais | testée ≤ 90 jours |
| Erreurs 500 avec alerte | 0 % | 100 % |
| Activation (inscription → 1re session) | non mesuré | mesuré + cible 60 % |
| Conversion gratuit → payant | non mesuré | mesurée, cible ≥ 3 % |
| Modules vitrines (imagerie / histo / auscultation) | 5 / 13 / 10 | 30 / 30 / 25 |

## 5. Ce qu'on ne fait pas dans les 3 mois

- Pas de nouvelle fonctionnalité « IA clinique » ni de duels multijoueurs : ils
  ajoutent de la surface sans traiter S1–S4.
- Pas de refonte visuelle ni de nouvelle palette : le design system tient.
- Pas de nouveau module avant que les 236 fiches aient une politique de
  relecture exécutée.
- Pas de campagne marketing « contenu validé » avant la phase 1 terminée.
- Pas de B2B avant que S1 et S2 soient tenus.

## 6. Cadence

- 1 PR = 1 livrable de cette roadmap ; jamais contenu + infra dans la même PR.
- Toute décision structurante → `docs/DECISIONS.md`, même format que l'existant.
- Chaque vendredi : mettre à jour le tableau de bord ci-dessus et
  `docs/ETAT-PROJET-*.md` (sur le modèle du 12/11).
- Un gate rouge se corrige avant la phase suivante ; un gate qu'on ne peut pas
  lancer est un risque, pas un succès.
