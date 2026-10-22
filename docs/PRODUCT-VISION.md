# Optimus — Vision produit & roadmap stratégique (V1.0 → V2.0)

**Date** : 2026-10-22
**Auteur** : revue technique + produit, à partir de l'état réel du dépôt
**Statut** : proposition — à valider avant tout développement
**Documents liés** : [`V1-READINESS.md`](./V1-READINESS.md) (bloquants techniques),
[`ADMIN-DASHBOARD-QA.md`](./ADMIN-DASHBOARD-QA.md), [`DECISIONS.md`](./DECISIONS.md)

> ⚠️ `CONTEXT.md` n'existe pas dans le dépôt. Ce document s'appuie sur une lecture directe
> du code et sur des mesures exécutées le 2026-10-22 (volumes de contenu, distribution par
> spécialité, couverture du programme, présence d'analytics/d'emails, état des paiements).

---

## 0. Le concurrent n'est pas celui qu'on croit

Avant les faiblesses, une clarification qui oriente tout le reste.

On se compare instinctivement à **Amboss**, **UWorld** ou **Anki**. Ce ne sont pas les bons
adversaires pour un étudiant en médecine à Antananarivo :

| Adversaire supposé | Pourquoi ce n'est pas lui |
| --- | --- |
| Amboss / UWorld | 15-40 €/mois, contenu anglais/allemand, orienté USMLE/ECN. Hors de portée économique et culturellement décalé du programme malgache. |
| Anki | Gratuit, mais demande de **fabriquer ses propres cartes** — 30 à 60 h de travail avant le premier bénéfice. |
| Prépa privée | 1 000 000+ Ar, présentiel, réservée à une élite. |

**Le vrai concurrent, c'est le polycopié photocopié + le groupe WhatsApp de promo + les
vidéos YouTube.** C'est gratuit, c'est en français, c'est déjà dans la main de l'étudiant, et
ça ne demande aucun apprentissage.

Conséquence stratégique : le produit ne doit pas être « un Amboss moins cher ». Il doit être
**le remplaçant du polycopié** — c'est-à-dire gagner sur trois terrains seulement :

1. **couverture du programme réel** (l'étudiant doit trouver SON item, pas un item d'un
   programme français) ;
2. **« quoi réviser maintenant »** (le polycopié ne répond pas à cette question) ;
3. **la confiance** (une source vérifiable là où la photocopie n'en a aucune).

Tout le reste — QCM format EDN, gamification, IA — est secondaire tant que ces trois
piliers ne sont pas tenus. Cette hiérarchie structure la roadmap de la § 3.

---

## 1. Diagnostic de l'existant, sans complaisance

### 1.1 Ce qui est réellement fort (mesuré)

Il faut le dire avant les critiques, parce que ces acquis sont rares et coûteux, et qu'ils
constituent le socle sur lequel construire :

| Atout | Mesure du 2026-10-22 |
| --- | --- |
| Questions **toutes** expliquées **et** sourcées | **567 / 567** avec `explanation` + `sources` |
| Signes & syndromes sourcés | 110 fiches, **220 sources HTTPS** |
| Fiches Nosographie section par section sourcées | 23 fiches, **174 / 174 sections** |
| Sécurité du contenu payant | jeton HS256, `private/content`, 401 mesuré, fail-closed |
| Paiement idempotent | PK `(provider, event_key)` + `ON CONFLICT DO NOTHING`, rejeu sûr |
| Quotas distribués | 6/6 routes sensibles, Upstash réellement configuré |
| Calculateurs médicaux | **78 scores**, 9 catégories |
| Multilingue | fr / en / es / pt (4 catalogues synchronisés) |

Un concurrent ne copie pas ça en un week-end. **La crédibilité éditoriale est déjà là** ;
c'est la couverture et la boucle d'usage qui manquent.

### 1.2 Les 3 faiblesses majeures

#### Faiblesse n°1 — La couverture du programme est de 9,6 %, et 65 % du contenu est en cardiologie

C'est de très loin le problème le plus grave, et il est invisible dans les démos.

| Mesure | Valeur |
| --- | --- |
| Items au programme officiel (Madagascar 2025) | **240** (30 spécialités) |
| Items couverts par une fiche Nosographie | **23** → **9,6 %** |
| Decks de QCM | 54 · **567 questions** |
| Répartition des decks par spécialité | **Cardiologie 35 (65 %)**, Clinique 15, Fondamental 2, Aigu 1, Thérapeutique 1 |
| Fiches « démarche » enrichies | 2 (douleur thoracique, fièvre) |

Le parcours de l'étudiant est donc prévisible :

> Il ouvre l'app pour réviser **son** item de néphrologie (ou de pédiatrie, ou de gynéco).
> Il ne le trouve pas. Il retourne à son polycopié. **Il ne revient pas.**

Ce n'est pas un défaut d'interface : **le contenu est le produit**. Une plateforme de
référence se juge à sa couverture, pas à ses animations. 567 questions pour 240 items
(≈ 2,4 par item) est un socle, pas un catalogue — Amboss en compte plus de 10 000.

C'est aussi une **bonne nouvelle** : le moteur est prêt (9 spécialités câblées, escaliers,
carrefours, gating, sources). Ajouter une fiche est aujourd'hui une opération de contenu,
pas de développement. Le levier est éditorial, pas technique.

