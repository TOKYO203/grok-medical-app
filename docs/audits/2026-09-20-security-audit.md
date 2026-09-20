# Audit technique et corrections — 20 septembre 2026

Base examinée : `d9a01df10e43206d63e810506ebc3a34016cffe3` (`main`).

## Périmètre

Revue ciblée de l'authentification, des commandes et autorisations administrateur,
des routes HTTP, des appels IA et des dépendances verrouillées. Les corrections
portent sur les défauts confirmés de l'API IA. Tests réalisés localement, avec une
base PGLite éphémère et un fournisseur IA simulé ; aucun appel payant, aucune
modification de la base de production, aucun déploiement.

## Constats et corrections

| Priorité | Constat confirmé | Correction |
| --- | --- | --- |
| Haute | `POST /api/ai-stream` appelait le fournisseur sans session. Reproduction sur le serveur construit d'origine : HTTP 200, un appel fournisseur simulé, sans cookie ni jeton. | Session Better Auth obligatoire ; 401 sans session, refus si l'authentification est indisponible, contrôle Origin / Fetch Metadata. Le jeton de prévisualisation est transmis par le client. |
| Haute | Le quota reposait sur une Map locale et des en-têtes `x-forwarded-for` / `x-real-ip` contrôlables par l'appelant. Il n'était pas partagé entre instances. | Quotas atomiques dans `api_rate_limits`, indexés sur l'identité vérifiée : 20 requêtes/minute et 200/jour UTC. Refus 503 si la protection n'est pas disponible et 429 avec Retry-After si le quota est atteint. |
| Haute | L'appelant pouvait choisir un modèle arbitraire avec la clé serveur, sans plafond de sortie ni délai maximal. La reproduction d'origine transmet `arbitrary-client-model` au fournisseur simulé. | Modèle défini uniquement côté serveur ; champs inconnus refusés ; plafond de 1 024 tokens, délai de 45 secondes et signal d'annulation propagé. |
| Moyenne | Le corps JSON était entièrement chargé avant validation. | Limite de 128 Kio vérifiée sur les octets réellement lus, même sans Content-Length ou avec une longueur falsifiée ; plafond cumulé de 32 000 caractères de conversation. |
| Moyenne | Certaines erreurs SSE étaient ignorées et une réponse interrompue ou vide pouvait être présentée comme terminée. Les diagnostics bruts du fournisseur pouvaient être renvoyés. | Parseur SSE commun : erreurs explicites, terminaison obligatoire, décodage UTF-8 fragmenté, fermeture des lecteurs. Messages d'erreur génériques et protection contre les résultats d'une requête déjà annulée. |
| Préventive | L'ancien module `groq-client.ts` prévoyait des clés `VITE_*_API_KEY` dans le navigateur. Aucun import actif de ce module n'a été trouvé : une fuite effective n'est pas démontrée. | Cet accès passe désormais par le proxy authentifié ; aucune lecture de clé fournisseur dans le client. |
| Préventive | Le cache IA était global, conservait les prompts en clair dans ses clés et ignorait la température. | Suppression de ce cache et réponses `private, no-store, no-transform`. |

Les contrôles existants d'identité propriétaire des commandes, de liste explicite
`PURCHASE_ADMIN_USER_IDS` et de transitions commerciales ont été relus. Aucun
nouveau défaut n'a été confirmé sur ces chemins dans ce périmètre ; cela ne
constitue pas une certification de sécurité de toute l'application.

## Validation

- `npm test` : **365 succès**, aucun échec, **4 tests ignorés** faute de base
  PostgreSQL dédiée (`TEST_POSTGRES_URL`). Les dix nouveaux tests IA sont inclus.
- `npm run typecheck` et `npm run lint` : succès.
- `npm audit --json` : **0 vulnérabilité connue signalée** pour le verrouillage
  examiné. Cela ne couvre pas les défauts de logique applicative.
- `npm run postbuild:assets` puis `npm run postbuild:smoke` : succès. Les tests
  exécutent le véritable serveur construit et de vraies sessions Better Auth sur
  PGLite ; seul le fournisseur IA est simulé. Vérifications IA : 401, 403, 400,
  413, 429, panne de quota 503, absence de cache partagé et annulation fournisseur.
  Les contrôles existants des 19 routes UI, des publications, sondages et licences
  passent également.
- Trois assertions préexistantes ont été corrigées sans supprimer les protections
  testées : apostrophe du libellé profil ; détection PWA déplacée dans son hook ;
  exclusion du chemin avatar dans le test interdisant le stockage base64 des
  couvertures. La version initiale avait 317 succès, 3 échecs et 4 tests ignorés
  dans la première phase ; ces échecs empêchaient la phase TypeScript de démarrer.

## Blocages et limites restants

`npm run build` compile l'application, puis échoue au contrôle `postbuild:budget`.
L'échec a été reproduit dans une copie isolée **sans les corrections**, au même
commit de base :

| Élément | Taille observée | Budget |
| --- | ---: | ---: |
| Plus gros fichier JavaScript | 500,8 Kio | 400 Kio |
| `public/__grok/logo-source.png` | 2 912,1 Kio | 512 Kio |
| `public/__grok/optimus-icon.png` | 766,2 Kio | 512 Kio |
| `public/profile-covers/canal.jpg` | 7 010,8 Kio | 512 Kio |
| Total des ressources publiques | 11 455,2 Kio | 2 048 Kio |

Le contrôle de budget reste actif. Les étapes suivantes de copie des ressources et
de test HTTP ont été exécutées séparément pour vérifier le correctif. Le contrôle
complet de livraison reste donc rouge tant que ces ressources ne sont pas optimisées.

La vérification visuelle ordinateur/mobile n'a pas pu être réalisée : Chromium
n'est pas installé et son téléchargement expire dans cet environnement. Les tests
HTTP et SSR ne remplacent pas cette vérification. Ni la connexion au fournisseur IA
réel ni les paramètres de production n'ont été testés.

## Configuration requise

L'accès IA demande maintenant une session réelle, y compris en prévisualisation.
Définir côté serveur `OPENROUTER_API_KEY` ou `GROQ_API_KEY`, et éventuellement
`OPENROUTER_MODEL` / `GROQ_MODEL`. Aucune clé fournisseur ne doit utiliser le préfixe
`VITE_`. Si une clé a déjà été distribuée par ce mécanisme, la révoquer et la remplacer.

Les quotas réutilisent la table `api_rate_limits` et le secret `RATE_LIMIT_SALT`,
déjà employés par d'autres API. Une base durable et `RATE_LIMIT_SALT` sont nécessaires
pour des quotas partagés en production ; PGLite est réservé aux essais locaux.
Les quotas sont par compte, pas une limite de dépense globale du fournisseur.

La gestion des erreurs en cours de flux et l'annulation suivent le contrat décrit
dans la [documentation officielle OpenRouter sur le streaming](https://openrouter.ai/docs/api_reference/streaming).
La facturation après annulation dépend également du fournisseur ; le plafond de
tokens borne chaque génération.
