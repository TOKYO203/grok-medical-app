# Sécurité Premium — protection du contenu payant (S1)

> Statut : **livré** (branche `feat/security-premium-s1`, PR draft).
> Périmètre : les 133 fiches servies sous `/content/**` (110 cas « Signes &
> Syndromes » + 23 fiches de nosographie).

---

## 1. Le problème, sans détour

Avant cette session, le contenu payant était un **fichier statique public** :

```bash
curl https://optimusmedical.pages.dev/content/pathologies/paludisme.json
# 200 OK — la fiche entière, sans compte, sans clé, sans licence
```

Le verrouillage « Premium » vivait dans React (`SIGNES_READY`, vues verrouillées,
`locked` panels). Il ne protégeait rien : il masquait un contenu **déjà livré au
navigateur**. N'importe qui pouvait vendre ces fiches après un simple `curl`.

Le défaut de fond n'était pas un oubli de `if` : c'était un **mauvais endroit
pour le contenu**. Un fichier dans `public/` est servi par le CDN *avant* tout
code applicatif — aucun middleware, aucune session, aucun `if` ne s'exécute.

## 2. Ce qui a changé (la décision d'architecture)

| Avant | Après |
| --- | --- |
| `public/content/pathologies/*.json` | `private/content/pathologies/*.json` |
| `public/content/signes/*.json` | `private/content/signes/*.json` |
| servis par le CDN, en clair | servis par `/content/$type/$file`, **sous JWT** |
| cache `immutable` public | `Cache-Control: private` + `Vary: Authorization, Cookie` |

Le contenu est compilé **dans le bundle serveur** (`import.meta.glob` avec
`?raw`, voir `src/lib/content/protected-assets.server.ts`). Conséquences :

* rien n'est publié dans le dossier statique — le CDN ne peut pas le servir ;
* cela fonctionne aussi sur **Cloudflare Workers**, où il n'y a pas de système
  de fichiers et où un `fetch()` vers sa propre origine avait déjà cassé /signes
  (limite de sous-requêtes, DECISIONS.md SIGNES-8) ;
* le contenu n'apparaît dans **aucun chunk client** : un seul module serveur le
  lit, et il est gardé (voir §4).

```
                    ┌──────────────────────────────────────────┐
  navigateur ──────►│ POST /api/licenses/verify                │
  (clé de licence)  │  quota 10/IP/h → nonce → licence → JWT   │
                    └──────────────────┬───────────────────────┘
                                       │ { token, expiresAt }  (24 h, HS256)
                                       ▼
                    localStorage["optimus_session"]  +  cookie optimus_session
                                       │
  navigateur ──────►┌──────────────────▼───────────────────────┐
  (Bearer <jwt>)    │ GET /content/pathologies/paludisme.json  │
                    │  authenticate() → lecture privée → 200   │
                    └──────────────────┬───────────────────────┘
                                       │
                              private/content/**  (bundle serveur)
```

## 3. Endpoints

### `POST /api/licenses/verify`

Échange une **clé de licence** contre un **JWT de contenu** de 24 h.

Requête :

```http
POST /api/licenses/verify
Content-Type: application/json
X-Nonce: 3vT1s9cKq0Yb2Xh5Ld8nWQ      # 16 à 64 caractères [A-Za-z0-9_-]

{ "licenseKey": "OPT1.…", "deviceId": "a1b2c3d4e5f6" }
```

Réponse 200 :

```json
{ "token": "eyJhbGciOi…", "expiresAt": 1790000000000, "expiresIn": 86400, "tier": "premium" }
```

| Statut | Corps | Quand |
| --- | --- | --- |
| 200 | `{ token, expiresAt, … }` | licence valide |
| 400 | `{ "error": "nonce_required" }` | `X-Nonce` absent ou mal formé |
| 400/413 | `{ "error": "invalid_body" }` | corps absent, non-JSON ou > 2 Kio |
| 401 | `{ "error": "unauthorized" }` | clé inconnue / expirée / révoquée / liée à un autre appareil |
| 429 | `{ "error": "rate_limited" }` | 11<sup>e</sup> requête dans l'heure pour cette IP |
| 429 | `{ "error": "nonce_replayed" }` | nonce déjà consommé |
| 503 | `{ "error": "license_verification_unavailable" }` | base, clé publique ou secret JWT indisponible (**fail closed**) |

Ordre des contrôles (du moins coûteux au plus coûteux) : **quota → nonce →
corps → licence → signature**. Un appelant anonyme ne peut donc pas faire lire
la base pour « gratuit ».

