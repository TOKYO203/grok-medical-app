# Optimus — Plan Stratégique & Opérationnel : Devenir la Plateforme de Référence

**Date** : Novembre 2026
**Statut** : Document Directeur & Cadre Stratégique
**Mission** : Rendre le but possible — Faire d'Optimus la plateforme d'apprentissage clinique de référence dans son domaine.

---

## 1. La Thèse de Référence : Gagner le Terrain Réel

Une plateforme de formation médicale ne devient pas une référence en tentant d'imiter superficiellement les géants internationaux (Amboss, UWorld) ou les outils généralistes (Anki).

### 1.1 L'Adversaire Réel
Pour un étudiant en médecine préparant son internat ou ses examens cliniques, le véritable concurrent est :
- Le polycopié photocopié informel,
- Le groupe WhatsApp de promotion,
- Les cours épars sur YouTube.

Ces supports sont gratuits, en français, déjà omniprésents, mais ils souffrent de trois tares majeures :
1. **Zéro traçabilité des sources** et erreurs médicales non signalées.
2. **Aucune organisation cognitive** : ils ne répondent pas à la question fondamentale : *« Que dois-je réviser aujourd'hui pour progresser ? »*.
3. **Format statique et passif**, inadapté à la mémorisation durable et au raisonnement clinique inverse.

### 1.2 La Définition d'une « Plateforme de Référence »
Pour supplanter définitivement le polycopié et devenir l'outil incontournable recommandé par les doyens, les enseignants et les promotions d'étudiants, Optimus doit s'imposer sur **4 Piliers Inébranlables** :
1. **Excellence Pédagogique & Couverture Intégrale** (100% du programme officiel).
2. **Crédibilité Médicale & Trust Layer Institutionnel** (chaque affirmation prouvée, validation humaine).
3. **Expérience Produit & Boucle d'Habitude Quotidienne** (PWA offline-first, "Ma Journée", SRS unifié).
4. **Modèle Économique & Croissance Hybride** (B2C Mobile Money accessible + B2B facultés & CHU).

---

## 2. Pilier 1 : Excellence Pédagogique & Couverture

### 2.1 Couverture Intégrale du Programme (236/236 items)
- **Constat** : Le catalogue compte 236 fiches de nosographie couvrant l'intégralité des sections du programme officiel 2025 (Cardiologie, Pneumologie, Infectiologie, Neurologie, Néphrologie, Endocrinologie, Pédiatrie, Gynécologie, Urgences, Chirurgie).
- **Moteur Multi-Format** : Chaque item de nosographie combine :
  - La fiche synthétique structurée en 7 sections standardisées.
  - L'encadré mnémonique d'ancrage rapide.
  - Le deck de flashcards actives.
  - La carte mentale radiale (Mindmap) déployable avec échelle de criticité (urgent, grave, réflexe, examen).
- **Outils Spécialisés d'Entraînement Clinique** :
  - *Moteur d'Histologie* (lames annotées Wikimedia/NCBI CC-BY avec coupes pathologiques).
  - *Moteur d'Imagerie* (radiographies et TDM annotés selon les règles strictes IMAGING-SOURCES-POLICY).
  - *Moniteur d'Auscultation* (sons cardiaques et pulmonaires synchronisés avec phonocardiogramme).
  - *Simulateur ECG* (23 tracés Einthoven/précordiaux multi-cycles).
  - *Raisonnement Inversé* (110 fiches de Signes & Syndromes).
  - *78 Calculateurs Médicaux* officiels.

### 2.2 Recommandation Clé
- Maintenir le principe de **gabarit rigide** et interdire toute posologie arbitraire non sourcée.
- Lier systématiquement chaque item du programme (`/programme`) à sa fiche, ses cas d'application et son module d'escalier de niveau (`L2` -> `L3` -> `L4` -> `L5` -> `Interne`).

---

## 3. Pilier 2 : Crédibilité Médicale & Trust Layer Institutionnel

La confiance est l'actif le plus précieux d'une plateforme médicale.

