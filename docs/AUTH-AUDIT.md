# AUTH-AUDIT — diagnostic des 2 bugs UX bloquants (V1, J-0)

> Mesures du **2026-10-22**, sur l'artefact de production déployé
> (`https://optimusmedical.pages.dev`, commit `4f847fa`) et sur la base de code
> `main` au même commit. Méthode : lecture du code + sondes HTTP + navigateur réel
> (CDP direct sur `headless_shell`, Playwright n'étant pas disponible sous Termux).
>
> Ce document est un **diagnostic**. Aucune ligne de code applicatif n'a été
> modifiée pour le produire.

---

## 0. Résumé exécutif

| # | Symptôme rapporté | Verdict | Cause racine |
|---|---|---|---|
| 1 | « La connexion cloud n'est pas encore configurée sur ce déploiement » | **NON reproduit** sur le build actuel (corrigé par `4f847fa`) | Le build déployé avant `4f847fa` n'avait pas `VITE_SUPABASE_*` → `isSupabaseConfigured === false` → repli Better Auth. Persistance côté client = HTML/bundles du **service worker** + absence de garde-fou de build. |
| 2 | Double authentification pour atteindre `/pro` | **REPRODUIT et mesuré** | Il y a **deux fournisseurs d'identité** : Supabase (porte d'entrée, session, contenu) et **Better Auth** (`useCurrentUserState`). `/pro` exige la session **Better Auth**, dont l'endpoint `POST/GET /api/auth/get-session` renvoie **HTTP 500** en production. L'utilisateur se reconnecte donc dans le vide. |

Le point important : **le stockage de session n'est pas en cause**. Le symptôme 2
n'est pas « la session se perd entre deux pages », c'est « la page suivante
interroge un autre système d'authentification ».

---

## 1. Ce qui n'est PAS la cause (vérifié, pas supposé)

| Hypothèse courante | Vérification | Verdict |
|---|---|---|
| Plusieurs instances du client Supabase | `grep -rn "createClient(" src/` → **1 seul site d'appel**, `src/lib/supabase.ts:51`, derrière un singleton (`client`/`pending`, lignes 45-46, 56-70) | ✅ un seul client |
| Session en `sessionStorage` (perdue entre onglets) | Le SDK écrit `sb-uznagojvhheqstudhypm-auth-token` dans **localStorage** (`persistSession: isBrowser`, `src/lib/supabase.ts:55`). Mesuré après connexion : clé présente dans `localStorage` | ✅ localStorage |
| Session perdue au rechargement | Mesure navigateur : après **connexion puis rechargement complet** de `/`, `[data-cloud-auth="screen"]` absent et `main` présent → **la session survit** | ✅ persistance OK |
| `/pro` fait sa propre vérification indépendante ? | Oui — mais pas de Supabase : `src/routes/pro.tsx:71` appelle `useCurrentUserState()` (Better Auth) | ❌ c'est **la** cause |
| `sync-engine` entre en conflit au montage | `src/components/cloud-sync-bridge.tsx` ne fait que démarrer la boucle d'envoi ; il ne révoque jamais l'état de session (`settleFromProbe` ne peut pas dé-authentifier, `src/lib/cloud/session.ts:66-69`) | ✅ pas de conflit |
| `AuthProvider` qui perd la session entre 2 routes | `src/lib/auth/provider.tsx` est un **passthrough** (aucun état) ; l'état réel vit hors React dans `src/lib/cloud/session.ts` (store externe, `useSyncExternalStore`) | ✅ pas de perte entre routes |

**Conclusion :** la plomberie Supabase (client unique → store externe → gate) est
saine et a été mesurée fonctionnelle de bout en bout. Le défaut est **en aval**,
dans les écrans qui n'utilisent pas cette plomberie.

---

## 2. Symptôme 1 — « Connexion cloud indisponible ici » / « pas encore configurée »

### 2.1 Mesure du build actuellement déployé

```
GET /                      → formulaire Supabase (email + mot de passe), aucun repli
GET /login                 → data-cloud-auth="screen", #cloud-email + #cloud-password présents
GET /assets/supabase-*.js  → contient VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY
                             → `o=!!(i&&a)` = isSupabaseConfigured **true**
```