> ⚠️ Blocage à lever : `AGENTS.md` interdit de produire du contenu médical tant que le
> cahier des charges éditorial n'est pas fourni. **Ce document ne le contourne pas** ; il
> constate que c'est le facteur limitant n°1 et propose (§ 5.3) de débloquer la production
> avec un gabarit + un process de relecture, pas de générer à l'aveugle.

#### Faiblesse n°2 — On ne mesure rien, et on ne relance personne

| Élément | État mesuré |
| --- | --- |
| Analytics produit (PostHog, Plausible, Umami, GA) | **aucun** |
| Envoi d'e-mails (Resend, SMTP, SendGrid) | **aucun** — `/contact` ouvre un simple `mailto:` |
| Relance J+1 / J+3 / J+7 | inexistante |
| Rappel de série (streak) | inexistant (la série est calculée, jamais notifiée) |
| Taux d'activation / rétention / conversion | non mesurables |

Conséquence : **on ne saura pas si le produit marche**. Un étudiant qui s'inscrit, lit une
fiche et disparaît est aujourd'hui indistinguable d'un étudiant qui revient tous les jours.
Sans instrumentation, chaque décision de la roadmap est une opinion — y compris celle-ci.

L'absence d'e-mail est le trou le plus coûteux : dans ce marché, **WhatsApp et e-mail sont
les deux seuls canaux de rappel**. Un étudiant qui a payé 15 000 Ar et qui oublie l'app au
bout de 4 jours est un remboursement moral et un avis négatif.

#### Faiblesse n°3 — « Que faire maintenant ? » n'a pas de réponse unifiée

Le produit est riche mais **large** : 44 routes, 8 carrefours « sujet », 5 formats de
contenu (QCM, fiches, signes, ECG, auscultation), 78 calculateurs.

| Élément | État |
| --- | --- |
| Répétition espacée (SRS) | existe mais **couvre uniquement les QCM** (`isDue` sur `ReviewStats`) |
| Flashcards de Nosographie | swipe-deck **sans intervalle** (aucun SRS) |
| Signes & syndromes | session propre, **ne remonte pas** dans les révisions |
| Objectif du jour | existe, mais concurrencé par 8 points d'entrée |
| Statistiques par spécialité | **absentes** |
| « Reprendre où j'étais » | existe par deck, pas au niveau de la journée |

Anki gagne sur un point unique et décisif : **il y a une file d'attente, et elle est vide
quand on a fini**. Optimus n'a pas encore cette file unifiée : l'étudiant doit décider
lui-même quoi faire — exactement ce que le polycopié lui demande déjà.

