# Contenu & offre Premium — ce qui manque (état mesuré au 2026-11-12)

> **But** : dire, sans complaisance et sans générer de contenu médical, ce qui
> sépare le catalogue actuel d'un produit Premium vendable et défendable.
> Tous les chiffres sont **mesurés** sur les fichiers du dépôt le 2026-11-12.
> ⚠️ Consigne projet toujours active : **aucun contenu médical n'est produit
> tant que le cahier des charges du propriétaire n'est pas fourni**. Ce document
> est un inventaire d'écarts, pas un plan de rédaction.

---

## 1. Ce qui est déjà au niveau (à ne pas sous-vendre)

| Élément | Mesure |
| --- | --- |
| Couverture du programme officiel | **236 / 236 items** du Concours National d'Internat 2025 (Madagascar) ont une fiche → **100 %** |
| Profondeur des fiches | 236 fiches, **1 848 sections**, **659 sources**, **0 fiche sans source** |
| Flashcards pathologies | **3 429 cartes** |
| Démarches enrichies | **43 / 43** chapitres (fiche + flashcards + carte mentale), **498 flashcards**, 43 mindmaps, 141 sources |
| QCM | 79 decks, **817 questions**, **100 % avec explication** |
| Cas cliniques | 46 dossiers (8 gratuits, 33 Pro, 5 sans champ `access`) |
| Modules spécialisés | 23 fiches ECG, 10 sons d'auscultation (5 foyers), 13 lames d'histologie, 5 cas d'imagerie, 3 domaines de valeurs de référence |
| UI | 4 langues (fr/en/es/pt), design system 4 palettes |

Le socle éditorial est rare : programme réel couvert à 100 %, sources sur chaque
fiche, explications sur chaque question. **Ce n'est pas la quantité brute qui
manque, c'est la validation et la répartition.**

---

## 2. Les écarts, par impact commercial

### 🥇 Écart n°1 — Aucune fiche n'est médicalement relue (bloquant de crédibilité)

| Contenu | Statut de relecture |
| --- | --- |
| 236 fiches pathologies | **236 / 236 `pending-medical-review`** |
| 43 démarches enrichies | **43 / 43 sans champ `reviewStatus`** |
| 5 cas d'imagerie | **0 / 5** avec `reviewedBy` |
| 13 lames d'histologie | **0 / 13** avec `reviewedBy` |

Un étudiant qui paie achète **une validation**, pas seulement du texte. Le
bandeau ambre « en attente de relecture » est aujourd'hui affiché sur 100 % du
catalogue : c'est honnête, mais c'est l'aveu que rien n'est validé. Les
garde-fous du dépôt (`docs/LEGAL-GUARDRAILS.md`, `IMAGING-SOURCES-POLICY.md`)
exigent d'ailleurs `reviewedBy` **avant** publication.

**Ce qui manque concrètement** : une campagne de relecture (médecin ou interne
senior) avec nom, date et version de contenu par fiche, puis bascule
`pending-medical-review → reviewed`.

### 🥈 Écart n°2 — Les QCM sont très concentrés sur deux spécialités

| Sujet de deck | Decks |
| --- | --- |
| Cardiologie | **36** |
| Infectiologie | **22** |
| Neurologie | 10 |
| Urgences | 6 |
| Anatomie, Dermatologie, Pharmacologie, Physiologie, Sémiologie | 1 chacun |

- **817 questions pour 236 items ≈ 3,5 questions/item** (Amboss > 10).
- **Aucun deck** pour : gynécologie-obstétrique, pédiatrie, néphrologie,
  hématologie, endocrinologie, pneumologie, gastro-entérologie, rhumatologie,
  urologie, psychiatrie, ophtalmologie, ORL, orthopédie — alors que les **fiches**
  couvrent ces spécialités (gynéco 28 fiches, hémato 18, cardio 19, infectio 19…).
- Conséquence : l'abonnement vend « 74 decks avancés », mais un étudiant de
  gynéco ou de pédiatrie n'a **aucune question** sur son item.

**Ce qui manque** : au minimum 3 à 5 decks par spécialité du programme
(≈ 40 à 60 decks supplémentaires, 400 à 600 questions), en priorité sur les
spécialités aujourd'hui à zéro.

### 🥉 Écart n°3 — Le contenu médical est monolingue (fr)

- 236 / 236 fiches ont `language: "fr"` ; aucune version EN/ES/PT du contenu.
- L'UI est traduite en 4 langues et le prix international (19 $/trimestre) est
  affiché : **on vend une promesse internationale avec un contenu français**.
- Les modules ECG / auscultation ne sont pas non plus traduits (item C27 de
  `MISSION-INTERNATIONAL.md`, jamais livré).

**Ce qui manque** : une décision explicite — soit retirer la promesse
internationale, soit traduire d'abord les 20 fiches et 5 decks les plus
consultatifs, en commençant par les modules spécialisés.

### 4. Imagerie : 5 cas, une seule modalité, aucune validation

- 5 cas, **tous `radio`** (radiographie thoracique) : ni TDM, ni échographie,
  ni IRM.
- **0 / 5** `reviewedBy`, alors que la spec du module l'exige.
- Aucune annotation de signe n'est exposée dans les données (le viewer existe).

Pour un produit Premium, 5 clichés ne constituent pas un module : c'est une
démonstration. Cible crédible : 30 à 50 cas répartis sur 4 modalités.

