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
| `UPSTASH_REDIS_REST_URL` | recommandé | anti-replay atomique multi-instance |
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
2. **Anti-replay mono-instance** si Upstash n'est pas configuré : le cache
   mémoire ne voit que l'instance courante. Configurer Upstash en multi-région.
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