### `GET /content/$type/$file`

| Chemin | Auth | Cache | Contenu |
| --- | --- | --- | --- |
| `/content/pathologies/<slug>.json` | **JWT** | `private, max-age=60` | fiche complète |
| `/content/signes/<id>.json` | **JWT** | `private, max-age=60` | un cas |
| `/content/signes/_catalog.json` | **JWT** | `private, max-age=60` | les 110 cas en une requête |
| `/content/previews/<id>.json` | public | `public, max-age=60` | projection : titre, sous-titre, objectif, intitulés de sections |
| `/content/signes/_index.json` | public | actif statique | manifeste (ids + catégories) |

Sans jeton : `401 { "error": "unauthorized" }`. Jeton expiré ou signé par un
ancien secret : même réponse. Serveur mal configuré : `503`.

## 4. Les gardes (ce qui empêche le contournement)

Quatre points de contrôle, un seul module de décision
(`src/server/content-guard.ts`) :

1. **La route** `/content/$type/$file` appelle `authenticate(request)` **avant**
   toute lecture d'actif.
2. **Le lecteur serveur** des fiches (`src/lib/pathologies/asset-reader.server.ts`)
   appelle `authenticateCurrentRequest()`. Indispensable : `createServerFn`
   expose un **endpoint HTTP public** ; un lecteur « interne » non gardé aurait
   été une porte dérobée équivalente au CDN.
3. **Le catalogue « Signes »** n'a plus de chemin serveur : il charge
   `/content/signes/_catalog.json` par `fetchWithAuth()`.
4. **Aucun actif dans `public/`** : la seule copie des fiches est dans
   `private/content/**`.

Verrous automatiques (`npm test`) :

| Test | Ce qu'il interdit |
| --- | --- |
| `scripts/security-license.test.mjs` | quota 10/h, nonce, clé publique seule, 401 générique, absence de cache public, contenu hors `public/`, secrets hors modules serveur |
| `scripts/content-assets-cache.test.mjs` | toute règle de cache public sur `/content/(pathologies\|signes)`, réécriture `_redirects`, fiche publiée dans l'artefact |
| `scripts/bundle-content.test.mjs` | payload de fiche dans un chunk client |
| `src/server/jwt.test.ts` | jeton expiré, altéré, `alg: none`, mauvais palier, secret absent |
| `src/server/replay-guard.test.ts` | rejeu de nonce (mémoire + Redis), panne Redis = refus |
| `src/server/license-verify.test.ts` | signature invalide, jeton expiré, autre clé privée, clé d'activation sans appareil |

## 5. Formats

### Jeton de licence (auto-porteur, émis hors ligne)

```
OPT1.<charge base64url>.<signature Ed25519 base64url>
```

* charge = `{ "v": 1, "licenseId": "…", "tier": "premium", "product": "OPTIMUS_PRO", "exp": 1790000000 }`
  (`exp` optionnel = licence perpétuelle) ;