### 5. Histologie : 13 lames (MVP livré, catalogue non démarré)

- 13 lames, 0 `reviewedBy`, pas de progression par tissu/pathologie.
- La spec visait 3 à 5 lames MVP : l'objectif minimal est atteint, pas l'offre
  Premium.

### 6. Auscultation : 10 sons, 5 foyers

- Le moteur est solide (tracé + audio + accessibilité) mais le catalogue est
  court : 9 pathologies cardiaques + 1 rythme irrégulier, et 3 sons pulmonaires
  seulement (index `sounds` = 10 au total).
- Cible Premium : 20 à 30 sons couvrant les fiches respiratoires et les
  souffles valvulaires manquants.

### 7. Fonctionnalités Premium : une partie seulement est livrée

| Promesse (`docs/MODEL-FREEMIUM.md`) | État mesuré |
| --- | --- |
| 10 questions/jour en gratuit, compteur visible | ✅ livré (#485) |
| Explications verrouillées en gratuit | ✅ livré (#484) |
| Flashcards et cartes mentales réservées | ✅ gatées dans `/pathologie/$slug` et `/demarche/$id` |
| Examen blanc Premium | ⚠️ partiel : gate `OPTIMUS_PRO` + épreuve découverte de 12 questions |
| Statistiques avancées (points faibles, maîtrise par spécialité) | ❌ **absentes** — `/profil` n'expose aucune analyse par spécialité |
| Cas vitrine hebdomadaire en lecture seule | ❌ non implémenté |
| Quota ECG / imagerie 5 par jour | ❌ non implémenté (seul le quota global de 10 questions existe) |
| Essai 7 jours déclenché au pic d'engagement (streak 3–5) | ⚠️ essai existant, déclenchement à vérifier |

**Ce qui manque** : les statistiques par spécialité sont le différenciateur le
plus attendu (« où est-ce que je perds des points ? ») et le moins coûteux à
construire, puisque les réponses sont déjà enregistrées par deck.

### 8. Incohérences de données à normaliser

- **5 cas cliniques sans champ `access`** (`CARDIO-FA-001`, `CARDIO-SCA-001`,
  `PNEUMO-ASTHME-001`, `HEPATO-CIRRHOSE-001`, `CHIR-APPENDICITE-001`) : ils sont
  traités Pro par défaut dans `hasClinicalAccess`, donc **invisibles pour un
  compte gratuit** sans que ce soit annoncé.
- **43 démarches sans `reviewStatus`** : impossible d'afficher un état de
  relecture, même quand il existera.
- **3 fiches pathologies sans spécialité** (`specialty: undefined`) : elles
  sortiront des filtres par spécialité et des statistiques.

### 9. Module absent : « Examens complémentaires »

Le handoff du 2026-11-01 le prévoyait (red flags → 1re intention → 2e
intention → ce qu'on ne fait pas). Il n'existe **aucune route ni donnée** pour
ce module ; les 43 démarches couvrent le raisonnement diagnostique, pas la
prescription d'examens. C'est un manque réel pour un interne, et un argument
Premium facile à vendre.

### 10. Valeurs de référence : 3 domaines

`biochimie`, `hematologie`, `ionogramme` seulement, alors que 78 calculateurs
sont disponibles. Un Premium « référence » attend au minimum hématologie,
biochimie, ionogramme, gaz du sang, hémostase, LCR.

---

## 3. Ordre de priorité recommandé

| # | Chantier | Pourquoi d'abord | Effort (contenu/validation) |
| --- | --- | --- | --- |
| 1 | **Relecture médicale des 236 fiches** (au moins les 60 items les plus fréquents) | Sans elle, rien n'est « Premium » au sens médical ; garde-fou légal | 60 relectures (médecin) |
| 2 | **QCM des spécialités à zéro** (gynéco, pédiatrie, néphro, hémato, endocrino, pneumo, gastro) | L'abonnement est aujourd'hui inutilisable pour ces étudiants | ~40 decks / 400 questions |
| 3 | **Statistiques par spécialité** dans `/profil` | Différenciateur immédiat, données déjà présentes | 1 sprint dev |
| 4 | **Normalisation des données** (5 cas sans `access`, 3 fiches sans spécialité, `reviewStatus` des démarches) | Corrige des angles morts silencieux | 0,5 jour dev |
| 5 | **Décision i18n contenu** (traduire 20 fiches ou retirer la promesse) | Évite une promesse commerciale non tenue | décision propriétaire |
| 6 | **Étendre imagerie (4 modalités) et auscultation (20–30 sons)** | Modules vitrines, aujourd'hui en démonstration | 25 cas + 15 sons |
| 7 | **Module Examens complémentaires** (5 indications) | Manque identifié pour les internes | 5 indications |
| 8 | **Cas vitrine hebdomadaire + quotas ECG/imagerie** | Complète le modèle freemium | 1 sprint dev |

---

## 4. Règle de vérité commerciale

Tant que les écarts 1 et 2 ne sont pas traités, la page `/tarifs` ne doit pas
promettre « toutes les spécialités » ni « contenu validé » : elle doit dire
« 236 items couverts, fiches en cours de relecture médicale ». C'est la même
règle que celle déjà appliquée au paiement (« n'annoncer payable que ce qui est
réellement payable ») — ici : **n'annoncer validé que ce qui est relu**.
