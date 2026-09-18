# Guide d'installation — Grok Medical App

## Prérequis

- Node.js >= 18
- npm ou pnpm
- PostgreSQL >= 14
- Une clé API Grok (xAI)

## Installation

1. Cloner le dépôt :

   git clone https://github.com/TOKYO203/grok-medical-app.git
   cd grok-medical-app

2. Installer les dépendances :

   npm install

3. Configurer les variables d'environnement :

   cp .env.example .env
   # éditer .env avec tes vraies valeurs

4. Initialiser la base de données :

   npm run db:migrate

5. Lancer le serveur de développement :

   npm run dev

L'application est accessible sur http://localhost:3000

## Scripts utiles

| Commande | Description |
|---|---|
| npm run dev | Lance le serveur en mode développement |
| npm run build | Compile pour la production |
| npm run start | Lance la version compilée |
| npm run test | Lance les tests |
| npm run lint | Vérifie le code |

## Dépannage

- Erreur de connexion DB : vérifie DATABASE_URL dans .env
- Clé API invalide : régénère ta clé sur https://console.x.ai
- Port déjà utilisé : change PORT dans .env