### 1.3 Quick Wins (impact immédiat sur la rétention, effort ≤ 3 jours chacun)

Classés par rapport impact / effort. Chacun se mesure avec la § 6.

| # | Quick win | Pourquoi ça retient | Effort |
| --- | --- | --- | --- |
| QW1 | **« Ma journée » : une seule file de révision** (QCM dus + flashcards dues + 1 signe + 1 fiche à lire), un bouton, un compteur qui descend à 0 | transforme 8 points d'entrée en 1 geste quotidien ; c'est le geste qui crée l'habitude | 4-5 j |
| QW2 | **Instrumentation + e-mails de rappel** (activation, J+3, J+7, série cassée) | récupère les étudiants perdus ; sans ça, aucun autre gain n'est visible | 2-3 j |
| QW3 | **Statistiques par spécialité dans le profil** (maîtrise, items couverts, lacunes) | donne une raison de revenir : « il me reste 3 items en néphro » | 2 j |
| QW4 | **Onboarding → première fiche gratuite en 1 clic** (et non un tableau de bord) | l'activation J0 est le meilleur prédicteur de rétention | 1 j |
| QW5 | **Carte de partage de fin de session** (image OG « 12/12 · série de 6 jours ») | WhatsApp-first : chaque session devient une acquisition | 1-2 j |
| QW6 | **Sauvetage de série** (1 « gel » offert/semaine) | la culpabilité de casser une série fait fuir ; le gel la neutralise | 0,5 j |

---

## 2. Les 4 piliers d'une plateforme de référence

### Pilier 1 — Pédagogie & contenu

**Acquis** : 567 questions expliquées et sourcées, 23 fiches section-par-section sourcées,
110 signes, 78 calculateurs, une progression par niveaux (escaliers), examen chronométré
(12 questions / 10 min, format fixe).

| Manque | Détail | Priorité |
| --- | --- | --- |
| **Couverture du programme** | 9,6 % des items ; 30 spécialités, 65 % du contenu en cardio | **P0** |
| **SRS réel sur les flashcards** | swipe sans intervalle ; Anki gagne ici, et c'est le cœur du marché | **P1** |
| **QCM au format EDN** | aujourd'hui : choix unique + explication. Format EDN = questions à réponses multiples, « bonne réponse parmi », correction argumentée, notation | P1 |
| **Mode examen configurable** | chronométré mais figé (12 q / 10 min) ; il faut choisir spécialité, nombre d'items, durée, correction différée | P1 |
| **Statistiques d'apprentissage** | pas de courbe, pas de taux de réussite par item, pas de détection des lacunes | **P1** |
| **Annales malgaches** | aucun sujet d'examen réel ; c'est l'attente n°1 d'un étudiant avant l'internat | P1 |
| **Révision ciblée par item du programme** | `/programme` liste 240 items mais ne propose pas « réviser cet item » | P1 |
| **Contenu adaptatif** | la difficulté et la répétition ne s'adaptent pas au niveau réel | P2 |
| **Tuteur IA encadré** | proxy `/api/ai-stream` existe, non exploité pédagogiquement | P2 |

### Pilier 2 — Expérience utilisateur

**Acquis** : thème clair/sombre par tokens, design system (tokens, tones), navigation mobile
soignée, panier de recherche (Cmd+K), scroll infini maîtrisé, SSR, 4 langues, PWA installable.

