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

---

## Incident 2026-10-17 — mot de passe admin exposé (alerte GitGuardian)

> Statut : **révoqué en production**, historique **non purgé** (choix assumé, voir § Purger).

### Ce qui a fuité

| Élément | Où | Quand |
|---|---|---|
| Mot de passe du back-office `/admin` en clair | `src/routes/admin-debug.tsx`, bouton « Simuler login » (`setAdminKey("…")`) | commit `a87d8d4`, 2026-09-21 11:41 |

Le fichier a été supprimé **trois minutes plus tard** (`1e7d3a4`). Supprimer un
fichier ne le retire pas de l'historique : le blob restait lisible par quiconque
clone le dépôt public, et les détecteurs de secrets (GitGuardian, scan de
GitHub) continuent de l'y trouver. C'est le seul secret réellement présent dans
l'historique.

Deux valeurs voisines ont été vérifiées et **ne sont pas** dans l'historique git :
`LICENSE_SIGNING_PRIVATE_KEY` et `DATABASE_URL` de `.env.local` (fichier ignoré,
jamais committé, ainsi que ses copies `.bak/.env.local.bak.*`).

### Pourquoi la rotation de la variable n'a pas suffi

`/api/admin-verify` valide d'abord contre un **hash PBKDF2 stocké en base**
(`admin_config`, migration `0013`), et ne retombe sur `process.env.ADMIN_PASSWORD`
que si aucun hash n'existe. Remplacer la variable Vercel laissait donc l'ancien
mot de passe parfaitement valide — vérifié en production : `{"valid":true}`
après rotation de la variable, `{"valid":false}` seulement après réécriture du
hash.

La chaîne `DATABASE_URL` de production est une variable Vercel « sensitive »
(non relisible) et le port 5432 est filtré depuis le poste de dev : le hash ne
pouvait être réécrit que **depuis le déploiement**. Une route temporaire
`/api/admin-rotate` protégée par un jeton de 256 bits, déployée puis retirée
(revert `0b52106`), a servi à réécrire le hash. Elle répond aujourd'hui `404` et
son jeton a été supprimé des deux environnements.

### Remédiation effectuée

1. `ADMIN_PASSWORD` remplacé par un secret aléatoire de 32 caractères (Vercel
   production + preview + development), puis **hash en base réécrit**.
2. Vérifié en production : `{"adminKey":"<ancien>"}` → `{"valid":false}` ;
   nouveau mot de passe → `{"valid":true}`.
3. Route de rotation révoquée (`404`) et supprimée du code.
4. `.env.local` local aligné sur le nouveau secret (fichier ignoré par git).

### Prévention

| Garde-fou | Fichier | Ce qu'il empêche |
|---|---|---|
| `npm run secret:scan` | `scripts/secret-scan.mjs` | scan gitleaks de l'**index** (avant commit) ou de tout l'historique (`--history`) |
| Job CI `secret-scan` | `.github/workflows/security.yml` | bloque toute **nouvelle** fuite sur le delta de la PR, sans rendre le job rouge à cause de la fuite historique |
| `secret-hygiene.test.mjs` | `scripts/secret-hygiene.test.mjs` | refuse un `setAdminKey("…")`/`password = "…"` littéral dans `src/`, interdit qu'un `.env` soit suivi, interdit la réapparition d'`admin-debug.tsx` |
| Règle `optimus-hardcoded-admin-key` | `.gitleaks.toml` | les détecteurs génériques ne voyaient pas ce motif (appel de fonction ≠ `KEY=value`) : la règle le nomme |

### Purger un secret de l'historique

**Non fait volontairement.** Réécrire l'historique change les SHA de ~850 commits
et impose un `push --force` sur `main` + les 8 branches distantes : les PR
ouvertes, les liens de déploiement Vercel/Cloudflare et tout clone existant
cassent. Le secret étant révoqué, l'urgence est passée ; la purge se planifie.

Quand ce sera le moment (fenêtre calme, aucune PR ouverte) :

```bash
# 0. Sauvegarde complète : la réécriture est irréversible côté GitHub.
git bundle create ../grok-medical-app-backup-$(date +%s).bundle --all

# 1. Purger le fichier de tout l'historique (git filter-repo, à installer :
#    pip install git-filter-repo).
git filter-repo --path src/routes/admin-debug.tsx --invert-paths --force

# 2. Vérifier AVANT de pousser : le scan doit repasser au vert.
node scripts/secret-scan.mjs --history

# 3. Pousser (les autres clones devront être refaits).
git push --force --all origin && git push --force --tags origin
```

Étape 4, à ne pas oublier : demander à GitHub le nettoyage des objets
inaccessibles (Settings → Support, « remove cached views / purge unreachable
commits ») — sans cela les anciens commits restent atteignables par SHA pendant
un temps. Puis révoquer l'alerte GitGuardian en la marquant « revoked ».

### Leçon à retenir

Une valeur secrète ne s'écrit **jamais** dans `src/`, pas même dans une page de
debug temporaire. Un bouton de simulation lit `process.env` côté serveur ou une
saisie ; il ne transporte pas la valeur. Et supprimer le fichier ne suffit pas :
seule la **rotation** ferme la faille, la purge ne fait que nettoyer la trace.
