# Grok Medical App

Application web médicale gamifiée pour l'apprentissage des cas cliniques, des diagnostics et des réflexes médicaux. Inspirée par Duolingo, elle utilise la répétition espacée et des quiz interactifs pour aider les étudiants en médecine à mémoriser durablement.

## ✨ Fonctionnalités

- 📚 Leçons interactives (QCM, cartes mémoire, cas cliniques)
- 🧠 Algorithme de répétition espacée (SM-2 modifié)
- 🏆 Suivi de progression, XP, niveaux et badges
- 👥 Mode multijoueur en pair-à-pair (WebRTC)
- 📊 Tableau de classement
- 🔐 Authentification et données utilisateur isolées côté serveur
- 🛡️ Activation Premium liée à l’Optimus ID et à l’appareil
- 📱 Progressive Web App (PWA) installable

## 🛠️ Technologies

- **Frontend** : React, TypeScript, Vite, TanStack Start, Tailwind CSS
- **Backend** : PostgreSQL/Neon, avec PGLite pour la prévisualisation locale
- **Tests** : Node.js test runner
- **CI/CD** : GitHub Actions

## 🚀 Installation locale

Prérequis : Node.js >= 22.12.0, npm

```bash
# Cloner le dépôt
git clone https://github.com/TOKYO203/grok-medical-app.git
cd grok-medical-app

# Installer les dépendances
npm ci

# Lancer le serveur de développement
npm run dev
```

## 🔑 Activation Premium sécurisée

Les clés de licence et les Decks utilisent deux paires Ed25519 distinctes. Les clés privées ne
doivent jamais être ajoutées au dépôt.

```bash
# À exécuter une seule fois, puis à conserver dans le gestionnaire de secrets du déploiement
npm run license:keys
npm run deck:keys

# Après validation serveur d'un paiement, lier la clé à la commande
npm run license:issue -- \
  --optimus-id OM-A1B2C3D4 \
  --product NEURO_DECK_01 \
  --days 365 \
  --purchase-ref CMD-EXEMPLE-A1B2C3D4
```

Le déploiement attend `LICENSE_SIGNING_PRIVATE_KEY` et `VITE_LICENSE_SIGNING_PUBLIC_KEY` pour les
preuves d’activation, ainsi que les clés Deck séparées pour les fichiers Premium signés.

Les nouvelles preuves d'activation signées contiennent l'identifiant serveur de la licence. Lorsqu'un
appareil est connecté, `/api/licenses/status` peut confirmer qu'elle n'a pas été révoquée. Une
licence explicitement révoquée est retirée localement à la reconnexion ; l'usage hors ligne reste
possible entre deux connexions. Cette propriété est volontaire : une révocation instantanée et un
fonctionnement totalement hors ligne sont deux exigences incompatibles.

À chaque démarrage, un Deck Premium importé est revérifié puis reconstruit depuis son enveloppe
signée. Une copie modifiée, expirée ou vérifiée avec une autre clé reste verrouillée.

Pour une livraison Premium résistante à la copie, l’acheteur ouvre **Importer un Deck** et copie sa
demande d’achat sécurisée. Enregistrez cette demande dans `demande-appareil.json`, puis générez le
fichier à lui envoyer :

```bash
npm run deck:encrypt -- \
  --input deck-source.json \
  --output deck-client.json \
  --request demande-appareil.json \
  --product NEURO_DECK_01 \
  --days 365
```

Le contenu est chiffré en AES-256-GCM. Sa clé est elle-même protégée par la clé RSA non exportable
de l'appareil, et l'ensemble est signé en Ed25519. L'application ne conserve que l'enveloppe
chiffrée et ses métadonnées sur le disque — jamais les questions en clair — puis reconstruit le
contenu en mémoire après vérification.

## 💳 Paiement Premium et Mobile Money

Le client ne choisit jamais le prix, le produit canonique ni le statut final d'une commande. Le
serveur génère la référence commerciale et conserve le journal d'audit.

Le flux actuel accepte un canal Mobile Money configuré côté serveur. Aucun numéro n'est codé en dur
dans l'application :

- `MOBILE_MONEY_PROVIDER` : nom de l'opérateur, par exemple la valeur commerciale réellement utilisée ;
- `MOBILE_MONEY_NUMBER` : numéro officiel de réception ;
- `MOBILE_MONEY_ACCOUNT_NAME` : titulaire affiché à l'acheteur ;
- `MOBILE_MONEY_INSTRUCTIONS` : consigne opérationnelle courte ;
- `PURCHASE_ADMIN_USER_IDS` : identifiants Better Auth autorisés à vérifier, livrer, rejeter ou rembourser.

Sans `MOBILE_MONEY_PROVIDER` et `MOBILE_MONEY_NUMBER`, le serveur retourne un canal non configuré et
l'interface bloque volontairement la poursuite du paiement.

Une demande de vérification doit fournir une référence de transaction Mobile Money et une preuve
locale. Le fichier de preuve n'est pas stocké dans le registre commercial : le navigateur calcule
son empreinte SHA-256 et le serveur conserve uniquement cette empreinte, la référence opérateur et
les métadonnées nécessaires à l'audit. Des contraintes uniques empêchent de réutiliser la même
référence de transaction ou la même preuve pour une autre commande.

Le statut suit l'ordre :

`created -> instructions_requested -> proof_ready -> verification_pending -> payment_verified -> delivered`

`payment_verified` et `delivered` sont deux décisions distinctes réservées au serveur. Le mini
back-office `/admin-achats` permet à un opérateur autorisé de vérifier manuellement la transaction,
puis de valider le paiement et la livraison. Un remboursement révoque les clés d'activation liées à
la commande.