| Manque | Détail | Priorité |
| --- | --- | --- |
| **Hors ligne** | le service worker ne cache **aucun document** → app inutilisable sans réseau ; dans un contexte de connexion instable, c'est éliminatoire | **P0** |
| **Une seule porte d'entrée quotidienne** | 8 carrefours, 5 formats : charge cognitive | **P1** |
| **Onboarding guidé jusqu'à l'acte** | l'onboarding collecte le niveau/l'objectif puis dépose l'étudiant sur un tableau de bord, pas sur une fiche | **P1** |
| **Error boundaries par écran** | une fiche qui plante remplace toute l'app | P1 |
| **Gamification sociale** | XP, 11 badges et séries existent, mais **classement fictif** (honnêtement étiqueté « démonstration ») et aucune communauté | P2 |
| **Malagasy** | 4 langues, pas le malgache — pourtant langue de soutien scolaire d'une partie des étudiants | P2 |
| **Accessibilité** | WCAG AA partiel (contrastes testés), navigation clavier et lecteurs d'écran à auditer | P2 |
| **Performance perçue** | bon SSR, mais budget JS à 2,1 Mo : à surveiller | P2 |

### Pilier 3 — Confiance & communauté

**Acquis** : sources affichées section par section, journal de versions public
(`/changelog`), page conseil éditorial, `medical-version.ts`, statut de relecture affiché,
transparence sur les données (`/donnees`).

| Manque | Détail | Priorité |
| --- | --- | --- |
| **Validation médicale** | `reviewStatus: pending-medical-review` sur toutes les fiches ; bandeau affiché (honnête) mais un produit « de référence » exige des relecteurs nommés | **P0** (crédibilité) |
| **Signalement accessible partout** | bouton présent **uniquement** sur la page deck, et il écrit dans une table que le back-office ne lit pas | **P1** |
| **Boucle de correction visible** | un signalement ne produit aujourd'hui aucune réponse à l'auteur | P1 |
| **Avis / retours étudiants** | aucun système de note par fiche, aucune preuve sociale | P1 |
| **Communauté** | aucune interaction entre étudiants (ni entraide, ni groupe de promo, ni défi) | P2 |
| **Classement réel** | fictif ; à basculer ou à retirer du produit public | P2 |

### Pilier 4 — Monétisation & rétention

**Acquis** : offre trimestrielle (15 000 Ar ≈ 3,2 €), paiement carte international
(Lemon Squeezy, 19 € / 3 mois), Mobile Money encadré par le back-office, jeton de contenu,
essai 7 jours, licences vérifiées cryptographiquement.

| Manque | Détail | Priorité |
| --- | --- | --- |
| **Encaisser, tout simplement** | la variante Lemon Squeezy est `pending` → le bouton carte renvoie vers l'accueil boutique (cf. `V1-READINESS` P0-3) | **P0** |
| **Abonnement Mobile Money vendable** | l'offre trimestrielle n'est pas dans `orderProduct()` : payer 15 000 Ar ne produit aucune licence (ABO-10) | **P0** |
| **E-mails de cycle de vie** | aucun : bienvenue, relance, échéance, réactivation | **P1** |
| **Codes promo / bourses** | aucun moyen de faire une offre ciblée (écoles, promos, parrainage) | P1 |
| **Parrainage automatisé** | aujourd'hui : partager un lien puis **écrire à `/contact`** pour validation manuelle | P1 |
| **Relance d'échéance** | rien avant l'expiration : la conversion se joue au dernier jour, à l'aveugle | P1 |
| **Offre École / licences multi-sièges** | mentionnée, non outillée (facturation, sièges, tableau de bord établissement) | P2 |
| **Mesure du revenu** | pas de MRR, churn, LTV, cohortes | P2 |

---

## 3. Roadmap priorisée

Effort exprimé en jours-homme de développement (hors production de contenu médical).

### P0 — Bloquants V1.0 « production » (déjà détaillés dans `V1-READINESS.md`)