Sonde de navigateur (profil neuf, sans cache) :

```
OK   / : écran de connexion Supabase rendu
OK   / : champs email + mot de passe présents (pas le repli)
OK   / : aucun texte « Connexion cloud pas configurée »
OK   /login : formulaire Supabase (pas de repli runtime-status)
```

→ **Le symptôme 1 n'est plus reproductible sur l'artefact courant.** Le correctif
`4f847fa` (`.env.production`) a bien fait son effet.

### 2.2 Pourquoi il a existé (chaîne exacte)

1. `src/components/AuthScreen.tsx:48` lit la constante `isSupabaseConfigured`
   (`src/lib/supabase.ts:38-40`), calculée **au build** à partir de
   `import.meta.env.VITE_SUPABASE_URL/ANON_KEY`.
2. `src/routes/login.tsx:47` : `if (isSupabaseConfigured) return <AuthScreen />;`
   → si les variables manquent, on **n'entre jamais** dans l'écran Supabase.
3. On tombe alors sur le chemin historique Better Auth, qui interroge
   `getAuthRuntimeStatus()` (`src/lib/auth/runtime-status.ts`) — une sonde qui
   teste `GROK_AUTH_CLIENT_ID` / `BETTER_AUTH_URL`, **pas Supabase**.
4. Sur Cloudflare Pages ces variables n'existent pas → `mode:
   "missing-deployment-config"` → message littéral de
   `src/lib/auth/runtime-status.ts:99` :

   > « La connexion cloud n'est pas encore configurée sur ce déploiement. Vous
   > pouvez continuer à utiliser Optimus localement. »

   C'est **mot pour mot** la phrase observée. Elle ne parle donc pas de Supabase :
   elle décrit l'ancien système. C'est un message trompeur (il envoie chercher une
   configuration OAuth qui n'a plus de rôle).

### 2.3 Pourquoi l'utilisateur peut encore la voir

Le build n'est pas seul en cause ; deux mécanismes côté client épinglent un
ancien build :

- **Service worker.** `public/sw.js` ne met plus les documents HTML en cache
  (`request.mode === "navigate"` → réseau, correctif du 2026-10-18), mais les
  clients porteurs de l'**ancien** worker (`CACHE = "optimus-v1"`, qui cachait
  *toutes* les réponses GET y compris le HTML) resservent le document de leur
  époque jusqu'à la 2ᵉ visite. Le worker v2 est bien déployé (mesuré :
  `const CACHE = "optimus-v2"` sur `/sw.js`), donc la purge se fait — mais une
  seule visite ne suffit pas.
- **Absence de garde-fou de build.** Un build sans `VITE_SUPABASE_*` passe tous
  les gates (tsc, tests, budget, smoke) et produit une application **fonctionnelle
  localement mais sans connexion**. C'est exactement la régression qui s'est
  produite (deux commits `chore: rebuild …` #105/#107 avant le correctif #110).

### 2.4 Le message subsiste ailleurs dans le code

| Emplacement | Atteignable ? |
|---|---|
| `src/routes/login.tsx:99-118` (bloc « Connexion cloud indisponible ici ») | Oui, **si** `isSupabaseConfigured` est faux |
| `src/lib/auth/runtime-status.ts:99` (la phrase exacte) | Via le bloc ci-dessus |
| `src/routes/profil.tsx:884-896` | En pratique non : la branche n'existe que si `!connectedAccount`, or `connectedAccount` inclut `cloudAuth.status === "authenticated"` (`profil.tsx:216-217`). Reste à nettoyer. |

---

## 3. Symptôme 2 — Double authentification (le vrai blocage)

### 3.1 Mesure

Séquence rejouée dans un navigateur réel, compte de test créé pour l'occasion
(`auth-audit-qa@optimus-qa.invalid`), sur `https://optimusmedical.pages.dev` :

```
OK   1re connexion : le gate s'ouvre                      main=true  auth=false
OK   session Supabase écrite en localStorage              sb-uznagojvhheqstudhypm-auth-token
OK   session partagée entre les chargements              auth=false main=true   (après RELOAD)
OK   /pro ne redemande PAS une connexion au gate          authScreen=false
FAIL /pro n'affiche pas « Connexion requise pour un achat Premium »
                                                          secondLoginCard=true
FAIL /api/auth/get-session répond 200                     500 {"error":true,"unhandled":true}
```

