# Optimus — Production runbook

This runbook covers the minimum operational controls required before V1 production traffic.

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

For staging validation, GitHub Actions expects `NEON_STAGING_DATABASE_URL` and the workflow `Neon staging DB validation` must be launched with confirmation `STAGING`.

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

Production backups must be managed by the PostgreSQL provider with point-in-time recovery where available. In addition, the repository includes a disposable PostgreSQL backup/restore smoke workflow that:

1. applies Optimus migrations to an ephemeral PostgreSQL instance;
2. creates a recovery probe;
3. produces a `pg_dump` custom-format backup;
4. destroys and recreates the database;
5. restores with `pg_restore`;
6. verifies both the recovery probe and `_migrations` history.

A production recovery must never be rehearsed against the live primary database.

### Manual recovery outline

```bash
pg_dump --format=custom --no-owner --no-acl "$DATABASE_URL" > optimus.dump
createdb "$RESTORE_DATABASE"
pg_restore --no-owner --no-acl --exit-on-error --dbname="$RESTORE_DATABASE" optimus.dump
```

After restoring, point a staging instance at the restored database and execute smoke tests before any traffic switch.

## 5. Security monitoring

GitHub security automation provides:

- CodeQL analysis for JavaScript/TypeScript;
- dependency review on pull requests;
- Dependabot weekly npm and GitHub Actions updates.

Treat new high/critical findings as release blockers until triaged.

Repository/platform secret scanning should remain enabled in GitHub settings for the public repository. Rotate any secret immediately if it ever appears in git history or build logs.

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
- Neon staging migrations validated;
- OAuth tested with at least two independent sessions/devices;
- real Mobile Money flow validated end to end;
- database recovery smoke green;
- medical Deck V1 human review complete;
- retention/anonymization policy approved;
- rollback target and previous deploy identified.