Pour une automatisation future, privilégier l'API officielle de l'opérateur et une vérification
serveur-à-serveur plutôt que les paramètres renvoyés par le navigateur. L'intégration MVola, par
exemple, nécessite un compte Developer, des tests Sandbox et une approbation GO LIVE avant
production ; les identifiants opérateur ne doivent jamais être inventés ni ajoutés au dépôt.

## 🔒 Configuration sécurité production

Les opérations éditoriales sensibles sont **fail-closed** : sans authentification et sans liste
d'éditeurs configurée, aucune création ou modification de publication/enquête ni aucun upload
éditorial n'est autorisé.

Variables serveur à configurer dans le gestionnaire de secrets du déploiement :

- `CONTENT_EDITOR_USER_IDS` : identifiants Better Auth autorisés à administrer les publications et enquêtes, séparés par des virgules. Ne jamais utiliser une valeur générique ou un identifiant fourni par le client.
- `PURCHASE_ADMIN_USER_IDS` : identifiants Better Auth autorisés à vérifier le paiement puis à livrer, rejeter ou rembourser une commande Premium. Un acheteur ne peut jamais s'attribuer lui-même un de ces états.
- `MOBILE_MONEY_PROVIDER`, `MOBILE_MONEY_NUMBER`, `MOBILE_MONEY_ACCOUNT_NAME`, `MOBILE_MONEY_INSTRUCTIONS` : canal de paiement officiel géré côté serveur.
- `RESPONSE_SALT` : secret aléatoire long utilisé uniquement côté serveur pour pseudonymiser l'adresse IP de l'anti-doublon des enquêtes. Il est obligatoire en production ; aucun `default_salt` n'est accepté.
- `RATE_LIMIT_SALT` : secret aléatoire serveur distinct utilisé pour pseudonymiser les sujets des quotas API avant leur stockage dans `api_rate_limits`. Il est obligatoire en production.
- `TRUST_PROXY_HEADERS` : laisser absent/`false` par défaut. Mettre `true` uniquement lorsque la plateforme de déploiement supprime les headers de forwarding fournis par le client et réinjecte ses propres valeurs de confiance.
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_PUBLIC_BUCKET` : configuration du stockage éditorial. La clé de service reste strictement côté serveur ; le client ne choisit jamais le bucket.

Les quotas sont persistés en PostgreSQL/PGLite afin de rester cohérents entre plusieurs instances :
activation Premium, vérification de statut de licence, soumission d'enquêtes, création/modification de
publications, création d'enquêtes et uploads éditoriaux sont limités. Les réponses bloquées utilisent
HTTP `429` et `Retry-After` lorsqu'un délai est nécessaire.

Les uploads éditoriaux sont limités à 8 Mo et aux formats PDF, JPEG, PNG et WebP avec contrôle
d'extension, type déclaré et signature de fichier.

## 🧩 Architecture des données : hybride par conception

Optimus n'utilise ni un modèle « tout serveur » ni un modèle « tout local avec une clé ». La
séparation est volontaire afin de conserver le fonctionnement hors ligne sans confier au client les
décisions commerciales ou d'autorisation.

**Autorité serveur :**

- session et identité Better Auth ;
- Optimus ID et sauvegarde/synchronisation du profil et de la progression pédagogique ;
- référence de commande, produit, prix et statut Premium ;
- référence opérateur, empreinte de preuve et journal des transitions de commande ;
- décisions de validation, livraison, remboursement et révocation ;
- clés publiques d'appareil nécessaires à la préparation d'un contenu lié à l'appareil.

**Autorité de l'appareil :**

- clé privée cryptographique de l'appareil, non exportée ;
- Decks Premium chiffrés et contenu déchiffré en mémoire ;
- preuves/licences signées vérifiées localement pour permettre l'usage hors ligne ;
- fichier original de preuve de paiement, lorsqu'il est partagé par l'utilisateur ;
- progression locale et cache des commandes lorsque le réseau est indisponible ;
- image de couverture personnalisée et autres données purement locales.

Le cache local d'une commande n'est jamais une source de vérité pour son montant, son produit ou
son statut. Dès que le réseau revient, `/pro` et `/achats` rechargent le registre serveur. Les achats
sont également exclus du snapshot générique de synchronisation pédagogique afin qu'une donnée
locale plus récente ne puisse pas écraser un statut commercial décidé côté serveur.

La clé privée de l'appareil, les Decks déchiffrés et les secrets de signature serveur ne doivent
jamais être envoyés au registre commercial. Le canal Mobile Money officiel reste une configuration
d'exploitation : aucun opérateur ni numéro ne doit être codé en dur ou inventé dans le client.

## Statut éditorial V1

Le registre `src/content/data/editorial-registry.json` distingue désormais la disponibilité d'un
Deck (`published`) de son niveau réel de revue médicale. `priority_items_reviewed` signifie que les
questions à plus fort risque identifiées ont été revues ; `structural_only` signifie que seuls la
structure, les réponses et les métadonnées ont passé les garde-fous automatiques. Seul
`fully_reviewed` autorise à présenter tout le Deck comme médicalement revu.

Avant une mise en production commerciale, exécuter `npm run release:check`, configurer les clés de
signature côté déploiement, configurer les variables de sécurité ci-dessus et confirmer le canal
Mobile Money officiel. Ces conditions sont indépendantes : un build vert ne remplace ni la revue
médicale complète ni la configuration opérateur ni le durcissement des accès serveur.