Traduction : la porte Supabase s'ouvre, la session tient au rechargement, `/pro`
s'affiche… et **la carte d'achat demande une deuxième connexion**. Le clic mène à
`/login`, qui **réaffiche le formulaire Supabase** (`login.tsx:47` ne teste pas
« déjà connecté »), l'utilisateur resaisit ses identifiants, revient sur `/pro`…
et retombe sur la même carte. D'où l'impression de « se reconnecter deux fois
pour accéder à /pro ».

### 3.2 Cause racine : deux fournisseurs d'identité dans la même application

| Domaine | Fournisseur utilisé | Preuve |
|---|---|---|
| Porte d'entrée (`__root`) | **Supabase** | `src/routes/__root.tsx:140` → `useAuth()` ; décision `src/lib/cloud/gate.ts:72-78` |
| Écran de connexion | **Supabase** | `src/components/AuthScreen.tsx:61-72` (`client.auth.signInWithPassword`) |
| Session de contenu Premium | **Supabase** | `src/lib/cloud/content-session.ts:302` (`loadSupabase()`) |
| Synchronisation de progression | **Supabase** | `src/components/cloud-sync-bridge.tsx:13` |
| **Achat Mobile Money** | **Better Auth** | `src/components/premium-purchase-flow.tsx:116` + `:324` ; `src/routes/pro.tsx:71,239` |
| **Mes achats** | **Better Auth** | `src/routes/achats.tsx:62` |
| **Gestion des données / suppression de compte** | **Better Auth** | `src/routes/donnees.tsx:21` |
| **Bandeau compte du profil** | Better Auth **et** Supabase | `src/routes/profil.tsx:142` + `:143` |
| **Tunnel Mobile Money (serveur)** | **Better Auth** | `src/lib/purchase-orders.ts` — 8 `createServerFn` dont 5 avec `.middleware([authMiddleware])` (l. 248, 346, 361, 406, 521) |
| **Export / suppression de compte (serveur)** | **Better Auth** | `src/lib/optimus-sync.ts` — 6 `.middleware([authMiddleware])` (l. 115, 155, 248, 387, 412, 444) |
| Paiement international Lemon Squeezy | **Supabase** | `src/server/lemonsqueezy/checkout.server.ts:62-94` (vérifie le jeton d'accès via `/auth/v1/user`) |

**Le tunnel Mobile Money et le tunnel international n'authentifient donc pas
l'acheteur de la même façon.** C'est l'incohérence de fond.

### 3.3 Pourquoi la porte Better Auth ne peut *jamais* s'ouvrir en production

1. Le client Better Auth (`src/lib/auth/client.ts:19-28`) appelle `GET
   /api/auth/get-session`.
2. Cette route (`server/api/auth/[...all].ts:10`) importe
   `@/lib/auth/server`, qui **initialise au chargement** `pg` (`Pool`), PGlite
   (`ensureDbReady()`, `server.ts:42`) et `better-auth`. En production
   l'endpoint répond **500 `unhandled`** (mesuré ci-dessus, et déjà constaté le
   2026-10-18). Le corps de réponse ne porte aucun détail ; deux causes
   plausibles, cumulables, et dans les deux cas **le résultat est le même** :
   - l'origine `optimusmedical.pages.dev` n'est pas dans les `allowedHosts`
     dynamiques de Better Auth — `preview.ts:32` ne liste que
     `*.grok-sandbox.com` + loopback, et l'URL d'origine Cloudflare n'est
     dérivée que si un client broker est injecté (`server.ts:110-122`,
     `deployedBrokerClientConfigured`) → « Invalid origin » ;
   - le runtime Workers de ce déploiement n'initialise ni PGlite ni `pg`.
3. `useCurrentUserState()` (`src/lib/auth/use-current-user.ts:57-73`) reçoit donc
   `data === null` avec `isPending === false` → `user === null`.
