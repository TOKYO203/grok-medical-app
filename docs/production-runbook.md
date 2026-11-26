# Optimus — Production runbook

This runbook covers the minimum operational controls required before V1 production traffic.

## 0. Rotating the admin password (do both halves)

`/api/admin-verify` checks a **PBKDF2 hash stored in `admin_config`** first and
only falls back to `process.env.ADMIN_PASSWORD` when no hash exists. Rotating the
platform variable alone therefore leaves the old password valid — this was proven
during the 2026-10-17 incident: production still answered `{"valid":true}` to the
leaked password after `ADMIN_PASSWORD` had been replaced.

Rotation is complete only when **both** are updated:

1. the platform variable `ADMIN_PASSWORD` (production / preview / development);
2. the `admin_password_hash` row in `admin_config`.

From a machine that can reach the database (port 5432 open, `DATABASE_URL` set):

```bash
node scripts/set-admin-password.mjs '<new-password-min-8>'
```

From inside the deployment (the production `DATABASE_URL` is a write-only
"sensitive" variable), use the temporary maintenance route described in
`docs/SECURITY-AUDIT.md` § *Incident 2026-10-17* — a token-guarded route that
must be reverted as soon as the hash is rewritten.

Always verify afterwards, from outside:

```bash
curl -s -X POST https://<host>/api/admin-verify \
  -H 'Content-Type: application/json' -d '{"adminKey":"<old>"}'   # must be {"valid":false}
curl -s -X POST https://<host>/api/admin-verify \
  -H 'Content-Type: application/json' -d '{"adminKey":"<new>"}'   # must be {"valid":true}
```

A single `{"valid":true}` on the old password means the rotation did not happen.

## 1. Required production configuration

Keep secrets in the deployment platform and GitHub repository secrets. Never commit values.

- `DATABASE_URL`
- `BETTER_AUTH_URL`
- `BETTER_AUTH_SECRET`
- `CONTENT_EDITOR_USER_IDS`
- `PURCHASE_ADMIN_USER_IDS`
- `RESPONSE_SALT`
- `RATE_LIMIT_SALT`
- `TRUST_PROXY_HEADERS`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `SUPABASE_PUBLIC_BUCKET`
- Mobile Money provider/account/instructions variables
- signing keys used by Deck/license issuance
- international card payments (see `docs/PAYMENTS-INTERNATIONAL.md`):
  `LEMONSQUEEZY_WEBHOOK_SECRET` (absent ⇒ the webhook answers **503** and
  accepts nothing), `LEMONSQUEEZY_API_KEY`, `LEMONSQUEEZY_STORE_ID`,
  `VITE_LEMONSQUEEZY_STORE_SLUG`, `VITE_LEMONSQUEEZY_VARIANT_ID` (absent ⇒ the
  card button stays visible but announces the shop is not open — it never sends
  a buyer to a non-existent checkout) and `SUPABASE_SERVICE_ROLE_KEY` (absent ⇒
  the webhook answers **503** so Lemon Squeezy retries instead of losing a paid
  order)

  Lemon Squeezy webhook to declare: `POST https://<domain>/api/webhooks/lemonsqueezy`,
  event `order_created`, signature secret = `LEMONSQUEEZY_WEBHOOK_SECRET`.
  ⚠️ the secret **and the URL** differ between test mode and live mode.
  After go-live, clean the test licences: `select count(*) from webhook_events
  where detail->>'testMode' = 'true';`

### 1 bis. Cloudflare Pages — variables d'exécution (incident du 2026-10-22)

Un fichier `.env.production` versionné est un fichier de **build** : il inline les
`VITE_*` dans le bundle mais ne crée **aucune** variable pour le worker. Le
bouton « Payer par Carte » a répondu 503 en production pour cette raison.

Checklist après chaque changement d'environnement :

