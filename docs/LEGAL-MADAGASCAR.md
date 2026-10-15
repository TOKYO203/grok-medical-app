# Légal Madagascar — Optimus Formation Médicale

> Cadre juridique pour éditer et vendre l'app à Madagascar.
> Étudiant seul, 0 data patient, statut EI, conformité loi 2014-038.

## Sommaire

- **A.** Contexte et cadre général
- **B.** Procédure EI + protection des données (CMIL, loi 2014-038)
- **C.** Modèles de documents (mentions, confidentialité, CGU)

## A. Contexte

- Produit : application **pédagogique** pour étudiants en médecine
- Aucun acte médical, aucun dossier patient, aucune donnée de santé réelle
- Cible v1 : Madagascar (Concours National Internat)
- Statut juridique prévu : **Entreprise Individuelle (EI)**
- Autorité protection données : **CMIL** (et non CNIL France)
- Base légale : **Loi n° 2014-038 du 9 janvier 2015**

---


---

## B. PROCÉDURE — STATUT EI + PROTECTION DES DONNÉES

### B1. Créer l'EI (Entreprise Individuelle)

> Source : EDBM / Orinasa — orinasa.edbm.mg/Articles_15 (mise à jour oct. 2025)

**Pourquoi l'EI**
- Forme la plus simple, aucun capital social minimum
- Adaptée aux entrepreneurs solos, informaticiens, professions libérales non réglementées
- Dénomination sociale = ton nom civil de naissance ou d'usage
- « Optimus Formation Médicale » = nom commercial ajouté
- Tu diriges seul, tu es l'unique décisionnaire, tu peux embaucher
- ⚠️ Responsabilité ILLIMITÉE : patrimoine perso et patrimoine entreprise confondus,
  les dettes sociales peuvent être poursuivies sur tes biens personnels

**Les 4 étapes officielles**
1. **Déclarer son activité** — Centre Fiscal du siège social.
   Déclaration d'activité principale (et secondaire).
   Paiement de l'acompte provisionnel d'impôt → bordereau de versement.
2. **Immatriculation statistique** — Service du Fichier des Établissements (INSTAT).
   Pièces obligatoires : bordereau de versement d'impôt + CIN + certificat de résidence.
3. **Préparer son dossier** — saisie sur l'application web **NIFONLINE**.
   ✔ Contrat de bail commercial pour le siège, **même s'il s'agit de ton domicile personnel**
   ✔ Pièces justificatives du bail : Certificat de Situation Juridique (CSJ)
     ou titre de propriété du terrain ou certificat de propriété
   ✔ Plan de repérage
   ✔ Autorisation préalable si activité réglementée
4. **Transmettre son dossier** — dépôt au Centre Fiscal → obtention du **NIF**,
   puis au **TPI** → immatriculation **RCS**.

**Frais et droits (source EDBM)**
- Acompte sur l'impôt IS : 16 000 à 150 000 Ar selon le secteur
  - 100 000 Ar → prestataires de services
  - 150 000 Ar → professions libérales, activités multiples, autres
- Acompte sur l'impôt IR (si option IR) : 100 000 à 1 000 000 Ar
- Immatriculation au Registre du Commerce : **6 000 Ar**
- Attribution de la carte statistique : **20 000 Ar**
- **TOTAL ESTIMÉ : ≈ 126 000 à 176 000 Ar** (≈ 28 à 39 EUR)
- ⚠️ Montant exact à confirmer au Centre Fiscal selon le code activité retenu

**Fiscalité applicable à Optimus**
- **Impôt Synthétique (IS)** obligatoire si CA annuel < 400 000 000 Ar
- Taux IS : **5 % du chiffre d'affaires** (minimum 3 % en cas de réduction d'impôt)
- **Pas d'assujettissement à la TVA** sous ce seuil
- TVA obligatoire si CA ≥ 400 000 000 Ar — taux 20 %
- Déclaration IS à déposer **avant le 31 mars** de l'année suivante
- Comptabilité allégée pour l'EI : simple **récapitulatif des recettes et dépenses**
  si CA < 100 000 000 Ar (états financiers Système Minimal de Trésorerie entre 100 et 200 M)
- ⚠️ Activité à déclarer : **« édition de contenu pédagogique / formation en ligne »**.
  NE PAS déclarer d'acte médical : tu es étudiant, l'app est pédagogique,
  aucun diagnostic sur patient réel. Vérifier la liste des activités réglementées EDBM.

### B2. Protection des données — CMIL