4. Conséquences en cascade dans `premium-purchase-flow.tsx:324`
   (`if (!authEnabled || !user || user.isDevFallback)`) → carte « Connexion
   requise pour un achat Premium », **quelle que soit** la session Supabase.

Et même si l'endpoint fonctionnait : il n'existe **aucun moyen d'obtenir une
session Better Auth sur ce déploiement**.
- `emailAndPasswordEnabled = false` (`src/lib/auth/email-password.ts`) : pas
  d'inscription email/mot de passe.
- Les seuls fournisseurs sont fédérés vers le broker Grok, or
  `runtime-status.ts:93-100` renvoie `ready: false` / `missing-deployment-config`
  (aucun `GROK_AUTH_CLIENT_ID` injecté) : la sonde elle-même déclare le service
  inutilisable.
- `authConfigured` vaut pourtant **`true`** car le code retombe sur le client
  **de prévisualisation** partagé (`server.ts:99-103` : `grokClientId =
  injectedGrokClientId ?? PREVIEW_CLIENT_ID`), que le broker n'accepte que pour
  des retours `*.grok-sandbox.com`. Conséquence secondaire importante :
  `requireUserId` ne rend donc **jamais** l'utilisateur de secours ; il lève
  `UnauthorizedError` (401) sur les server functions.
- Enfin, `/login` n'affiche plus les boutons OAuth : il rend `AuthScreen`
  (Supabase) dès que Supabase est configuré (`login.tsx:47`).

Autrement dit : la porte Better Auth de `/pro` est **une porte sans serrure**, et
rien dans l'interface ne permet de la déverrouiller.

### 3.4 Effets secondaires mesurés (même cause)

- `/pro` vend un abonnement **qui ne peut pas être commandé** : la surface
  `data-pro-subscription-order` est rendue (`authEnabled === true` en prod, cf.
  §4) mais son contenu est la carte « Connexion requise ».
- `/donnees` — **obligation légale** (export et suppression totale du compte,
  CMIL art. 22/25) — passe par `optimus-sync.ts` (`authMiddleware`) : inopérant
  en prod pour un utilisateur Supabase.
- `/achats` n'affiche jamais l'historique serveur (`listPremiumPurchaseOrders`
  lèverait 401).
- `profil.tsx:142` + `:216` affichent « Compte Optimus connecté » (grâce à
  Supabase) alors que le reste de la page parle d'un compte Better Auth : deux
  vérités dans un même écran.

### 3.5 Blocage secondaire sur `/pro` (à ne pas confondre)

Même avec l'identité réparée, `premium-purchase-flow.tsx` s'arrête ensuite sur
`profile.optimusId === "OM-GUEST"` (`premium-purchase-flow.tsx:343`, « Finalisation du compte Optimus »). Un
appareil neuf n'a pas encore d'identifiant natif synchronisé : l'achat reste donc
bloqué un cran plus loin. Mesuré sur `/profil` du compte de test : `OM-GUEST`.
C'est un point distinct, traité en phase D du plan.

---

## 4. `VITE_AUTH_ENABLED` — analyse demandée

| Question | Réponse mesurée |
|---|---|
| Requise par le code ? | Oui, lue à **4 endroits** : `src/lib/auth/client.ts:37` (client), `src/lib/db.ts:157` (serveur, migrations), `src/lib/auth/server.ts:87` et `runtime-status.ts:39` |
| Présente en production ? | **Non** — et c'est *différent* de « absente donc désactivée ». Le bundle déployé contient `VITE_AUTH_ENABLED` **absent** de l'objet `import.meta.env`, donc `undefined !== "false"` → **`authEnabled === true`** en production. |
| Présente en local ? | **Oui, `false`** (`.env.local`, non versionné) → `authEnabled === false` en dev |
| Est-ce la cause du symptôme 1 ? | **Non.** Le symptôme 1 vient de `isSupabaseConfigured`, pas de `authEnabled`. |
| Est-ce que ça aggrave le symptôme 2 ? | **Oui, indirectement.** En prod `authEnabled === true` → `/pro` rend le tunnel Mobile Money (donc la porte Better Auth). En dev `authEnabled === false` → `/pro` rend un simple lien `/tarifs`, et `useCurrentUserState()` renvoie `DEV_USER`. **Le bug est donc invisible en développement** : c'est la divergence d'environnement qui l'a laissé passer. |
| Faut-il l'ajouter à `.env.production` ? | **Pas maintenant, et pas comme correctif.** La valeur `false` en production est *dangereuse* : `requireUserId` lèverait `fail closed` (`verify.server.ts:84-96`) et casserait les server functions. Le bon correctif est la phase B (identité serveur dérivée de Supabase), après quoi ce drapeau ne doit plus gouverner l'identité produit. |