| # | Chantier | Effort | Impact |
| --- | --- | --- | --- |
| P0-1 | Exécuter `003-admin-dashboard.sql` (GRANT + RLS + anti-escalade `is_admin`) | 0,25 j | back-office opérationnel, faille fermée |
| P0-2 | Publier la variante Lemon Squeezy (`pending` → `published`) | 0,1 j | **rend l'achat carte possible** |
| P0-3 | Rendre l'abonnement Mobile Money vendable (ABO-10 : `orderProduct`, contrainte SQL) | 1 j | **rend l'offre principale possible** |
| P0-4 | Sauvegardes : plan Supabase (2 projets), `pg_dump` quotidien hors site, **restauration testée** | 1 j | survie de l'activité |
| P0-5 | Un seul back-office, actions attribuées à `admin_user_id` | 1 j | traçabilité, révocabilité |
| P0-6 | Bascule Lemon Squeezy live (clés, **nouveau secret webhook**, rebuild, purge des tests) | 0,5 j | encaissement réel |
| P0-7 | Unifier le signalement (une table, bouton sur fiches + profil) | 0,5 j | confiance + boucle qualité |
| P0-8 | Relecture médicale par 1-2 praticiens nommés | éditorial | crédibilité « référence » |

**Total P0 : ≈ 4,5 jours de dev** + 2 actions de dashboards + relecture externe.

### P1 — Must-have V1.5 « compétitivité » (sans quoi les étudiants partent)

