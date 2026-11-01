# SECURITY — Politique de securite Optimus

**Derniere mise a jour** : 2026-11-01

---

## Principe general

Optimus est une PWA educative, **pas un dispositif medical**. La politique de securite vise a :
1. Proteger les comptes utilisateurs (email, progression)
2. Proteger les paiements (MVola, Lemon Squeezy)
3. Proteger le contenu premium contre le partage sauvage
4. Empecher les abus d'API (cout LLM, brute-force)

**Risque accepte** : le code front-end est public. On ne cherche pas a le "cacher", mais a rendre le piratage **couteux, detectable et sans interet**.

---

## 1. AUTHENTIFICATION

### Prod : Supabase Auth

- Sessions verifiees via `authMiddleware` / `requireUserId` / `getSessionUser`
- **Source de verite** : `src/lib/auth/verify.server.ts`
- **Sessions stockees cote Supabase** (jamais cote client)
- **Fallback Better Auth** : uniquement pour sandbox/preview

### Comportement en cas d'echec

| Cas | Comportement |
|---|---|
| Jeton invalide | `UnauthorizedError` (401) |
| Supabase injoignable | `IdentityUnavailableError` (503) — reessayer |
| Pas de jeton | Better Auth fallback (preview only) |

### Regles strictes

- **Jamais faire confiance a un user id envoye par le client**
- **Toujours** verifier via `requireUserId` avant toute action sensible
- **Fail closed** : en cas de doute, rejeter

---

## 2. RATE LIMITING

### Implementation

- **Source de verite** : `src/lib/security/rate-limit.server.ts`
- **Prod** : Upstash Redis
- **Fallback** : memoire par Worker (degrade mais fonctionnel)

### Limites configurees

| Endpoint | Limite | Fenetre |
|---|---|---|
| `/api/ai-stream` | 20 req | 1 min |
| `/api/checkout/lemonsqueezy` | 10 req | 1 min |
| `/api/admin-verify` | custom | 5 min |

### Regle "IP de confiance"

**Ne JAMAIS lire `x-forwarded-for` directement** : un attaquant peut le falsifier pour contourner le rate limit. Toujours utiliser le helper `rateLimitRequest` qui extrait l'IP **fiable** cote Cloudflare.

---

## 3. SECRETS

### Stockage

| Fichier | Contenu | Versionne ? |
|---|---|---|
| `.env.local` | Secrets dev (ARIARI, DATABASE_URL, SERVICE_ROLE) | Non (ignore) |
| `.env.production` | VITE_* publiques uniquement | Oui (versionne) |
| Cloudflare env vars | Secrets prod (via dashboard) | N/A |

### Regles

- **Jamais** de secret en dur dans `src/`
- **Jamais** de `process.env` lu au top-level d'un module (Cloudflare Workers rejette)
- Toujours wrapper : `function getSecret() { return process.env.X }`

### Rotation

| Secret | Frequence |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Trimestrielle |
| `ARIARI_SECRET` | Trimestrielle |
| `LEMONSQUEEZY_WEBHOOK_SECRET` | Trimestrielle |
| `LICENSE_SIGNING_PRIVATE_KEY` | Annuelle |

---

## 4. WEBHOOKS

### Lemon Squeezy

- **Signature HMAC-SHA256** verifiee via `verifyLemonSignature`
- **Header** : `X-Signature`
- **Idempotent** : `deliverLemonEvent` ignore les doublons
- **503 sur erreur transitoire** : Lemon rejoue (200 perdrait le paiement)

### Ariari (MVola)

- Ariari **ne documente pas** de signature HMAC publique
- **On ne fait PAS confiance au payload** : `fetchAriariPayment(paymentId)` interroge l'API Ariari a chaque hit
- **Seul PAID declenche** la creation de licence
- **Idempotent** via `idempotencyKey: ariari-{paymentId}`

### Regles communes

- Toujours verifier la source avant tout effet metier
- Retourner 503 (pas 200) sur erreur transitoire (permet le rejeu)
- Retourner 400 (pas 500) sur payload invalide
- Logs sans donnees sensibles

---

## 5. ROW LEVEL SECURITY (Supabase)

### Tables protegees

| Table | RLS | Politique |
|---|---|---|
| `institution_leads` | Activee | SELECT limite, INSERT public |
| `licences` | A verifier | |
| `purchase_orders` | A verifier | |
| `profiles` | A verifier | |

### A faire

- Auditer toutes les tables Supabase : RLS activee + policies restrictives
- Test manuel : un user A ne doit pas lire les donnees de user B
- Migration dediee pour chaque table manquante

---

## 6. CVE & DEPENDANCES

### Etat actuel (2026-11-01)

- **npm audit** : 0 CVE production
- **14 CVE moderate dev-only** (eslint, minimatch) : sans impact prod
- `jimp` (29 CVE high) supprime (code mort)
- `zod` a jour (4.6.7, CVE patchee)

### Regles

- **Jamais** `npm audit fix --force` (breaking changes non maitrises)
- Auditer chaque CVE : dev ou prod ?
- Si dev-only : accepter (documenter dans ce fichier)
- Si prod : patcher immediatement

---

## 7. ANTI-PIRATAGE (roadmap)

### Aujourd'hui

- Licences **90 jours** (pas d'acces a vie)
- Signature JWT des licences (`LICENSE_SIGNING_PRIVATE_KEY`)
- Contenu servi par RPC `deliver_lemon_event` cote serveur

### A ajouter (roadmap)

- **JWT offline** : le client verifie la signature localement
- **Periode de grace 7 jours** : si JWT expire hors ligne, l'app fonctionne normalement
- **URLs signees** : pour les fichiers JSON premium (a considerer si partage constate)

---

## 8. LOGS & MONITORING

### Actuel

- Logs `console.info` / `console.error` cote serveur (Cloudflare Logs)
- Pas de Sentry / APM pour l'instant

### A ajouter (roadmap)

- **Sentry** (gratuit 5k events/mois) : erreurs en prod
- **Alertes Supabase** : tentatives auth echouees anormales
- **Cloudflare Analytics** : pics de trafic suspects

---

## 9. CHECKLIST DEPLOIEMENT

Avant chaque deploy prod :

- [ ] `npm run typecheck` : 0 erreur
- [ ] `npm audit` : pas de nouvelle CVE prod
- [ ] Aucun `process.env` top-level ajoute
- [ ] Aucun secret en dur dans `src/`
- [ ] Nouvelle route API : auth + rate limit
- [ ] Nouvelle table Supabase : RLS activee
- [ ] Nouveau webhook : signature verifiee

---

## 10. CONTACTS & ESCALADE

En cas d'incident securite :

1. **Revoquer** les secrets compromis (Cloudflare + Supabase)
2. **Forcer** re-login des utilisateurs (invalider sessions)
3. **Documenter** dans ce fichier (section "Incidents")
4. **Communiquer** si donnees utilisateurs touchees

---

## Incidents passes

### 2026-10-28 — Fuite `.env.local.qa-orig`

- Fichier backup avec `ADMIN_PASSWORD`, `DATABASE_URL`, `MOBILE_MONEY_*` cree par accident
- **Action** : fichier supprime + `*.qa-orig` ajoute au .gitignore
- **Impact** : aucun (fichier non pousse sur GitHub)