> Source : Loi n° 2014-038 du 9 janvier 2015 sur la protection des données
> à caractère personnel — digital.gov.mg

⚠️ **CORRECTION MAJEURE** : l'autorité malgache est la **CMIL** — Commission Malagasy
de l'Informatique et des Libertés (art. 28) — et **NON** la « CMIL ».
Autorité indépendante, dotée d'un pouvoir réglementaire et de sanction (art. 37).
→ Corriger toutes les occurrences de « CNIL » dans le repo.

**Régime de formalités applicable**
- Art. 43 / 45 : **déclaration préalable** obligatoire auprès de la CMIL
  avant toute mise en œuvre du traitement, avec engagement de conformité à la loi
- Art. 47 : **déclaration simplifiée** de conformité possible si le traitement
  entre dans une norme de simplification publiée par la CMIL
- Art. 46 : **autorisation préalable** pour les traitements présentant des risques
  particuliers pour les droits et libertés → **non applicable à Optimus**
  tant qu'aucune donnée patient réelle n'est stockée
- Art. 52 : la désignation d'un **délégué à la protection des données** ouvrirait
  une dispense de déclaration → ⚠️ à confirmer directement auprès de la CMIL

**🚨 POINT CRITIQUE — Article 18 : les données sensibles**
- Sont sensibles : origine raciale, données biométriques, données génétiques,
  opinions politiques, convictions religieuses, appartenance syndicale,
  **et celles qui se rapportent à la santé ou à la vie sexuelle**
- **Tout traitement portant sur des données sensibles est INTERDIT par principe**
- Dérogations étroites : traitement nécessaire à la médecine préventive, aux
  diagnostics médicaux, à l'administration de soins ou à la gestion de services
  de santé, **mis en œuvre par un membre d'une profession de santé** ou par une
  personne soumise au secret professionnel du code pénal

✅ **Position d'Optimus (à verrouiller dans le code)**
- App strictement **PÉDAGOGIQUE** : les utilisateurs sont des **étudiants**, pas des patients
- Les cas ECG et les fiches d'auscultation sont **synthétiques** / générés
- Aucune donnée de santé réelle collectée → pas de donnée sensible → **déclaration simple**

❌ **RÈGLE PROJET NON NÉGOCIABLE**
- Ne jamais ajouter de dossier patient, de cas clinique nominatif,
  d'image médicale réelle identifiable, ni de champ « mes antécédents »
- Tout futur module touchant à un patient réel = bascule en régime
  d'**autorisation** CMIL + encadrement par un professionnel de santé assermenté
- Un garde-fou technique doit être posé dans SECURITY-AUDIT.md

**Transfert de données à l'étranger — Article 20 (cas Supabase / Neon)**
Interdit vers un État n'assurant pas un niveau de protection similaire, **sauf** :
- autorisation de la CMIL lorsque le responsable offre des garanties suffisantes
  (clauses contractuelles appropriées ou règles internes), **ou**
- dérogation (a) : **consentement indubitable** de la personne, dûment informée
  de l'absence d'un niveau de protection similaire, **ou**
- dérogation (b) : transfert **nécessaire à l'exécution d'un contrat** entre
  la personne concernée et le responsable du traitement

✅ **Actions projet**
- Clause explicite dans les CGU : hébergement des données hors de Madagascar
- Case de consentement **non pré-cochée** à l'inscription mentionnant ce transfert
- **Minimisation stricte** : email + pseudo + progression + licence. Rien d'autre.
- Documenter le sous-traitant (nom, pays, finalité) dans la politique de confidentialité

**Obligations d'information — Article 27**
Le responsable du traitement doit informer la personne de :
- l'identité du responsable du traitement
- la finalité poursuivie
- le caractère obligatoire ou facultatif des informations demandées
- les catégories de données traitées
- les destinataires ou catégories de destinataires
- ses droits d'opposition, d'accès et de rectification + les modalités d'exercice

**Droits à implémenter dans l'app**
- Art. 13 : consentement = manifestation **explicite, libre, spécifique et informée**
- Art. 22 : droit d'opposition, à tout moment, **sans frais**, sur motif légitime
- Art. 23 : droit d'accès — communication de l'ensemble des données
  **sous une forme compréhensible** + information sur leur origine
- Art. 25 : droit de rectification, complétion, mise à jour, verrouillage ou effacement
- → Prévoir **un email dédié** et un écran « Mes données » (export + suppression)

