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

# Après un paiement confirmé
npm run license:issue -- --optimus-id OM-A1B2C3D4 --product NEURO_PRO --days 365
```

Le déploiement attend `LICENSE_SIGNING_PRIVATE_KEY` et `VITE_LICENSE_SIGNING_PUBLIC_KEY` pour les
preuves d’activation, ainsi que les clés Deck séparées pour les fichiers Premium signés.

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

## 🔒 Configuration sécurité production

Les opérations éditoriales sensibles sont **fail-closed** : sans authentification et sans liste
d'éditeurs configurée, aucune création ou modification de publication/enquête ni aucun upload
éditorial n'est autorisé.

Variables serveur à configurer dans le gestionnaire de secrets du déploiement :

- `CONTENT_EDITOR_USER_IDS` : identifiants Better Auth autorisés à administrer les publications et enquêtes, séparés par des virgules. Ne jamais utiliser une valeur générique ou un identifiant fourni par le client.
- `RESPONSE_SALT` : secret aléatoire long utilisé uniquement côté serveur pour pseudonymiser l'adresse IP de l'anti-doublon des enquêtes. Il est obligatoire en production ; aucun `default_salt` n'est accepté.
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_PUBLIC_BUCKET` : configuration du stockage éditorial. La clé de service reste strictement côté serveur ; le client ne choisit jamais le bucket.

Les uploads éditoriaux sont limités à 8 Mo et aux formats PDF, JPEG, PNG et WebP avec contrôle
d'extension, type déclaré et signature de fichier.

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