### 3.1 Transparence Totale & Traçabilité des Sources
- **Règle absolue** : 100% des fiches et questions sont indexées avec des sources primaires (OMS, HAS, ESC, NICE, SPILF, Collèges d'enseignants).
- **Sources section par section** : L'étudiant peut vérifier immédiatement d'où provient un seuil ou un algorithme sans chercher dans une bibliographie globale.
- **Pages Publiques de Gouvernance** :
  - `/validation-clinique` : méthodologie et protocole versionné (`v2026.10-Mada`).
  - `/politique-editoriale` : périmètre clair (*« Outil pédagogique, pas un dispositif médical de diagnostic »*).
  - `/sources` : répertoire des référentiels officiels.
  - `/conseil-editorial` : comité scientifique et relecteurs.
  - `/changelog` : traçabilité publique de chaque mise à jour.

### 3.2 Protocole de Validation Humaine
- Affichage clair et honnête du statut éditorial sur chaque ressource :
  `structural_only` -> `priority_items_reviewed` -> `fully_reviewed`.
- Aucune fiche n'est déclarée `fully_reviewed` sans signature d'un médecin ou interne référent nommé.

---

## 4. Pilier 3 : Boucle d'Usage Quotidienne & Robustesse PWA

Le meilleur contenu est inutile si l'étudiant abandonne l'application après 3 jours.

### 4.1 « Ma Journée » : Une Porte d'Entrée Unique
- Remplacer la surcharge cognitive (44 routes, 8 carrefours) par une **file de révision quotidienne unifiée** :
  - QCM dus (SRS SM-2 modifié).
  - Flashcards du jour.
  - 1 cas clinique ou signe à déduire.
- Objectif clair : un compteur qui descend à zéro en 12 à 15 minutes. C'est ce rituel qui crée l'habitude.

### 4.2 Architecture PWA Offline-First
- En contexte insulaire et pays émergents, la connectivité 3G/4G est intermittente et la data coûteuse.
- Le Service Worker et le stockage IndexedDB/CacheStorage permettent l'exécution locale complète des quiz, des fiches et de la progression sans réseau.
- Synchronisation ascendante idempotente et résiliente dès le retour de la connexion.

---

## 5. Pilier 4 : Monétisation Hybride & Partenariats B2B

Pour assurer sa pérennité et son statut de référence, la plateforme doit générer des revenus récurrents et être adoptée par les institutions.

### 5.1 B2C : Offre Équitable & Paiement sans Friction
- **Canal Mobile Money (Ariary / MVola / Orange Money / Airtel)** :
  - Abonnement trimestriel accessible (15 000 Ar ≈ 3,20 €), aligné sur le pouvoir d'achat des étudiants locaux.
  - Vente à l'unité de modules ou spécialités (3 000 Ar / 27 000 Ar).
  - Essai gratuit de 7 jours sans carte bancaire pour déclencher l'activation.
- **Canal International (Lemon Squeezy)** :
  - Checkout par carte et PayPal (19 € / 3 mois) pour la diaspora et les étudiants francophones (EDN, Afrique de l'Ouest/Centrale).
  - Sécurité des licences liée cryptographiquement (Ed25519) à l'appareil et à l'identité Optimus.

### 5.2 B2B : Licences Écoles, Facultés & CHU (`/institutionnel`)
- **Offre Promotion / Tutorat** : Licences groupées avec suivi global.
- **Offre Faculté / Prépa** : Dashboard enseignant pour piloter les révisions des promotions et identifier les lacunes collectives par matière.
- **Partenariat CHU** : Outil de formation continue pour les internes de garde.

---

## 6. Feuille de Route d'Exécution en 3 Phases

```
[Phase 1 : Socle & Validation Pilote] -> [Phase 2 : Déploiement & Habitude] -> [Phase 3 : Référence Internationale]
 (2 semaines - Promo 20 étudiants)        (Mois 1-2 - Madagascar Global)        (Mois 3-6 - Océan Indien & Francophonie)
```

### Phase 1 : Pilote Privé Madagascar (2 semaines)
- Valider le tunnel de paiement Mobile Money en conditions réelles avec 20 étudiants pilotes.
- Valider l'activation J0 (>= 60%) et la rétention J7 (>= 35%).
- Nommer et afficher les 2 premiers médecins relecteurs sur le Conseil Éditorial.

### Phase 2 : Référence Nationale Madagascar (Mois 1 à 2)
- Lancement public avec campagne promo WhatsApp et délégués de faculté.
- Activer la boucle virale : cartes de partage de fin de session sur WhatsApp, parrainage (+1 deck offert).
- Signer le premier partenariat B2B avec une faculté ou un tutorat à Antananarivo.

### Phase 3 : Rayonnement International & B2B (Mois 3 à 6)
- Basculer Lemon Squeezy en mode Live pour l'Afrique francophone et les étudiants préparant l'EDN.
- Déploiement du tableau de bord enseignant multi-sièges.
- Audit de conformité d'accessibilité WCAG AA et monitoring continu Sentry/Upstash.

---

## 7. Conclusion

Optimus possède déjà l'atout le plus difficile à bâtir : **un socle de données médicales exhaustif, entièrement sourcé, typé et protégé cryptographiquement**.
En consolidant la crédibilité médicale humaine, en unifiant le parcours de révision quotidien ("Ma Journée") et en ouvrant les canaux de distribution Mobile Money et institutionnels, **Optimus a toutes les clés en main pour devenir la plateforme de référence absolue dans son domaine**.