**Sanctions encourues**
- Art. 55 : avertissement, injonction de cesser le traitement, retrait d'autorisation,
  sanction pécuniaire. En urgence : interruption ou verrouillage jusqu'à 3 mois.
- Art. 59 : sanction pécuniaire ≤ **5 % du CA HT du dernier exercice clos**
- Art. 61 : entrave à l'action de la CMIL → 6 mois à 2 ans + 800 000 à 8 000 000 Ar
- Art. 65 : collecte déloyale → 2 à 5 ans + 1 000 000 à 10 000 000 Ar
- Art. 66 : détournement de finalité → 2 à 5 ans + 800 000 à 8 000 000 Ar
- Art. 69 : non-respect du droit d'accès → 2 à 5 ans + 800 000 à 8 000 000 Ar

### B3. Ordre de marche concret

1. Centre Fiscal → déclaration d'activité + acompte IS → bordereau de versement
2. INSTAT (Fichier des Établissements) → carte statistique — 20 000 Ar
3. NIFONLINE → saisie + dossier bail (domicile personnel accepté) + CSJ + plan de repérage
4. Centre Fiscal → dépôt du dossier → **NIF**
5. TPI → immatriculation **RCS** — 6 000 Ar
6. **CMIL** → déclaration du traitement Optimus (avec le NIF obtenu)
7. App → Mentions légales + Politique de confidentialité + consentement transfert étranger
8. App → écran « Mes données » (droits art. 22 / 23 / 25)
9. Canal d'encaissement MGA (mobile money pro ou banque)
10. Session 1 → page Tarifs (A02) + Premium payant

**Budget légal total estimé : ≈ 126 000 à 176 000 Ar** + frais de déclaration CMIL (à vérifier)

⚠️ Points à confirmer sur place ou par contact direct :
- Code activité exact et montant de l'acompte IS retenu
- Formulaire, pièces, délai et coût de la déclaration CMIL
- Coordonnées et adresse physique de la CMIL (aucune source officielle vérifiée à ce jour)
- Applicabilité de la dispense de déclaration via désignation d'un DPO (art. 52)

## C. MODÈLES DE DOCUMENTS

> Modèles à personnaliser. Champs entre [CROCHETS] à remplacer.

### C1. Mentions légales

Éditeur
-------
Optimus Formation Médicale
Entreprise Individuelle (EI)
Responsable : [PRÉNOM NOM]
NIF : [À RENSEIGNER]
RCS : [À RENSEIGNER] — Tribunal de Commerce de [VILLE]
Carte statistique INSTAT : [À RENSEIGNER]
Siège : [ADRESSE], Madagascar
Email : contact@[DOMAINE].mg

Directeur de la publication
----------------------------
[PRÉNOM NOM], responsable de l'EI.

Hébergement
-----------
- Base + auth : Supabase, Inc. (Singapour)
- Base secondaire : Neon, Inc. (USA) si applicable
- Stockage assets : [Cloudflare R2 / S3 / autre]

Propriété intellectuelle
------------------------
L'ensemble du site et de ses contenus (textes, fiches d'auscultation,
cas ECG synthétiques, calculateurs, code source, design) est la propriété
exclusive de l'EI ou de ses concédants, sauf mention contraire.
Toute reproduction même partielle est interdite sans autorisation écrite.

Sources médicales citées (conformément à leurs licences) :
- ECG : Hampton, The ECG Made Easy ; ESC Guidelines ; HAS
- Auscultation : références cliniques standard

Contact : [EMAIL DE CONTACT]

### C2. Politique de confidentialité

> Conforme à la Loi n° 2014-038 — articles 13, 18, 20, 23, 25, 27.

Dernière mise à jour : [DATE]

1. RESPONSABLE DU TRAITEMENT
Optimus Formation Médicale (EI), [PRÉNOM NOM], [ADRESSE], [NIF], contact@[DOMAINE].mg

2. FINALITÉ
Application strictement pédagogique pour étudiants en médecine.
Données traitées : inscription, progression, licence Premium.
Aucune donnée médicale réelle. Cas ECG et fiches d'auscultation
sont intégralement synthétiques et à visée d'apprentissage.