> ⚠️ Règle de mesure à retenir : les gates locaux tournent avec un
> environnement **différent** de la production (`VITE_AUTH_ENABLED=false` +
> `DATABASE_URL`). Un test « vert » en local ne prouve rien sur ce chemin.

---

## 5. Plan de correction proposé

Objectif : **une seule identité** (Supabase) de l'écran de connexion jusqu'aux
server functions. Better Auth reste en place pour le bac à sable de prévisualisation,
mais n'est **plus jamais** consulté quand Supabase est configuré.

### Phase A — Une seule identité côté interface (P0, faible risque)

| # | Action | Fichier |
|---|---|---|
| A1 | Nouveau hook `useAppUser()` : dérive `{ id, email, displayName, isDevFallback }` du **snapshot Supabase** (même store externe que `useAuth`), avec `isPending = status === "loading"` | `src/hooks/useAppUser.ts` (nouveau) |
| A2 | `premium-purchase-flow` : remplacer `useCurrentUserState()` par `useAppUser()` | `src/components/premium-purchase-flow.tsx:116,324` |
| A3 | `/pro` : `user` via `useAppUser()`, `authEnabled` → `configured` (Supabase) | `src/routes/pro.tsx:71,239,272` |
| A4 | `/achats`, `/donnees` : même substitution | `src/routes/achats.tsx:62`, `src/routes/donnees.tsx:21` |
| A5 | `/profil` : une seule source (`useAppUser`) pour `connectedAccount` et `accountEmail` ; suppression du message de repli Better Auth | `src/routes/profil.tsx:142,143,216,884-896` |
| A6 | `/login` : **si déjà authentifié → `<Navigate to="/pro">`** (fin de la boucle « reconnecte-toi ») ; entrée `?redirect=` | `src/routes/login.tsx:44-49` |
| A7 | `optimus-sync-bridge` : ne se monte que si Supabase n'est pas configuré (sinon `cloud-sync-bridge` fait foi) | `src/components/optimus-sync-bridge.tsx:96,103` |

Risque : faible — aucune surface serveur touchée, réversible fichier par fichier.

### Phase B — Une seule identité côté serveur (P0, cœur du correctif)

Le pattern existe déjà et il est éprouvé : `checkout.server.ts:62-94` vérifie un
jeton d'accès Supabase en appelant `<SUPABASE_URL>/auth/v1/user` (clé anonyme,
jamais de `service_role`).

| # | Action | Fichier |
|---|---|---|
| B1 | `authMiddleware` : le client attache le **jeton d'accès Supabase** (via `loadSupabase().auth.getSession()`) dans le même `bearerToken` qu'aujourd'hui | `src/lib/auth/middleware.ts:28-47` |
| B2 | `requireUserId` : si le jeton est un JWT Supabase (`iss`/`aud`), le vérifier auprès de Supabase et renvoyer son `sub` ; **sinon** retomber sur Better Auth (bac à sable uniquement) | `src/lib/auth/verify.server.ts:84-96` + nouveau `src/lib/auth/supabase-identity.server.ts` |
| B3 | Mise en cache courte (60 s) des résolutions de jeton, et refus `401` inchangé | `src/lib/auth/supabase-identity.server.ts` |
| B4 | Même identité que le tunnel Lemon Squeezy (`identity.userId`), donc `purchase_orders.user_id` devient **cohérent** entre les deux tunnels | — |

Conséquence : les 11 server functions de `purchase-orders.ts` et
`optimus-sync.ts` fonctionnent sans modification de leur code.

Risque : moyen — à couvrir par un test de non-régression (jeton valide, jeton
expiré, absence de jeton, repli Better Auth) et par une QA bout-en-bout.

