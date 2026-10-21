# Paiement international — Lemon Squeezy (merchant of record)

> Offre concernée : **Optimus Premium Trimestre**, 19 € / 3 mois, paiement unique
> (aucun prélèvement récurrent — contrat affiché sur `/tarifs`).
>
> Canal parallèle : le Mobile Money en Ariary reste inchangé (`/pro`). Les deux
> canaux écrivent la **même** licence Supabase, donc le même accès.

---

## 1. Pourquoi un merchant of record

Lemon Squeezy est le vendeur légal sur ce canal : il encaisse, calcule la TVA du
pays de l'acheteur, la collecte et la reverse. Optimus n'a donc aucune obligation
fiscale hors de Madagascar sur ces ventes, et n'a pas à manipuler de données de
carte (aucune donnée bancaire ne touche nos serveurs).

Conséquence pratique : **le montant affiché doit être celui débité** (19,00 €),
jamais une conversion indicative. `/tarifs` affiche `PRICE_EUR`
(`src/content/international.ts`), pas `formatPrice(15_000, "EUR")` qui dirait
« ≈ 3 € ».

---

## 2. Variables d'environnement

| Variable | Où | Rôle | Sans elle |
|---|---|---|---|
| `LEMONSQUEEZY_WEBHOOK_SECRET` | serveur | Vérifie `X-Signature` (HMAC-SHA256 du corps brut) | `/api/webhooks/lemonsqueezy` → **503**, aucun événement accepté |
| `LEMONSQUEEZY_API_KEY` | serveur | API Lemon Squeezy (back-office, hors flux de paiement) | aucun impact sur le webhook |
| `LEMONSQUEEZY_STORE_ID` | serveur | Idem | aucun impact sur le webhook |
| `VITE_LEMONSQUEEZY_STORE_SLUG` | navigateur | Sous-domaine de la boutique (`optimus888`) | repli sur `optimus888` |
| `VITE_LEMONSQUEEZY_VARIANT_ID` | navigateur | Variante du produit (UUID) | bouton affiché mais **`data-tarifs-card-state="unconfigured"`**, message explicite, aucun départ vers un checkout inexistant |
| `SUPABASE_SERVICE_ROLE_KEY` | serveur | Écriture dans `public.licences` | webhook → **503** (la licence EST le produit : on n'accuse pas réception d'un paiement qu'on ne peut pas livrer) |

⚠️ **Aucune clé secrète ne doit être préfixée `VITE_`** : le préfixe est inliné
dans le bundle navigateur (voir l'incident `groq-client.ts`, docs/SECURITY-AUDIT.md).
Seuls `STORE_SLUG` et `VARIANT_ID` sont publics — ils sont visibles dans l'URL
de checkout de toute façon.

`VITE_LEMONSQUEEZY_VARIANT_ID` vit dans `.env.local` (absent de la CI) : le
bouton est donc **désactivé par construction** sur les aperçus de PR, ce qui est
le comportement voulu.

---

## 3. Flux complet

```
/tarifs  ──clic « Payer par Carte (19,00 €) »──►
   POST /api/checkout/lemonsqueezy            (jeton d'accès Supabase requis)
     · GET <supabase>/auth/v1/user  → user_id VÉRIFIÉ (jamais lu dans le corps)
     · INSERT purchase_orders (status=created, payment_provider=lemonsqueezy,
       amount=1900, currency=EUR, référence CMD-SUB-…)
   ◄── { reference }

   redirection → https://optimus888.lemonsqueezy.com/checkout/buy/<variant>
                   ?checkout[custom][user_id]=<uuid>
                   &checkout[custom][order_reference]=<CMD-SUB-…>
                   &checkout[email]=<email>

Lemon Squeezy encaisse
   │
   ├─► POST /api/webhooks/lemonsqueezy    (X-Signature)
   │     1. HMAC du corps BRUT, comparaison à temps constant → 401 si faux
   │     2. idempotence : INSERT webhook_events (provider, event_key)
   │     3. order_created + status=paid → licence Supabase (active, +90 j)
   │     4. purchase_orders : created → … → payment_verified → delivered
   │
   └─► acheteur redirigé vers l'application, licence déjà en place
         /pathologie/* /signes → pont /api/licenses/session → contenu déverrouillé
```

### Pourquoi la commande est créée **avant** le paiement

C'est elle qui porte la référence `CMD-SUB-…` transmise en `custom_data`. Le
webhook retrouve ainsi la commande par **référence ET propriétaire** : un
`custom_data` falsifié ne peut pas livrer la commande d'autrui, et aucun e-mail
ou montant venu du payload n'est jamais cru.

Grâce à `UNIQUE (user_id, client_request_id)`, un double-clic produit **une**
commande, pas deux.

---

## 4. Configuration côté Lemon Squeezy

1. **Produit** : *Optimus Premium Trimestre*, **paiement unique**, 19,00 EUR,
   devise de la boutique EUR.
2. Récupérer l'UUID de la variante dans l'URL de checkout
   (`…/checkout/buy/<UUID>`) → `VITE_LEMONSQUEEZY_VARIANT_ID`.
3. **Settings → Webhooks → +**
   - URL : `https://<domaine>/api/webhooks/lemonsqueezy`
   - Secret de signature → `LEMONSQUEEZY_WEBHOOK_SECRET`
   - Événement coché : **`order_created`** (suffisant pour un paiement unique ;
     `subscription_created` est accepté aussi, au cas où le produit deviendrait
     récurrent — `on_trial` n'ouvre aucun droit).
4. Vérifier que le mode test est bien celui utilisé pendant la recette, puis
   basculer en mode live : **l'URL et le secret changent entre les deux modes**.

---

## 5. Base de données

Migration `migrations/0016_lemon_squeezy.sql` (appliquée par `npm run db:migrate`,
lui-même appelé par `npm run build`) :

- `purchase_orders.currency` — ISO 4217, défaut `'MGA'`. **`amount` est en unité
  mineure** : `1900 + 'EUR'` = 19,00 €, `15000 + 'MGA'` = 15 000 Ar. Sans cette
  colonne, la commande internationale se lisait « 1 900 Ar ».
- `webhook_events` — journal d'idempotence, PK `(provider, event_key)`.
  `INSERT … ON CONFLICT DO NOTHING` **est** le verrou : deux livraisons du même
  événement ne peuvent pas traiter deux fois.

⚠️ **`npm run db:migrate` lit `.env.local`** (INTL-15). Sans cela, le script
d'un côté et l'application de l'autre ne ciblaient pas la même base : le build
était vert et le schéma restait en retard, avec pour seul symptôme un
`relation "webhook_events" does not exist` à l'exécution.

### Schéma réel de `public.licences` (Supabase, mesuré)

| Colonne | Contrainte | Valeur écrite par le webhook |
|---|---|---|
| `id` | uuid, défaut | généré |
| `user_id` | NOT NULL, FK `auth.users` | identité Supabase VÉRIFIÉE |
| `licence_hash` | **NOT NULL** | `lemonsqueezy:<order_id>` (clé d'idempotence) |
| `plan` | — | `premium` (la durée vit dans `expires_at`) |
| `status` | — | `active` |
| `activated_at` | — | date de livraison |
| `expires_at` | — | commande + 90 jours |

`licence_hash` étant NOT NULL, l'omettre fait échouer la livraison en `23502` ;
et `user_id` est soumis à une clé étrangère vers `auth.users` — c'est pourquoi
l'identité est vérifiée auprès de Supabase AVANT de créer la commande.

Statuts d'un événement : `received` → `processed` | `ignored` | `unmatched` |
`failed`. Un rejeu n'est accepté **que** si l'état est `failed` (panne
transitoire). `unmatched` (paiement reçu, `user_id` absent ou commande
introuvable) est conservé pour traitement manuel :

```sql
select event_key, event_name, detail, updated_at
  from webhook_events
 where status = 'unmatched'
 order by updated_at desc;
```

---

## 6. Sémantique des codes HTTP du webhook

| Code | Cas | Lemon Squeezy |
|---|---|---|
| `401` | signature absente / fausse / mal formée | ne rejoue pas (inutile) |
| `400` | corps illisible ou sans `meta.event_name` | ne rejoue pas |
| `413` | corps > 256 Kio | ne rejoue pas |
| `200` | traité, ignoré (non payé), ou rejeu | arrête |
| `503` | panne base, Supabase absent, panne d'écriture | **rejoue** |

Répondre `200` sur une panne perdrait un paiement en silence ; c'est la raison
d'être du `503`.

---

## 7. Recette locale

```bash
# 1. Signature valide, événement NON payé → 200 ignored (aucune écriture)
node -e '
const crypto = require("crypto"), fs = require("fs");
const secret = fs.readFileSync(".env.local","utf8").match(/^LEMONSQUEEZY_WEBHOOK_SECRET="?([^"\n]+)"?$/m)[1];
const body = JSON.stringify({ meta:{ event_name:"order_created", custom_data:{ user_id:"3f6b1c2d-4e5f-4a6b-8c9d-0e1f2a3b4c5d" } }, data:{ type:"orders", id:"1", attributes:{ status:"pending" } } });
const signature = crypto.createHmac("sha256", secret).update(body).digest("hex");
fetch("http://127.0.0.1:8080/api/webhooks/lemonsqueezy", { method:"POST", headers:{ "content-type":"application/json", "x-signature": signature }, body }).then(async r => console.log(r.status, await r.text()));
'

# 2. Sans signature → 401
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:8080/api/webhooks/lemonsqueezy -d '{}'

# 3. Sans session → 401 (checkout)
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:8080/api/checkout/lemonsqueezy -H 'content-type: application/json' -d '{"clientRequestId":"3f6b1c2d-4e5f-4a6b-8c9d-0e1f2a3b4c5d"}'
```

Les tests unitaires couvrent le reste sans réseau :
`src/server/lemonsqueezy/signature.test.ts`, `webhook.test.ts`,
`src/content/international.test.ts` (dans `npm test`).

---

## 8. Ce qui n'est **pas** fait (limites assumées)

- **Aucun remboursement automatique.** `order_refunded` n'ouvre rien ; révoquer
  une licence reste une décision manuelle (`status = 'revoked'`).
- **Test mode** : une licence émise depuis une commande de test n'est pas
  distinguée en base (`webhook_events.detail.testMode` le dit). Vider la table
  avant la mise en production évite de laisser des droits de test.
- **Pas de facture PDF maison** : Lemon Squeezy émet la facture (c'est le
  propre du merchant of record).
- **`purchase_order_events` conserve chaque cran** de la machine à états
  (5 lignes par commande internationale) : c'est voulu, l'audit doit dire la
  vérité sur ce qui s'est réellement passé.

---

## 9. Pannes typiques

| Symptôme | Cause | Correction |
|---|---|---|
| webhook → 401 alors que le payload est bon | signature calculée sur une version re-sérialisée du JSON | signer les octets reçus (déjà le cas ici) ; vérifier le **mode** (test/live) du secret |
| webhook → 503 `webhook_unconfigured` | `LEMONSQUEEZY_WEBHOOK_SECRET` absente | renseigner la variable, redéployer |
| webhook → 200 `unmatched / missing-user` | `checkout[custom][user_id]` absent de l'URL | vérifier que le bouton passe par `/api/checkout/lemonsqueezy` |
| webhook → 200 `unmatched / order-not-found` | commande créée sur un autre environnement | vérifier `DATABASE_URL` (prod vs staging) |
| bouton désactivé malgré la configuration | `VITE_LEMONSQUEEZY_VARIANT_ID` absente/malformée | UUID de variante, puis **rebuild** (variable inlinée) |
| licence absente après un paiement réussi | `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` absentes au runtime | voir la matrice fail-closed, docs/SECURITY-PREMIUM.md |