1. Cloudflare Pages → **Settings → Variables and Secrets** (Production **et**
   Preview) :
   - `DATABASE_URL` (secret) — sans elle, la base retombe sur PGLite/WASM et
     **aucune** commande ne peut être enregistrée : le paiement est refusé ;
   - `SUPABASE_URL` + `SUPABASE_ANON_KEY` (recommandé ; le code sait aussi lire
     les `VITE_*` inlinées, mais une variable d'exécution reste prioritaire) ;
   - `SUPABASE_SERVICE_ROLE_KEY`, `LICENSE_JWT_SECRET`, `LICENSE_PUBLIC_KEY`,
     `LEMONSQUEEZY_*`, `UPSTASH_REDIS_REST_URL/TOKEN`.
2. Cloudflare Pages → **Settings → Runtime → Compatibility flags** :
   `nodejs_compat` doit être actif (nécessaire à `pg`/`pg-cloudflare`,
   `node:crypto`, `node:buffer`).
3. Redéployer, puis mesurer **l'environnement réel** (pas le poste de dev) :

```bash
curl -s https://<domaine>/api/health/checkout | jq
npm run payment:readiness -- --host https://<domaine>
```

`ready: true` est la seule preuve acceptable avant d'annoncer la vente. Cet
endpoint ne renvoie que des booléens et une source de base — jamais une URL ni
une clé.

For staging validation, GitHub Actions expects `SUPABASE_STAGING_DATABASE_URL` and the workflow `Supabase staging DB validation` must be launched with confirmation `STAGING`.

## 2. Release gate

Before a release candidate:

```bash
npm ci --legacy-peer-deps
npm run release:check
```

The release is blocked if tests, TypeScript, lint, build, post-build smoke tests or database migrations fail.

## 3. Safe observability

Every API response receives an `x-request-id`. Server logs use structured JSON and record only:

- request id
- HTTP method
- URL pathname (never query parameters)
- status code
- duration
- error class name for failures

Do not add request bodies, cookies, authorization headers, raw IPs, medical answers, payment proof bytes or user identifiers to application logs.

For incident support, ask for the request id shown by the client/platform and correlate it with deployment logs.

## 4. Database backup and recovery

**Deux dispositifs distincts, à ne pas confondre :**

| Dispositif | Ce qu'il fait | Ce qu'il ne fait pas |
| --- | --- | --- |
| `db-recovery.yml` (existant) | teste la **procédure** sur un PostgreSQL jetable | ne sauvegarde pas la production |
| **`db-backup.yml`** (2026-11-12) | sauvegarde **réellement** les deux bases de production, puis restaure le dump dans un PostgreSQL jetable | ne remplace pas le PITR du fournisseur |

### 4.1 Sauvegarde quotidienne de production (`db-backup.yml`)

`scripts/backup-postgres.mjs` produit un `pg_dump` chiffré **en flux** (le dump
n'existe jamais en clair sur le disque), avec empreinte SHA-256 et manifeste.

Cibles (deux projets Supabase, cf. `docs/V1-READINESS.md` § P0-6) :

- `DATABASE_URL` → base applicative (comptes, commandes, signalements, webhooks) ;
- `SUPABASE_DB_URL` → projet Supabase client (profils, licences) — DSN
  « session pooler » à récupérer dans le dashboard Supabase.

Secrets GitHub Actions à créer (Settings → Secrets and variables → Actions) :

| Secret | Rôle |
| --- | --- |
| `DATABASE_URL` | DSN de la base applicative |
| `SUPABASE_DB_URL` | DSN du projet Supabase client |
| `BACKUP_ENCRYPTION_KEY` | phrase de passe ≥ 32 caractères (stockée **aussi** hors GitHub, sinon les archives sont indéchiffrables) |

Diagnostic sans secret, exécutable n'importe où :

```bash
npm run backup:plan
```

Objectifs de service :

| Indicateur | Valeur |
| --- | --- |
| RPO (perte de données maximale) | **24 h** (cron quotidien à 02:17 UTC) |
| RTO (temps de remise en service visé) | **2 h** (restauration vérifiée sur PostgreSQL jetable) |
| Rétention des artefacts | 30 jours |
| Vérification automatique | chaque exécution restaure le dump et exige `_migrations` non vide |

Limite assumée à ce stade : les artefacts GitHub expirent et ne sont pas un
stockage hors site. Étape suivante (non livrée) : copie chiffrée vers un bucket
objet (R2/S3) avec rétention longue. Le PITR du fournisseur reste la première
ligne de défense et doit être activé dans les deux projets Supabase (rétention
≥ 7 jours).

A production recovery must never be rehearsed against the live primary database.

### Manual recovery outline

```bash
pg_dump --format=custom --no-owner --no-acl "$DATABASE_URL" > optimus.dump
createdb "$RESTORE_DATABASE"
pg_restore --no-owner --no-acl --exit-on-error --dbname="$RESTORE_DATABASE" optimus.dump
```

After restoring, point a staging instance at the restored database and execute smoke tests before any traffic switch.

Avec le dispositif `db-backup.yml`, la restauration manuelle part d'une archive
chiffrée de l'artefact :

```bash
openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_ENCRYPTION_KEY \
  -in app-<horodatage>.dump.enc -out optimus.dump
pg_restore --no-owner --no-acl --exit-on-error --dbname="$RESTORE_DATABASE_URL" optimus.dump
```

### 4.2 Exercice de restauration trimestriel

À faire tous les 90 jours, et à dater ici (une sauvegarde jamais restaurée n'est
pas une sauvegarde) :

- [ ] dernier exercice : _à dater_
- [ ] procédure suivie de bout en bout depuis l'artefact chiffré le plus récent
- [ ] écarts constatés consignés dans `docs/DECISIONS.md`

## 5. Security monitoring

### 5.1 Erreurs serveur et uptime (2026-11-12)

Trois briques, aucune dépendance externe obligatoire :

| Brique | Ce qu'elle fait | Activation |
| --- | --- | --- |
| `GET /api/health` | sonde triviale (aucune base, aucune config) : `{status:"ok"}`, `no-store`, `noindex`, HEAD supporté | toujours disponible |
| `server/middleware/00-observability.ts` + `server/lib/error-alert.ts` | sur exception ou réponse 5xx : log JSON existant **+** alerte webhook (Slack/Discord/Teams/n8n), une fois par signature et par minute | secret `ERROR_ALERT_WEBHOOK` |
| `scripts/uptime-check.mjs` + `.github/workflows/uptime.yml` | toutes les 15 min : exige HTTP 200 + JSON `status:"ok"` ; en cas d'échec, job rouge et webhook | secret `UPTIME_ALERT_WEBHOOK` (optionnel), variable `UPTIME_URL` (optionnel) |

Ce que l'alerte ne contient **jamais** : corps de requête, en-tête, cookie,
query string, IP, identifiant utilisateur. Elle porte `requestId`, méthode,
chemin, statut, nom d'erreur et durée — assez pour corréler avec les logs du
worker, inutile pour un attaquant.

Diagnostic manuel :

```bash
curl -s https://optimus.carabin.workers.dev/api/health | jq
npm run uptime:check              # échoue avec un code 1 si la prod ne répond pas
```

Sans webhook configuré, le dispositif reste utile : les 5xx sont journalisés et
la sonde planifiée devient rouge dans GitHub Actions.

⚠️ **Ordre de déploiement** (vérifié le 2026-11-12) : la production répond encore
404 sur `/api/health`, la route n'étant pas publiée. Le cron `uptime.yml` doit
être activé **après** le déploiement du Worker qui l'embarque ; sinon chaque
exécution échouera — à juste titre, mais sans information utile.

En local, la sonde se vérifie sans déployer :

```bash
npm run dev &
curl -s http://127.0.0.1:8080/api/health | jq   # {"status":"ok",...}
```

### 5.2 GitHub security automation

GitHub security automation provides:

- CodeQL analysis for JavaScript/TypeScript;
- a production dependency audit that fails on high/critical vulnerabilities;
- Dependabot weekly npm and GitHub Actions updates.

Treat new high/critical findings as release blockers until triaged.

GitHub dependency review requires Dependency Graph to be enabled at repository level; it can be added as an extra PR-level control once that setting is available. Repository/platform secret scanning should remain enabled where supported. Rotate any secret immediately if it ever appears in git history or build logs.

## 6. Incident priorities

### P0 — stop traffic / revoke access

- signing/private key exposure;
- database credential exposure;
- cross-account data access;
- unauthorized Premium delivery or admin access;
- evidence of modified signed medical content.

### P1 — investigate immediately

- sustained 5xx spike;
- repeated 429 bursts on activation/upload/survey routes;
- abnormal payment verification volume;
- database latency or migration failure.

## 7. Go-live checklist

- `release:check` green on the exact release commit;
- CodeQL/security checks green or explicitly triaged;
- Supabase staging migrations validated;
- OAuth tested with at least two independent sessions/devices;
- real Mobile Money flow validated end to end;
- database recovery smoke green;
- medical Deck V1 human review complete;
- retention/anonymization policy approved (see docs/DATA-RETENTION.md);
- rollback target and previous deploy identified.