### Phase C — Empêcher le retour du symptôme 1 (P1, garde-fous)

| # | Action | Fichier |
|---|---|---|
| C1 | **Assertion de build** : après `vite build`, échouer si le bundle client ne contient pas `VITE_SUPABASE_URL` (comme `performance-budget.mjs` échoue sur le budget). Le build « sans variables » ne pourrait plus être publié. | `scripts/assert-supabase-build.mjs` + `package.json` (`postbuild`) |
| C2 | Test de garde-fou unitaire sur le script (présence, absence, faux positif) | `scripts/assert-supabase-build.test.mjs` |
| C3 | Remplacer le message trompeur : si Supabase n'est pas configuré, dire **« Cette version a été compilée sans configuration cloud »**, sans invoquer Better Auth | `src/lib/auth/runtime-status.ts:99`, `src/routes/login.tsx:99-118` |
| C4 | Supprimer `src/lib/auth/gates.tsx` (code mort : jamais importé, seul un commentaire le cite) | — |

### Phase D — Débloquer réellement l'achat (P1/P2, à décider)

| # | Action | Fichier |
|---|---|---|
| D1 | Provisionner l'Optimus ID natif à la première session cloud (sinon « Finalisation du compte Optimus » bloque l'achat, §3.5) | `src/state/store.ts`, `src/components/cloud-sync-bridge.tsx` |
| D2 | Retirer l'UI Better Auth résiduelle (`/login` legacy, `runtime-status`, `optimus-sync-bridge`) une fois A+B en production | 3-4 fichiers |

---

## 6. Impact estimé

| Phase | Fichiers modifiés | Fichiers créés | Lignes (ordre de grandeur) | Risque |
|---|---|---|---|---|
| A | 6 | 1 | ~180 | faible |
| B | 2 | 1 (+1 test) | ~220 | moyen |
| C | 3 | 2 | ~140 | très faible |
| D | 2-4 | 0 | ~120 | moyen (produit) |
| **Total** | **13-15** | **4-5** | **~650** | — |

Aucun contenu médical touché. Aucune migration de base nécessaire : `purchase_orders.user_id`
est déjà un `text` accueillant l'UUID Supabase (le tunnel Lemon Squeezy y écrit
déjà `identity.userId`).

## 7. Protocole de validation (avant PR)

1. **Reproduire d'abord** le bug en local : `VITE_AUTH_ENABLED` **absent** de
   l'environnement (et non `false`), sinon `/pro` emprunte la branche morte et le
   test ne prouve rien (§4).
2. QA CDP `headless_shell` (Playwright indisponible sous Termux) sur **artefact de
   build** (port 8081) et non seulement en dev : connexion → `/pro` sans seconde
   demande → commande Mobile Money créée (référence `CMD-…`) avec un `user_id`
   égal au `sub` Supabase → `/donnees` export fonctionnel.
3. Gates : `npm run typecheck`, `npm test`, `npm run build` (+ nouvelle assertion).
4. Vérifier la non-régression du tunnel Lemon Squeezy (identité déjà Supabase).
5. PR séparée pour le diagnostic (ce fichier) et pour le code, jamais de push sur
   `main`.

## 8. Artefacts de mesure

| Fichier | Contenu |
|---|---|
| `.qa-tmp/auth-audit-cdp.mjs` | 1ʳᵉ sonde : état de `/` et `/login`, statut de `/api/auth/get-session`, connexion, rechargement |
| `.qa-tmp/auth-audit-cdp2.mjs` | Sonde définitive (marqueurs robustes) : accueil anonyme → connexion → rechargement → `/pro` → `/profil` |
| `screenshots/auth-audit-diag.json`, `auth-audit-diag2.json` | Verdicts complets (gitignorés) |
| `screenshots/auth-audit2-02-pro.png` | Capture de `/pro` **connecté** montrant la carte « Connexion requise » |

Compte de test créé pour la mesure (à supprimer) :
`auth-audit-qa@optimus-qa.invalid` — voir `docs/supabase/002-grants.sql:149-155`
pour la requête de nettoyage des comptes `@optimus-qa.invalid`.