* message signé = `OPTIMUS-LICENSE-TOKEN-V1\n` + `OPT1.<charge>` (octets exacts,
  aucune re-sérialisation JSON : pas de divergence d'ordre de clés) ;
* vérification avec la **clé publique seule** (`LICENSE_PUBLIC_KEY`).

### Clé d'activation (parcours commercial existant)

`OPT-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX`. Vérifiée en base
(`activation_keys`) sur un **SHA-256**, avec `revoked_at is null`,
`expires_at > now()`, et **liaison à l'appareil obligatoire** : `deviceId` est
exigé et doit correspondre à celui qui a activé la clé. Une clé volée ne peut
donc pas fabriquer de jeton depuis un autre poste. Une clé jamais activée ne
produit rien — l'activation est ce qui la lie à un appareil.

### JWT de contenu

```
alg HS256 · iss optimus-medical · aud optimus-content
sub/ licenseId = <id de licence> · tier premium · iat · exp (iat + 24 h)
```

Pourquoi HS256 et non Ed25519 : le jeton ne sert qu'à autoriser une lecture
pendant 24 h, il n'a pas besoin d'être vérifiable par un tiers. La signature
Ed25519 reste utilisée là où elle a du sens — **la clé de licence**, émise sur
la machine du propriétaire et vérifiée par un serveur qui ne connaît que la
moitié publique.

## 6. Variables d'environnement

| Variable | Obligatoire | Rôle |
| --- | --- | --- |
| `LICENSE_PUBLIC_KEY` | oui | clé **publique** Ed25519 (base64url brut 32 octets, ou SPKI, ou hex 64) |
| `LICENSE_JWT_SECRET` | oui | secret HMAC ≥ 32 caractères ; **jamais** préfixé `VITE_` |
| `UPSTASH_REDIS_REST_URL` | recommandé | anti-replay atomique **et** compteur de quota partagé entre instances |
| `UPSTASH_REDIS_REST_TOKEN` | recommandé | jeton Upstash |
| `LICENSE_SIGNING_PRIVATE_KEY` | hors plateforme | **uniquement** pour signer les reçus d'activation (`/api/licenses/activate`) — déjà en place |

Repli : sans `LICENSE_PUBLIC_KEY`, `src/server/license-verify.ts` utilise
`VITE_LICENSE_SIGNING_PUBLIC_KEY` (même paire, déjà provisionnée pour vérifier
les reçus côté navigateur). Les deux sont **publiques**.

### Générer la paire de clés (sur la machine du propriétaire, hors dépôt)

```bash
mkdir -p ~/.optimus-keys
openssl genpkey -algorithm ed25519 -out ~/.optimus-keys/license-token.pem
# Clé privée au format PKCS#8 DER base64url (ce qu'attend le script d'émission)
openssl pkcs8 -topk8 -nocrypt -in ~/.optimus-keys/license-token.pem -outform DER \
  | base64 | tr '+/' '-_' | tr -d '=\n' > ~/.optimus-keys/license-token.key
# Clé PUBLIQUE brute 32 octets, base64url
openssl pkey -in ~/.optimus-keys/license-token.pem -pubout -outform DER \
  | tail -c 32 | base64 | tr '+/' '-_' | tr -d '=\n'
```

La dernière ligne donne la valeur de `LICENSE_PUBLIC_KEY`. La clé privée ne
quitte **jamais** `~/.optimus-keys/`.

### Générer un jeton de licence

```bash
node scripts/issue-license-token.mjs --license-id OM-1A2B3C4D --expires 2027-06-30
node scripts/issue-license-token.mjs --license-id ecole-antananarivo --json
```

La clé privée est lue dans `--key-file`, sinon `$LICENSE_SIGNING_PRIVATE_KEY`,
sinon `~/.optimus-keys/license.txt`.

### Secret JWT

```bash
openssl rand -base64 48
```

À poser dans **Cloudflare Pages** → Settings → Environment variables
(Production **et** Preview), et dans Vercel/Netlify si ces cibles servent aussi
le module. Sans lui, tout `/content/**` protégé répond 503 (volontairement :
mieux vaut une panne visible qu'un contenu ouvert).

## 7. Comportement du client

* `src/lib/auth/session.ts` — `getToken()` / `setToken()` / `clearToken()` /
  `fetchWithAuth()` / `requestContentToken()`.
* Le jeton est stocké dans `localStorage["optimus_session"]` **et** recopié dans
  un cookie `optimus_session` (SameSite=Lax, `Secure` en HTTPS, non HttpOnly).
  Le cookie est ce qui permet au **rendu serveur** de la fiche d'avoir le jeton
  dès la première requête : un client licencié ne voit jamais clignoter
  « Premium requis ».
* Un `401` sur un appel portant un jeton le **purge** : un jeton signé par un
  ancien secret ne doit pas rester à provoquer des 401 silencieux.
* Jeton expiré : purgé à la lecture ; le bandeau affiche « Votre accès de 24 h a
  expiré » plutôt que « activez votre clé » à quelqu'un qui en a déjà une.
* Activation (`/pro`) : `POST /api/licenses/activate` (reçu signé, droits
  locaux) **puis** `requestContentToken()` (accès au contenu). Sans le second
  appel, l'utilisateur paierait et verrait encore un cadenas.

## 8. Ce qui reste public (assumé)

* `public/content/signes/_index.json` — manifeste : identifiants, libellés de
  catégories, nombre de fiches. Aucun contenu médical.
* `src/content/data/pathologies/_index.json` — manifeste de nosographie (titre,
  spécialité, item du programme) chargé pour afficher `/programme`.
* `/content/previews/<id>.json` — projection **calculée** (titre, sous-titre,
  objectif, intitulés de sections). C'est un teaser, pas une fiche : pas de
  section rédigée, pas de flashcard, pas de carte mentale, pas de liste de
  signes.

Choix produit : un catalogue visible donne envie d'acheter ; un catalogue muet
donne l'impression d'une app vide.

## 9. Vérifications (reproductibles)

```bash
# 1. Sans jeton → 401
curl -i https://<hôte>/content/pathologies/paludisme.json

# 2. Jeton valide → 200
LIC=$(node scripts/issue-license-token.mjs --license-id QA-S1 --expires 2027-12-31)
NONCE=$(node -e "console.log(require('crypto').randomBytes(16).toString('base64url'))")
TOKEN=$(curl -s -X POST https://<hôte>/api/licenses/verify \
  -H 'Content-Type: application/json' -H "X-Nonce: $NONCE" \
  -d "{\"licenseKey\":\"$LIC\"}" | node -pe 'JSON.parse(require("fs").readFileSync(0)).token')
curl -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer $TOKEN" \
  https://<hôte>/content/pathologies/paludisme.json      # → 200

# 3. Jeton expiré → 401 (jeton forgé avec exp passé, ou attente de 24 h)
# 4. Nonce rejoué → 429
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://<hôte>/api/licenses/verify \
  -H 'Content-Type: application/json' -H "X-Nonce: $NONCE" -d "{\"licenseKey\":\"$LIC\"}"
# 5. 11e vérification dans l'heure → 429 (rate_limited)
```

Les mêmes contrôles tournent hors navigateur dans `npm test`
(`scripts/security-license.test.mjs`, `src/server/*.test.ts`) et en navigateur
dans la QA CDP (`.qa-tmp/premium-s1-cdp.mjs`) : fiche verrouillée sans jeton,
fiche complète avec jeton, `/pro` qui débloque, retour au cadenas après purge.

## 10. Limites connues / suivi

1. **Essai Premium (7 jours) et droits achetés sans clé de licence** n'obtiennent
   pas de jeton : le jeton atteste une **licence vérifiable côté serveur**, et
   l'essai est aujourd'hui un état `localStorage`. Décision assumée (un essai
   non vérifiable côté serveur ne peut pas ouvrir un contenu protégé). Suivi :
   émettre un jeton d'essai côté serveur (compte + date de début) si l'on veut
   que l'essai ouvre aussi les fiches.
2. **Quotas et anti-replay mono-instance si Upstash n'est pas configuré** : le
   cache mémoire du nonce et le compteur du limiteur ne voient que l'instance
   courante. Sur Cloudflare Workers (un isolate par requête), « 10 vérifications
   par heure » devient donc « 10 par isolate », et un nonce peut être rejoué sur
   une autre instance. **Configurer `UPSTASH_REDIS_REST_URL` +
   `UPSTASH_REDIS_REST_TOKEN`** : le nonce (`src/server/replay-guard.ts`,
   `SET … NX EX 300`) et le quota (`src/lib/security/rate-limit.server.ts`,
   pipeline `INCR` + `PEXPIRE … NX` + `PTTL`) partagent alors le même backend,
   donc la limite annoncée est réellement globale. Une panne Upstash ne coupe pas
   le service : le limiteur journalise et retombe sur un seau mémoire **par
   instance** (la limite redevient locale, elle n'est jamais nulle), tandis que
   l'anti-replay, lui, reste **fail-closed** (`503`) — les deux doctrines diffèrent
   volontairement : un quota moins strict laisse passer du trafic, un anti-replay
   permissif laisse passer un rejeu.
3. **Rotation du secret JWT** : changer `LICENSE_JWT_SECRET` invalide tous les
   jetons en circulation (les clients reçoivent 401 → re-saisie de la clé). À
   faire en connaissance de cause ; c'est aussi le levier de révocation globale.
4. **Proxy non-Cloudflare** : `client-ip.server.ts` fait confiance à
   `cf-connecting-ip` quand `cf-ray` est présent (Cloudflare réécrit les deux).
   Derrière un autre proxy, retirer les en-têtes `cf-*`, sinon un client pourrait
   choisir son seau de quota.
5. **Coût CDN** : les fiches ne sont plus servies par le CDN mais par la fonction
   (une requête par fiche, catalogue groupé pour les 110 cas). Volume négligeable
   au regard de la valeur protégée ; à surveiller si le catalogue atteint
   plusieurs centaines de fiches consultées en rafale.

## 11. Journal de la session S1 (2026-10-18) — ce qui a été prouvé, pas seulement codé

Verdict QA CDP `headless_shell` (Playwright ne tourne pas sous Termux), 390×844,
**20 contrôles verts**, identiques en DEV (8080) et sur l'artefact de PROD (8081) :

| # | Contrôle | Mesure |
| --- | --- | --- |
| 1 | Anonyme sur `/pathologie/paludisme` | `data-pathologie-locked` présent, **0** `[data-demarche-section]` dans le DOM |
| 2 | Anonyme sur `/signes` | `data-signes-catalog="locked"`, **0** cas chargé |
| 3 | `POST /api/licenses/verify` (clé signée hors dépôt, nonce neuf) | **200** + jeton |
| 4 | Licencié sur la fiche | **7 sections**, **7** blocs de sources, plus de cadenas |
| 5 | Licencié sur `/signes` | catalogue **110 cas** |
| 6 | Parcours d'un cas | `case` → `deduction` (3 options) → `reveal` (verdict `correct`, 2 sources, `next=item`) |
| 7 | « Cas suivant » | `acromegalie` → `alport` (change réellement de cas) |
| 8 | Purge du jeton (cookie + localStorage) | retour au cadenas, **0** section |
| 9 | Console | **0 erreur** |
| 10 | Débordement 390 px | `scrollWidth − innerWidth = −10` (page plus étroite que la fenêtre : **pas** un débordement — ne pas tester `Math.abs`) |

### Le bug que seule la QA a trouvé : un attribut de test silencieusement absent

`<Page data-pathologie-locked>` **compilait sans erreur** et n'émettait **rien** :
TypeScript n'applique pas le contrôle des props aux attributs `data-*` (noms
hyphenés), donc l'oubli ne se voit pas au typecheck, et React ne transmet un
attribut que si le composant le relaie. `Page` (dans `src/components/shell.tsx`)
ne faisait pas de `...rest`. Résultat : la QA lisait un DOM dépourvu du marqueur
et concluait « page verrouillée absente » alors que la page affichait bien le
cadenas. **Correction** : `Page` accepte `HTMLAttributes<HTMLElement>` et
**spread** `{...rest}` sur `<main>`.

> Règle générale : un composant d'enveloppe qui doit porter des attributs de
> diagnostic (`data-*`) doit les relayer explicitement. Sinon le marqueur ment —
> et c'est pire qu'absent, parce que le test croit mesurer le produit.

### Un garde-fou qui criait au loup sur sa propre documentation

`scripts/content-assets-cache.test.mjs` lisait `public/_headers` **en brut** et
interdisait `/content/(pathologies|signes)/*` n'importe où — y compris dans le
commentaire d'avertissement qui explique pourquoi la règle ne doit pas exister.
Le test échouait donc sur le texte qui documentait sa propre raison d'être.
**Correction** : le test **parse les règles** (`path` + directives, lignes `#`
ignorées) et n'échoue que sur un bloc protégé portant un `Cache-Control` public.
Un garde-fou doit analyser la configuration, pas les commentaires.

### Deux pièges d'attente, spécifiques à `/signes`

1. `/signes` résout son catalogue **côté client** : `data-signes-catalog="loading"`
   est un état normal. Une QA qui lit à cet instant mesure une page en cours de
   chargement et produit un faux négatif. Attendre la **sortie** de `loading`.
2. Le parcours est `case → deduction → reveal` : `[data-signe-option]` n'existe
   **qu'à l'étape 2**. Chercher les options dès l'étape 1 renvoie 0 pour une
   raison qui n'est pas un bug.

### Gates de la session

```
npx tsc --noEmit ......................... 0
npx eslint . ............................. 0 erreur, 0 avertissement
npm test ................................. 488 tests / 484 pass / 4 skipped / 0 échec
npm run build ............................ BUILD_EXIT=0
  ├ budget performance ................... 0 violation (JS client 1901,3 KiB / 1960 KiB)
  └ smoke serveur bâti ................... 19 routes UI + API éditoriale + sondages
```

---

## 12. Cohabitation avec Supabase (backend Phase 1, 2026-10-19)

Cette section répond à une question précise : **le JWT de contenu introduit en S1
et le JWT de session Supabase peuvent-ils se confondre ?** Non — et la réponse est
structurelle, pas déclarative.

### 12.1 Deux jetons, deux mondes

| | **Jeton de contenu** (S1) | **Jeton de session Supabase** |
|---|---|---|
| Émetteur | notre serveur (`iss: optimus-medical`) | Supabase Auth (`<projet>.supabase.co/auth/v1`) |
| Algorithme | **HS256** (secret partagé `LICENSE_JWT_SECRET`) | **RS256/ES256** (clés privées Supabase, clés publiques via JWKS) |
| Audience | `optimus-content` | `authenticated` |
| Durée | 24 h | 1 h (le refresh token est séparé) |
| Stockage client | `localStorage.optimus_session` **+** cookie `optimus_session` (SameSite=Lax, requis pour le SSR) | `localStorage["sb-<ref>-auth-token"]`, géré par `supabase-js` |
| Ce qu'il autorise | `GET /content/{pathologies,signes}/**` | les requêtes PostgREST soumises aux policies **RLS** (`profiles`, `progressions`, `licences`) |
| Ce qu'il n'autorise **jamais** | une requête PostgREST / Supabase | `GET /content/**` |

**Pourquoi l'un ne peut pas usurper l'autre**

- Le garde de contenu (`src/server/content-guard.ts` → `verifyContentToken`) impose
  **HS256 + `iss` + `aud`**. Un JWT Supabase est asymétrique : la vérification HMAC
  échoue, même si l'attaquant connaît la clé publique Supabase. Il n'existe aucun
  chemin de code qui accepte un jeton sans vérifier l'audience.
- Symétriquement, PostgREST rejette le jeton de contenu : il est signé avec un secret
  que Supabase ignore, et son audience n'est pas `authenticated`.

**Règles à ne jamais enfreindre**

1. La clé **`service_role`** ne quitte jamais le serveur (elle contourne RLS). Le
   navigateur ne reçoit que `VITE_SUPABASE_ANON_KEY`.
2. Un `user_id` **envoyé par le client** n'est jamais une preuve d'identité (IDOR).
   L'identité vient du jeton vérifié côté serveur, point.
3. `user_metadata` (y compris un éventuel champ `tier`) est **modifiable par
   l'utilisateur** : ce n'est pas une source de droits.

### 12.2 Pourquoi le JWT de contenu survit à Supabase

Le jeton de contenu n'est pas un jeton d'identité : c'est un **reçu d'achat** émis
après vérification d'une signature **Ed25519** (clé publique seule) ou d'une clé
d'activation en base. Supabase ne connaît pas ces licences, et les faire transiter
par lui reviendrait à déplacer la décision d'accès chez un tiers.

Répartition retenue :

- **Supabase** = identité + données de progression (RLS) ;
- **JWT de contenu (S1)** = droit d'accès au contenu Premium ;
- **point de jonction** = le `sub` / `user_id` Supabase.

### 12.3 Phase 2 (paiement) — contrat préparé, non implémenté

L'endpoint **existe déjà** : `POST /api/licenses/verify` (voir §3). Il n'y a **pas**
de second handler à créer — un doublon ferait exactement le bug de « route
shadowing » documenté au §4 (le gagnant dépend de dev/build). Trois ajouts sont
prévus, dans cet ordre :

1. **`POST /api/licenses/link`** — authentifié par le JWT Supabase
   (`Authorization: Bearer <access_token>`). Vérifie la signature Ed25519 de la clé,
   puis rattache la licence **une seule fois** :
   `insert … on conflict (license_id) do update set user_id = excluded.user_id
    where licences.user_id is null`.
   RLS : `select` autorisé sur `user_id = auth.uid()`, **écriture réservée au service
   role** (le navigateur n'écrit jamais dans `licences`).
2. **`/api/licenses/verify` accepte AUSSI un access token Supabase** : si présent et
   vérifié, on résout `user_id`, on lit la ligne `licences`, et on signe le jeton de
   contenu sans redemander la clé. Le garde de contenu ne change pas d'une ligne.
3. **Vérifier un access token Supabase côté serveur** : jamais de décodage sans
   vérification. Soit `supabase.auth.getUser(jwt)` (aller-retour, fait autorité), soit
   vérification JWKS locale avec cache. `SUPABASE_SERVICE_KEY` reste serveur.

### 12.4 Session Supabase et gate de l'application

- **Source unique** : `src/lib/cloud/session.ts` (store externe +
  `useSyncExternalStore`). Un seul `onAuthStateChange` pour toute l'app, un instantané
  serveur déterministe (pas de mismatch d'hydratation), et un **timeout de 2 s** : une
  requête qui ne répond pas ne bloque plus l'écran.
- **Décision d'accès** : `resolveCloudGate` (`src/lib/cloud/gate.ts`, module pur,
  testé). Les surfaces publiques (tarifs, légal, contact, connexion…) restent
  accessibles sans session — un mur total empêcherait d'acheter avant de s'inscrire.
  Sans variables Supabase, **aucun verrou** n'est ajouté.
- **On ne verrouille que sur une réponse explicite** (`anonymous`). Le statut
  `unavailable` — chunk du SDK non téléchargé hors-ligne, ou aucune réponse dans
  les 6 s — laisse passer en **mode local**. Verrouiller sur une absence de
  réponse rendrait la PWA inutilisable sans réseau, y compris pour du contenu
  déjà en cache ; une session retrouvée rebascule ensuite l'écran sans
  navigation. Le verrou est une commodité d'interface, pas une frontière de
  sécurité (les données sont tenues par RLS, le contenu par le jeton S1).
- **`<Scripts />` toujours rendu, en enfant direct de `<body>`** : c'est le script qui
  hydrate. Placé dans une branche conditionnelle, le HTML SSR ne contient aucun
  script client et l'application reste figée sur son rendu initial — c'était
  exactement le symptôme « Chargement… » infini.
- **Synchronisation** : `decideCloudSync` + `removeSyncedEvents`
  (`src/lib/cloud/sync-policy.ts`, testés). Hors-ligne ⇒ **aucun appel, file
  intacte**. Chaque `upsert` contrôle `error` (PostgREST ne lève jamais), et la file
  n'est purgée qu'après un **succès complet**, uniquement pour les ids réellement
  envoyés.

### 12.5 Vérifications de la session (mesurées, 2026-10-19)

```
HTML SSR /profil .................. contient <script type="module" …> (hydratation possible)
/profil anonyme ................... écran de connexion, splash borné (< 12 s observé ~instantané)
React hydraté ....................  clé __react présente sur le DOM
identifiants invalides ........... « Email ou mot de passe incorrect. » (Supabase joignable)
/tarifs et /login ................ accessibles sans session
débordement horizontal 390×844 ... 0 px
erreurs console .................. 0
```

**Contrôle des tables (lecture seule, clé anon) :**

```
GET /rest/v1/progressions?select=*&limit=1 → 401 (code 42501, permission denied)
GET /rest/v1/profiles?select=*&limit=1     → 401 (code 42501)
GET /rest/v1/licences?select=*&limit=1     → 401 (code 42501)
```

Interprétation : les trois tables **existent** (une table absente renverrait
`PGRST205 — Could not find the table`), et `anon` n'a **aucun** privilège — ce qui est
le bon défaut. ⚠️ **Point à vérifier après la première connexion réelle** : les
policies RLS ne suffisent pas si le rôle `authenticated` n'a pas reçu les `GRANT`.

Correctif unique, idempotent, à exécuter dans le **même** ordre (GRANT **et**
policies — un `enable row level security` sans policy refuse tout avec le même code
`42501`, donc l'interface ne peut pas distinguer les deux causes) :
**`docs/supabase/002-grants.sql`**. Moindre privilège : `select, insert, update`
sur `profiles` et `progressions`, `select` **seul** sur `licences` (l'écriture
reste côté serveur), rien pour `anon`, et aucun `delete` à personne.

### 12.6 Limites assumées

- ~~La connexion Supabase **n'émet pas** de jeton de contenu~~ — **corrigé le
  2026-10-20 (§13)** : `POST /api/licenses/session` échange une session Supabase
  contre un JWT de contenu, sans qu'aucune clé ne soit saisissable. La clé reste
  acceptée (clients déjà vendus).
- L'essai Premium 7 jours reste un état `localStorage`, non vérifiable côté serveur.
- `startSyncLoop` s'arrête au démontage et à chaque changement de session ; une seule
  minuterie peut vivre à la fois.

## 13. Pont « licence Supabase → session de contenu » (2026-10-20)

### 13.1 Le défaut, tel qu'il a été constaté

Un client dont la licence est créée dans `public.licences` restait bloqué sur
« Activer ma licence » **à vie**. Raison mesurée : le schéma est
`licences(id, user_id, status, plan, created_at, expires_at, activated_at)` —
**aucune colonne de clé**. Or le seul chemin d'obtention du JWT de contenu était
`POST /api/licenses/verify`, qui exige une **clé** (`OPT1.…` ou `OPT-…`).
Le client payait, le compte était `active`, et le contenu restait fermé.

### 13.2 Les deux chemins (ils coexistent volontairement)

| | `/api/licenses/verify` | `/api/licenses/session` (nouveau) |
|---|---|---|
| Preuve présentée | une **clé** de licence | un **jeton d'accès Supabase** |
| Vérification | Ed25519 avec la clé **publique** seule, ou clé d'activation en base | `GET /auth/v1/user` (c'est **Supabase** qui vérifie), puis `licences` lu **avec ce jeton** + filtre `user_id=eq.<id vérifié>` |
| Anti-replay | nonce `X-Nonce` à usage unique | pas de nonce : le porteur est éphémère et personnel |
| Quota | 10 / h / IP | 30 / h / IP (le pont se déclenche au démarrage) |
| Réponses d'erreur | 401 / 429 / 503 | 401 `unauthorized` / 403 `licence_required` / 429 / 503 |
| Secret requis | `LICENSE_PUBLIC_KEY` | `SUPABASE_URL` + `SUPABASE_ANON_KEY` (jamais `service_role`) |

**Pourquoi aucun `service_role`** : la lecture des licences est faite avec le jeton
de l'utilisateur, donc sous RLS, plus un filtre explicite `user_id`. Le filtre n'est
pas redondant avec RLS — si une policy était mal configurée, il empêche de servir la
licence d'un autre compte. Un `service_role` contournerait précisément la barrière
qu'on veut garder dans le chemin qui décide d'ouvrir du contenu payant.

### 13.3 Une seule règle « licence active », partagée

`src/lib/cloud/licence.ts` (module **pur**, aucune I/O) exporte `isActiveLicence`,
utilisée par le **client** et par le **serveur**. Le biais est conservateur : un
statut de révocation ferme toujours, un statut d'activation n'ouvre que si l'échéance
n'est pas dépassée, un statut inconnu n'ouvre que sur preuve (échéance future, ou
`activated_at` sans échéance = licence à vie). Deux règles divergentes donneraient le
pire des états : un client qui se croit licencié et un serveur qui refuse.

### 13.4 Déblocage sans clic ni rechargement

- `ContentSessionBridge` (monté dans `__root.tsx`) tente le pont **au démarrage**, pas
  dans `/pro` : un lien direct vers `/signes` ou `/pathologie/…` doit marcher.
- Il attend la session cloud avec une borne, et **se rejoue à chaque transition** de
  l'état cloud (`loading → authenticated`) : sur un démarrage à froid lent, un pont
  lancé trop tôt aurait conclu « pas de session » et n'aurait jamais réessayé.
- `/signes` s'abonne à la `generation` de la session et redemande son catalogue ;
  `/pathologie/$slug` rejoue son loader (`router.invalidate()`) **seulement** si aucun
  jeton n'existait avant l'appel (sinon un jeton refusé boucle sans fin).
- Mémo négatif `sessionStorage` de 60 s sur « aucune licence » : pas de requête
  Supabase à chaque montage, mais une licence ajoutée par l'administrateur prend effet
  en moins d'une minute.
- `/pro` lit le **même** état partagé : un jeton obtenu en arrière-plan s'y affiche
  comme déverrouillé, sans rien saisir.

### 13.5 Le client n'est jamais le juge

**Bug révélé par la QA navigateur** (et non par les tests unitaires) : si la lecture
**client** de `licences` échouait (RLS/GRANT manquants, réseau), le pont renvoyait
`query-failed` et sortait **avant** l'appel serveur — c'est-à-dire que le seul chemin
capable de débloquer une licence sans clé n'était jamais atteint, et l'utilisateur
restait verrouillé malgré une licence valide. Le client ne sert plus qu'à deux choses :
trouver une clé échangeable (parcours historique) et éviter un aller-retour évident.
**Seul le serveur fait autorité.**

### 13.6 Vérifications

`scripts/content-licence-bridge.test.mjs` — 19 tests : règle « active » (révoquée /
expirée / inconnue), échangeabilité des clés, contrat cookie client ↔
`content-guard.ts`, pont serveur contre un faux Supabase (jeton refusé → `invalid`,
aucune licence → `no-licence`, droits manquants ou panne → 503, filtre `user_id`
présent, `apikey` = clé anonyme **jamais** `service_role`), unicité de la route,
montage dans le shell, rejeu des loaders, et non-régression du `query-failed`.

QA navigateur (`.qa-tmp/licence-bridge-cdp.mjs`, CDP `headless_shell`, 390×844, stub
Supabase local) :

1. anonyme → écran de connexion (gate Phase 1), **0** appel au pont ;
2. session Supabase + licence `active` → `/signes` **110 cas** sans clic, **1 seul**
   appel à `/api/licenses/session`, **1 seul** document chargé ;
3. fiche de nosographie lue dès le rendu serveur (cookie) : 7 sections ;
4. licence retirée → verrou revenu, mémo posé, aucune rafale de requêtes ;
5. 0 erreur console, 0 débordement.

### 13.7 Limites assumées

- L'**essai Premium 7 jours** et les droits `localStorage` n'obtiennent pas de jeton :
  cet état n'est pas vérifiable côté serveur. Il continue d'ouvrir cas/démarches
  (droits locaux), pas les 133 fiches servies par le garde.
- Sans `UPSTASH_REDIS_*`, le quota du pont est **par instance** (voir §6).
- Faire tourner `LICENSE_JWT_SECRET` révoque tous les jetons, pont compris.