3. DONNÉES COLLECTÉES
- Adresse email (obligatoire à l'inscription)
- Pseudo / nom affiché
- Mot de passe (haché côté serveur, jamais en clair)
- Progression : XP, streaks, scores, modules complétés
- Licence Premium (signature Ed25519)
- Paiement : jamais stocké par Optimus, traité par le prestataire MGA

4. BASE LÉGALE
- Exécution du contrat (inscription, accès Premium)
- Consentement explicite (communications optionnelles)
- Obligation légale (conservation factures)

5. DESTINATAIRES
- Supabase, Inc. (base et authentification)
- [NOM PRESTATAIRE PAIEMENT MGA] (paiements locaux)

6. TRANSFERT HORS MADAGASCAR — Article 20
Certaines données sont hébergées hors de Madagascar (Supabase :
Singapour/USA). Ces prestataires ne sont pas soumis à une législation
offrant un niveau de protection équivalent à la Loi 2014-038.
Vous donnez votre consentement explicite à ce transfert en validant
votre inscription (art. 20, dérogation a). Retrait possible à tout
moment en supprimant votre compte.

7. DURÉE DE CONSERVATION
- Données de compte : 3 ans après dernière activité, puis suppression
- Données de facturation : 10 ans (obligation comptable malgache)
- Données anonymisées : conservation illimitée (pédagogie)

8. VOS DROITS — Articles 22, 23, 25
Exercables gratuitement :
- Accès : obtenir l'ensemble de vos données
- Rectification : corriger des données inexactes
- Opposition : motif légitime
- Effacement : suppression du compte et des données
- Portabilité : récupérer votre progression

Exercice : email à [EMAIL CONTACT] avec pseudo + nature de la demande.
Réponse sous 30 jours.

9. SÉCURITÉ
Chiffrement TLS en transit, mots de passe hachés bcrypt/argon2,
validation stricte des entrées, audits réguliers.

10. RÉCLAMATIONS
Réclamation possible auprès de la CMIL (Commission Malagasy de
l'Informatique et des Libertés), autorité instituée par la Loi 2014-038.

11. MODIFICATIONS
Politique modifiable à tout moment. Date de mise à jour en tête.
L'usage continu de l'app vaut acceptation.

### C3. Conditions Générales d'Utilisation

PRÉAMBULE
Optimus Formation Médicale est une application pédagogique destinée
aux étudiants en médecine. Elle n'est PAS un outil médical et ne
remplace en aucun cas l'avis d'un professionnel de santé qualifié.

⚠️ DÉCHARGE MÉDICALE CRITIQUE
- Les cas ECG sont synthétiques et générés à des fins d'apprentissage
- Les fiches d'auscultation sont des supports pédagogiques
- Les calculateurs sont fournis à titre informatif
- AUCUN contenu ne doit servir à poser un diagnostic, prescrire un
  traitement ou prendre une décision sur un patient réel
- En cas de doute clinique, consulter immédiatement un médecin

1. OBJET
Les présentes CGU régissent l'utilisation de l'app par les utilisateurs
inscrits.

2. ACCÈS
Inscription avec email valide. Confidentialité des identifiants à la
charge de l'utilisateur.

3. NATURE DE L'APPLICATION
Outil pédagogique de préparation au Concours National de l'Internat à
Madagascar et au public francophone. N'est pas un dispositif médical.
Aucune certification sanitaire.

4. OFFRE FREEMIUM / PREMIUM
- Free : accès limité à certains modules
- Premium : accès complet contre paiement en Ariary (MGA)
- Licence Ed25519 liée au compte. Personnelle, non cessible.

5. TARIFS ET PAIEMENT
- Tarifs en Ariary malgache (MGA)
- Paiement : [MVola / Orange Money / Airtel Money / autre]
- Pas de remboursement après activation sauf dysfonctionnement avéré

6. PROPRIÉTÉ INTELLECTUELLE
Contenus propriété exclusive d'Optimus. L'utilisateur acquiert un droit
d'usage personnel et non exclusif, non cessible.

7. LIMITATION DE RESPONSABILITÉ
Dans les limites du droit malgache, Optimus ne peut être tenue
responsable des décisions prises sur la base des contenus, des
interruptions de service, ou des erreurs de contenu (l'utilisateur doit
toujours croiser avec les sources de référence).

8. DONNÉES PERSONNELLES
Voir Politique de confidentialité. L'inscription vaut acceptation du
transfert hors Madagascar (art. 20, loi 2014-038).

9. RÉSILIATION
Suppression du compte possible à tout moment via profil. Optimus peut
suspendre un compte en cas de violation des CGU.

10. DROIT APPLICABLE
Droit malgache. Litiges soumis aux tribunaux compétents de
[Antananarivo], Madagascar.

11. CONTACT
contact@[DOMAINE].mg

---

**FIN DU DOCUMENT**
