# Audit Sécurité + Maintenance — Optimus

> Chantier prioritaire sur toutes les features.
> L'app est actuellement piratable en 5 minutes par un étudiant motivé.

## Vérité brutale

3 failles structurelles rendent le contenu premium extractible :

1. Le contenu premium est **dans le bundle JS** → DevTools trivial
2. La vérification Ed25519 est probablement **côté client** → bypass trivial
3. Le repo GitHub est **public** → structure lisible, historique exposé

Aucune bibliothèque anti-piratage ne sauvera ça. Il faut **architecturer autrement**.

## 15 vecteurs classés par criticité

| # | Vecteur | Criticité | Défense |
|---|---------|-----------|---------|
| 1 | Contenu premium dans bundle | 🔴 Critique | AES-256-GCM, clé dérivée licence |
| 2 | Vérif Ed25519 côté client | 🔴 Critique | Vérif server-side |
| 3 | Clé privée Ed25519 dans bundle | 🔴 Catastrophe | Server-only |
| 4 | Service Worker cache premium | 🔴 Critique | Jamais de déchiffré en cache |
| 5 | Source maps exposées en prod | 🟠 Élevé | sourcemap: false |
| 6 | Supabase RLS absent | 🔴 Critique | Audit RLS + test |
| 7 | JWT dans localStorage | 🟠 Élevé | HttpOnly cookies |
| 8 | API sans rate limit | 🟠 Élevé | Rate limit /api/licenses |
| 9 | Repo public + .env historique | 🔴 Critique | git filter-repo + rotation |
| 10 | Pas de CSP | 🟠 Élevé | CSP strict + nonce |
| 11 | DevTools ouvert = tout visible | 🟡 Moyen | Détection + obfuscation |
| 12 | Aucun watermark premium | 🟡 Moyen | UUID user invisible |
| 13 | Partage de compte non détecté | 🟡 Moyen | Max sessions |
| 14 | Termux dev = clés en clair | 🟠 Élevé | Chiffrement disque |
| 15 | Pas de monitoring d'abus | 🟡 Moyen | Sentry + alertes |

## Architecture cible - beton arme

**Regle d'or** : Si le contenu premium est dans le bundle, c'est pirate.

### Schema

CLIENT (PWA) : Contenu FREE en clair, PREMIUM chiffre AES-256-GCM
SERVEUR (API) : Verif Ed25519 + JWT session 24h + rate limit
POSTGRES : RLS activee + politiques par user_id

### 5 piliers

- Pilier 1 : Verification licence server-side (cle privee jamais cote client)
- Pilier 2 : Chiffrement AES-256-GCM, dechiffrement en memoire uniquement
- Pilier 3 : Watermark UUID user dans chaque fiche premium
- Pilier 4 : Headers stricts (CSP nonce, HSTS, X-Frame-Options DENY)
- Pilier 5 : Repo public = free uniquement, premium = repo prive separe

## Prompt devx - Securite (4 sous-sessions)

S1 : Verification licence server-side (API route + Ed25519 + JWT)
S2 : Chiffrement contenu premium (AES-256-GCM, cle derivee du JWT)
S3 : Headers securite + audit git (CSP, HSTS, filter-repo si fuite)
S4 : Watermarking + monitoring (Sentry + UUID user)

## Prompt devx - Maintenance (2 sous-sessions)

M1 : CI/CD + tests (GitHub Actions + tests moteur ECG)
M2 : Outillage qualite (Renovate + npm audit + bundle analyzer)

## Cible realiste

Rendre le piratage couteux et risque, pas impossible.