| # | Chantier | Effort | Pourquoi c'est décisif |
| --- | --- | --- | --- |
| P1-1 | **Couverture du programme : 240 items** (gabarit + production outillée + relecture) | éditorial | le seul chantier qui change la catégorie du produit |
| P1-2 | **« Ma journée » : file de révision unifiée** (QCM + flashcards + signes) | 4 j | crée l'habitude quotidienne |
| P1-3 | **SRS réel sur les flashcards** (intervalle, ease, oubli) | 2 j | neutralise l'argument Anki |
| P1-4 | **Instrumentation + e-mails de cycle de vie** (Resend + 5 séquences) | 3 j | rend la rétention mesurable et réparable |
| P1-5 | **Statistiques par spécialité** (maîtrise, items couverts, lacunes, courbe) | 2 j | raison de revenir + argument Premium |
| P1-6 | **Mode examen configurable** (spécialité, nb d'items, durée, correction différée) | 2 j | usage réel en prépa |
| P1-7 | **Hors ligne** (page de repli + navigations réseau-first sans HTML périmé) | 1,5 j | connexion instable = marché réel |
| P1-8 | **Bouton « réviser cet item »** depuis `/programme` | 1 j | comble le trou le plus visible |
| P1-9 | **Parrainage automatisé** (code, suivi, récompense) | 1,5 j | croissance organique |
| P1-10 | Error boundaries par écran + observabilité (Sentry) | 1 j | ne plus perdre un utilisateur sur un bug |

**Total P1 : ≈ 18 jours de dev** (+ travail éditorial en parallèle).

### P2 — WOW effect V2.0 « référence »

| # | Chantier | Effort | Effet |
| --- | --- | --- | --- |
| P2-1 | **Mode EDN complet** (QCM à réponses multiples, notation, correction argumentée) | 4 j | aligne le format sur les attentes francophones |
| P2-2 | **Annales malgaches + sujets blancs** avec correction et classement de difficulté | éditorial + 2 j | attente n°1 avant l'internat |
| P2-3 | **Classement & communauté réels** (promo, école, défis hebdomadaires) | 4 j | boucle sociale, rétention |
| P2-4 | **Révision adaptative** (algorithme qui choisit la question suivante selon les lacunes) | 4 j | « je ne peux plus réviser sans » |
| P2-5 | **Tuteur IA encadré** (explications, reformulation, quiz généré **à partir du contenu validé**) | 3 j | valeur perçue forte, coût maîtrisé par quota |
| P2-6 | **Offre École** (sièges, facturation annuelle, tableau de bord établissement) | 4 j | revenus B2B, plus stables que le B2C |
| P2-7 | **Export Anki / CSV** | 1 j | migration sans friction depuis Anki |
| P2-8 | **Version malgache** du parcours et de l'interface | 3 j | inclusion, différenciation locale |
| P2-9 | **Tableau de bord qualité contenu** (signalements, délais, taux de correction) | 1,5 j | preuve de sérieux éditorial |
| P2-10 | **Notifications push** de révision | 2 j | rappel sans dépendre de l'e-mail |

---

## 4. Recommandation personnelle — 2 semaines, développeur solo

Si je devais choisir **trois** chantiers seulement, en maximisant la probabilité de succès
commercial (et non l'élégance technique), ce serait ceux-ci :

### 🥇 1. Encaisser (P0-2, P0-3, P0-6) — 2 jours

C'est brutal, mais un produit sans revenu n'est pas une entreprise : c'est un projet. Le
tunnel d'achat existe déjà à 90 % — il manque **un statut à changer chez Lemon Squeezy** et
**une ligne dans `orderProduct()`** pour que l'abonnement Mobile Money produise une licence.
Laisser la vente fermée deux semaines de plus pour polir des écrans serait la pire décision
possible.

**Fait quand** : un achat carte réel de 19 € et un paiement MVola de 15 000 Ar produisent
chacun une licence `active` visible dans le back-office, avec la bonne échéance.

### 🥈 2. Savoir ce qui se passe (P1-4) — 3 jours

Analytics + 5 e-mails (bienvenue, J+3 relance, J+7 « votre série », échéance −3 j, contenu
mis à jour). Sans instrumentation, je ne peux pas savoir si le chantier n°3 fonctionne, ni
défendre une décision devant un investisseur, un professeur ou moi-même dans un mois.

Les événements à instrumenter sont peu nombreux et suffisent : `signup`, `onboarding_done`,
`first_content_viewed`, `session_completed`, `day_streak`, `paywall_viewed`, `purchase`.
**Sept événements, pas cent.**

**Fait quand** : je peux répondre en une requête à « combien d'inscrits cette semaine ont lu
une fiche dans les 24 h ? » et « quel est le taux de conversion à J+7 ? ».

### 🥉 3. La boucle quotidienne (P1-2 + QW3) — 6 jours

« Ma journée » : une file unique (QCM dus + flashcards dues + 1 signe + 1 fiche), un
compteur, un objectif atteint, et des statistiques par spécialité dans le profil.

C'est le chantier qui transforme un **site de contenu** en **outil de révision**. C'est aussi
la seule fonctionnalité qui bat Anki sur son propre terrain (la file d'attente) tout en
gardant l'avantage d'Optimus (contenu prêt, sourcé, en français, adapté au programme).

**Fait quand** : un étudiant ouvre l'app, voit « 14 éléments à réviser aujourd'hui », les
fait en 12 minutes, et n'a plus rien à décider.

### Ce que je ne ferais PAS ces deux semaines (et pourquoi)

| Tentation | Pourquoi c'est un piège maintenant |
| --- | --- |
| QCM format EDN complet | excellent, mais inutile si l'étudiant n'a d'abord aucune raison de revenir chaque jour |
| Gamification avancée, ligues, avatars | le classement est déjà fictif ; ajouter des mécaniques sur une base non réelle décrédibilise |
| Application mobile native | la PWA suffit ; 2 semaines de React Native = 0 vente |
| Tuteur IA génératif | coût variable, risque d'hallucination médicale, et le contenu validé est déjà le vrai différenciateur |
| Nouvelle refonte graphique | le design est déjà au-dessus du marché local ; ce n'est pas le facteur limitant |
| Produire 200 fiches à la main | sans gabarit ni relecture, c'est 6 mois et un risque médical ; il faut **outiller** la production (§ 5.3) |

### Plan des 14 jours

| Jours | Chantier | Livrable |
| --- | --- | --- |
| 1-2 | Encaissement (P0-2, P0-3, P0-6) | achat carte **et** MVola produisent une licence |
| 3 | Exécuter `003` + recette `ADMIN_QA_MODE=ready` + purge des tests | back-office vert, faille fermée |
| 4-5 | Sauvegardes + restauration testée | RPO/RTO écrits, restauration prouvée |
| 6-8 | Analytics + e-mails (P1-4) | 7 événements, 5 séquences, tableau de bord simple |
| 9-12 | « Ma journée » (P1-2) | file unifiée, un bouton, compteur |
| 13 | Statistiques par spécialité (QW3) | profil avec maîtrise et lacunes |
| 14 | Onboarding → 1re fiche (QW4) + carte de partage (QW5) | activation J0 mesurée |

**Hors de ces 14 jours, un seul sujet mérite l'attention du propriétaire** : le cahier des
charges éditorial. Tant qu'il n'existe pas, la faiblesse n°1 (9,6 % de couverture) reste
structurelle, et aucun des trois chantiers ci-dessus ne pourra être exploité au-delà des
premiers étudiants.

---

## 5. Décisions à prendre (propriétaire)

### 5.1 Positionnement

| Question | Options | Conséquence |
| --- | --- | --- |
| Cible primaire | (a) Madagascar internat · (b) Afrique francophone · (c) francophone mondial | (a) = programme malgache, prix MGA, Mobile Money dominant · (c) = EDN/ECN, EUR, carte |
| Promesse | (a) « réussir son internat » · (b) « réviser plus vite » · (c) « comprendre » | détermine la page d'accueil et les métriques |
| Gratuité | (a) 1 fiche + 1 cas · (b) tout le contenu d'une spécialité · (c) 7 jours pleins | détermine la conversion et le coût d'acquisition |

### 5.2 Back-office

Un seul back-office (recommandé : `/admin` protégé par `is_admin`, cf. `V1-READINESS` § 4.2),
ou le dashboard local maintenu comme outil de secours ?

### 5.3 Débloquer la production de contenu (le point le plus important)

La consigne actuelle gèle le contenu médical en attendant un cahier des charges. Pour passer
de 23 à 240 items (10×), il faut **deux décisions**, pas du code :

1. **Un gabarit d'item** (structure des sections, nombre de questions, sources exigées) —
   1 page, validée une fois, puis appliquée mécaniquement.
2. **Un process de relecture** : qui relit, sous quel délai, avec quel statut affiché
   (`pending-medical-review` → `reviewed`, `reviewedBy`).

Sans ces deux décisions, la plateforme restera excellente sur 9,6 % du programme.

### 5.4 Communauté

Le classement fictif doit être **basculé en réel** ou **retiré** avant lancement. Un
classement de démonstration dans un produit payant est un risque de crédibilité.

---

## 6. Métriques de succès (à instrumenter avant de juger)

| Métrique | Définition | Cible V1.5 |
| --- | --- | --- |
| **Activation J0** | inscription → 1 fiche ou 1 session terminée dans les 24 h | ≥ 60 % |
| **Rétention J7** | a au moins 2 jours actifs sur 7 | ≥ 35 % |
| **Rétention J30** | a au moins 6 jours actifs sur 30 | ≥ 20 % |
| **Sessions / semaine** | sessions terminées par étudiant actif | ≥ 3 |
| **Couverture perçue** | % d'items du programme avec ≥ 1 contenu révisable | **100 %** (P1-1) |
| **Conversion** | paywall vu → achat | ≥ 3 % |
| **Satisfaction contenu** | signalements « erreur » / 1 000 consultations | < 2 |
| **Délai de correction** | signalement → correction publiée | < 7 j |

---

## 7. En une phrase

> Optimus a déjà ce que les autres n'ont pas (des sources vérifiables, partout, et une
> infrastructure de paiement et de gating sérieuse) ; il lui manque ce qui fait revenir
> l'étudiant chaque jour — **un programme complet et une file de révision qui se vide**.
> Les deux prochaines semaines doivent servir à **encaisser**, **mesurer**, et **créer
> l'habitude** — dans cet ordre.
