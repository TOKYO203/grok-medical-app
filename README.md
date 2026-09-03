# Grok Medical App

Application web médicale gamifiée pour l'apprentissage des cas cliniques, des diagnostics et des réflexes médicaux. Inspirée par Duolingo, elle utilise la répétition espacée et des quiz interactifs pour aider les étudiants en médecine à mémoriser durablement.

## ✨ Fonctionnalités

- 📚 Leçons interactives (QCM, cartes mémoire, cas cliniques)
- 🧠 Algorithme de répétition espacée (SM-2 modifié)
- 🏆 Suivi de progression, XP, niveaux et badges
- 👥 Mode multijoueur en pair-à-pair (WebRTC)
- 📊 Tableau de classement
- 🔐 Authentification par email/mot de passe (Supabase)
- 📱 Progressive Web App (PWA) installable

## 🛠️ Technologies

- **Frontend** : React, TypeScript, Vite, TanStack Start, Tailwind CSS
- **Backend** : Supabase (PostgreSQL, Auth, Storage)
- **Tests** : Node.js test runner, Vitest
- **CI/CD** : GitHub Actions

## 🚀 Installation locale

Prérequis : Node.js >= 22.12.0, npm

```bash
# Cloner le dépôt
git clone https://github.com/TOKYO203/grok-medical-app.git
cd grok-medical-app

# Installer les dépendances
npm install

# Lancer le serveur de développement
npm run dev
