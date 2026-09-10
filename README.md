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
