import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

/* ============================================================================
   ABONNEMENT TRIMESTRIEL PAYABLE (ABO-11).

   L'offre `subscription` est vendue 15 000 Ar pour 3 mois. Trois choses peuvent
   casser silencieusement, et ce fichier les verrouille :

   1. LA BASE refuse la commande (CHECK `offer` créé en 0009 n'autorisait que
      `deck` / `specialty`) → le client paie et aucune commande n'existe.
   2. LA LIVRAISON ne crée aucune licence → commande « livrée », contenu fermé.
   3. LA LICENCE n'expire jamais (ou expire tout de suite) → abonnement à vie
      pour 15 000 Ar, ou accès coupé le jour même.

   Le point 1 est joué sur un VRAI Postgres embarqué (PGlite) ; les points 2 et 3
   portent sur la source serveur, faute de pouvoir exécuter une server-fn ici —
   la règle d'échéance, elle, est testée en pur dans
   `src/content/purchase-order.test.ts`.
   ============================================================================ */

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

const [
  serverOrders,
  domain,
  purchaseFlow,
  migration0015,
  migration0004,
  migration0009,
  migration0010,
  migration0011,
] = await Promise.all([
  read("../src/lib/purchase-orders.ts"),
  read("../src/content/purchase-order.ts"),
  read("../src/components/premium-purchase-flow.tsx"),
  read("../migrations/0015_subscription_offer.sql"),
  read("../migrations/0004_activation_keys.sql"),
  read("../migrations/0009_purchase_orders.sql"),
  read("../migrations/0010_purchase_verification.sql"),
  read("../migrations/0011_purchase_state_machine.sql"),
]);

/** Source sans commentaires : un test ne doit pas échouer sur sa documentation. */
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n")
    .map((line) => (line.trimStart().startsWith("//") ? "" : line))
    .join("\n");
}

const ORDER_COLUMNS =
  "reference, user_id, client_request_id, optimus_id, offer, specialty, deck_number, product, label, amount";

async function freshDatabase() {
  const db = new PGlite();
  await db.waitReady;
  for (const migration of [migration0004, migration0009, migration0010, migration0011, migration0015]) {
    await db.exec(migration);
  }
  return db;
}

test("0015 : la base accepte une commande d'abonnement, et rien d'autre", async () => {
  const db = await freshDatabase();
  try {
    const constraint = await db.query(
      `select pg_get_constraintdef(oid) as definition
         from pg_constraint
        where conrelid = 'purchase_orders'::regclass
          and conname = 'purchase_orders_offer_check'`,
    );
    assert.equal(constraint.rows.length, 1, "le CHECK des offres doit exister");
    assert.match(constraint.rows[0].definition, /subscription/);

    // Un abonnement : spécialité `all` (aucune) et module 1, normalisés serveur.
    await db.query(
      `insert into purchase_orders (${ORDER_COLUMNS})
       values ($1,$2,$3,$4,'subscription','all',1,'OPTIMUS_PRO',$5,15000)`,
      [
        "CMD-SUB-M1B2C3D4-ABCDEF01",
        "11111111-1111-4111-8111-111111111111",
        "aaaaaaaa-1111-4111-8111-111111111111",
        "OM-A1B2C3D4",
        "Abonnement Trimestriel · Accès illimité 3 mois",
      ],
    );

    // Les achats à l'unité restent acceptés à l'identique.
    await db.query(
      `insert into purchase_orders (${ORDER_COLUMNS})
       values ($1,$2,$3,$4,'deck','cardiologie',4,'CARDIO_DECK_04','Cardiologie · Deck 4/10',3000)`,
      [
        "CMD-M1B2C3D4-ABCDEF02",
        "11111111-1111-4111-8111-111111111111",
        "bbbbbbbb-1111-4111-8111-111111111111",
        "OM-A1B2C3D4",
      ],
    );

    // Une offre inconnue reste refusée : l'assouplissement est CIBLÉ.
    await assert.rejects(
      db.query(
        `insert into purchase_orders (${ORDER_COLUMNS})
         values ($1,$2,$3,$4,'lifetime','all',1,'OPTIMUS_PRO','x',1)`,
        [
          "CMD-M1B2C3D4-ABCDEF03",
          "11111111-1111-4111-8111-111111111111",
          "cccccccc-1111-4111-8111-111111111111",
          "OM-A1B2C3D4",
        ],
      ),
      /check constraint/i,
    );

    const index = await db.query(
      `select indexname from pg_indexes
        where tablename = 'purchase_orders' and indexname = 'purchase_orders_subscription_idx'`,
    );
    assert.equal(index.rows.length, 1, "l'index des abonnements doit exister");
  } finally {
    await db.close();
  }
});

test("0015 : la licence d'abonnement sait porter une échéance, et reste révocable", async () => {
  const db = await freshDatabase();
  try {
    const columns = await db.query(
      `select column_name from information_schema.columns
        where table_name = 'activation_keys' and column_name in ('expires_at','purchase_reference','device_id','activated_at','revoked_at')`,
    );
    assert.equal(columns.rows.length, 5);

    // `activation_keys.purchase_reference` est une CLÉ ÉTRANGÈRE : la licence ne
    // peut exister que pour une commande réelle (garde-fou anti-licence fantôme).
    await db.query(
      `insert into purchase_orders (${ORDER_COLUMNS})
       values ($1,$2,$3,$4,'subscription','all',1,'OPTIMUS_PRO',$5,15000),
              ($6,$2,$7,$4,'deck','cardiologie',4,'CARDIO_DECK_04','Cardiologie · Deck 4/10',3000)`,
      [
        "CMD-SUB-M1B2C3D4-ABCDEF01",
        "11111111-1111-4111-8111-111111111111",
        "aaaaaaaa-1111-4111-8111-111111111111",
        "OM-A1B2C3D4",
        "Abonnement Trimestriel · Accès illimité 3 mois",
        "CMD-M1B2C3D4-ABCDEF02",
        "bbbbbbbb-1111-4111-8111-111111111111",
      ],
    );

    // Échéance à 90 jours pour un abonnement…
    await db.query(
      `insert into activation_keys (key_hash, optimus_id, product, expires_at, purchase_reference, device_id, activated_at)
       values ($1,'OM-A1B2C3D4','OPTIMUS_PRO', now() + interval '90 days', $2, $3, now())`,
      ["hash-sub", "CMD-SUB-M1B2C3D4-ABCDEF01", "device-12345678"],
    );
    // …et aucune pour un achat à l'unité (accès perpétuel).
    await db.query(
      `insert into activation_keys (key_hash, optimus_id, product, expires_at, purchase_reference, device_id, activated_at)
       values ($1,'OM-A1B2C3D4','CARDIO_DECK_04', null, $2, $3, now())`,
      ["hash-deck", "CMD-M1B2C3D4-ABCDEF02", "device-12345678"],
    );

    const rows = await db.query(
      `select purchase_reference, expires_at is null as perpetual
         from activation_keys order by purchase_reference`,
    );
    assert.equal(rows.rows.length, 2);
    assert.equal(rows.rows.find((row) => row.purchase_reference === "CMD-M1B2C3D4-ABCDEF02").perpetual, true);
    assert.equal(rows.rows.find((row) => row.purchase_reference === "CMD-SUB-M1B2C3D4-ABCDEF01").perpetual, false);
  } finally {
    await db.close();
  }
});

test("la livraison crée la licence DANS LA MÊME instruction que le statut", () => {
  const code = stripComments(serverOrders);
  // Le passage en `delivered` ne peut pas réussir sans licence…
  assert.match(code, /with updated as \(\s*update purchase_orders[\s\S]*?insert into activation_keys/);
  assert.match(code, /where reference = \$1 and status = \$2/);
  assert.match(code, /set status = 'delivered'/);
  // …et l'insertion est idempotente (re-livrer ne fabrique pas une 2e licence).
  assert.match(code, /not exists \(\s*select 1 from activation_keys existing/);
  // L'échéance vient de la règle du domaine, pas d'un `interval '90 days'` écrit
  // ici : une seule source de vérité entre la base, le reçu et l'affichage.
  assert.match(code, /licenseExpiryFor\(current\.offer\)/);
  assert.doesNotMatch(code, /interval '90 days'/);
  // La licence est journalisée dans l'évènement de commande.
  assert.match(code, /'licenceExpiresAt', \(select expires_at from licence\)/);
});

test("un remboursement révoque la licence d'abonnement (elle porte la référence)", () => {
  const code = stripComments(serverOrders);
  // La révocation cible `purchase_reference` : elle attrape donc la licence
  // créée automatiquement à la livraison, sans code spécifique à l'abonnement.
  assert.match(
    code,
    /update activation_keys\s+set revoked_at = coalesce\(revoked_at, now\(\)\)\s+where purchase_reference in \(select reference from updated\)/,
  );
});

test("l'acheteur récupère SA licence, et seulement la sienne", () => {
  const code = stripComments(serverOrders);
  const start = code.indexOf("export const getPurchaseLicense");
  assert.ok(start > 0, "getPurchaseLicense doit exister");
  const handler = code.slice(start, start + 2600);

  assert.match(handler, /middleware\(\[authMiddleware\]\)/);
  assert.match(handler, /ownedPurchase\(sql, data\.reference, context\.userId\)/);
  assert.doesNotMatch(handler, /data\.userId|data\.user_id/);
  // Rien à activer tant que la commande n'est pas livrée.
  assert.match(handler, /current\.status !== "delivered"/);
  // Le reçu est signé côté serveur, avec la clé privée — jamais renvoyée.
  // Depuis INTL-14 la clé est lue dans un module *.server.ts : la référencer ici
  // laissait le motif dans un module isomorphe (importé par des composants
  // clients), ce que scripts/security-license.test.mjs interdit.
  assert.match(handler, /signLicenseReceipt\(/);
  assert.match(handler, /readLicenseSigningKey\(\)/);
  assert.doesNotMatch(handler, /process\.env\.LICENSE_SIGNING_PRIVATE_KEY/);
  assert.doesNotMatch(handler, /privateKey/);
  // Dégrader sans clé plutôt qu'échouer : la commande reste livrée.
  assert.match(handler, /status: "signing-unavailable" as const/);
  // Le reçu est lié à l'appareil de la commande : inutilisable ailleurs.
  assert.match(handler, /deviceId: current\.device_id\.toLowerCase\(\)/);
  // Aucun secret dans la réponse.
  assert.doesNotMatch(handler, /return \{[^}]*privateKey/);
});

test("la commande d'abonnement est normalisée côté serveur, pas par le client", () => {
  const server = stripComments(serverOrders);
  const flow = stripComments(purchaseFlow);

  assert.match(server, /normalizePremiumOrderInput\(/);
  // Le client n'envoie ni spécialité ni module pour un abonnement…
  assert.match(flow, /offer === "subscription"\s*\?\s*\{ clientRequestId, offer \}/);
  // …et le tunnel pré-sélectionne l'offre demandée par la carte.
  assert.match(flow, /initialPurchase\?\.offer \?\? initialOffer \?\? "specialty"/);
  // Le produit de licence de l'abonnement est `OPTIMUS_PRO` (droit global).
  assert.match(stripComments(domain), /export const SUBSCRIPTION_PRODUCT = "OPTIMUS_PRO"/);
});

test("la référence d'abonnement est distincte et validée partout", () => {
  const server = stripComments(serverOrders);
  const domainCode = stripComments(domain);

  // Le serveur n'écrit plus « CMD- » en dur : il prend le préfixe du domaine.
  assert.match(server, /purchaseReferencePrefix\(/);
  assert.doesNotMatch(server, /\/\^CMD-\[A-Z0-9\]\+-/);
  // Le format accepté couvre les deux familles, et seulement elles.
  assert.match(domainCode, /PURCHASE_REFERENCE_PATTERN = \/\^CMD-\(\?:SUB-\)\?\[A-Z0-9\]\+-\[A-F0-9\]\{8\}\$\//);
  // Le serveur importe ce motif au lieu de le réécrire.
  assert.match(server, /PURCHASE_REFERENCE_PATTERN/);
});

/* ----------------------------------------------------------------------------
   Exécution du VRAI SQL de livraison sur un vrai Postgres embarqué.

   Les tests précédents vérifient la FORME de la requête. Celui-ci l'EXÉCUTE :
   il extrait le CTE de `reviewPremiumPurchaseOrder` (branche `delivered`) et le
   joue sur PGlite avec les mêmes paramètres. C'est la seule façon de prouver
   hors production que « valider le paiement » produit une licence datée de
   3 mois — un test de forme passerait même sur une requête cassée.
   ---------------------------------------------------------------------------- */

const deliveredSql = (() => {
  const code = stripComments(serverOrders);
  // Repère la REQUÊTE, pas la garde : `const delivered = await sql.query<…>(` est
  // unique, alors que « if (data.decision === "delivered") » apparaît deux fois
  // (une garde, puis la branche d'écriture).
  const start = code.indexOf("const delivered = await sql.query");
  assert.ok(start > 0, "branche delivered introuvable");
  const end = code.indexOf("const next = delivered[0]", start);
  assert.ok(end > start, "fin de la branche delivered introuvable");
  const match = code.slice(start, end).match(/`([\s\S]*?)`/);
  assert.ok(match, "requête de livraison introuvable");
  return match[1];
})();

const ADMIN = "99999999-1111-4111-8111-111111111111";
const BUYER = "11111111-1111-4111-8111-111111111111";
const DEVICE = "device-12345678";

async function seedVerifiedOrder(db, { reference, offer, product, specialty = "all", deckNumber = 1 }) {
  await db.query(
    `insert into purchase_orders (
       ${ORDER_COLUMNS}, status, device_id, device_key_id, device_public_key,
       payment_provider, payment_reference, proof_digest, payment_verified_at
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'payment_verified',$11,$12,$13,'MVOLA',$14,$15, now())`,
    [
      reference,
      BUYER,
      `${reference}-req`,
      "OM-A1B2C3D4",
      offer,
      specialty,
      deckNumber,
      product,
      offer === "subscription"
        ? "Abonnement Trimestriel · Accès illimité 3 mois"
        : "Cardiologie · Deck 4/10",
      offer === "subscription" ? 15000 : 3000,
      DEVICE,
      `${DEVICE}-key`,
      "public-key-1234567890",
      `${reference}-tx`,
      `digest-${reference}`,
    ],
  );
}

test("le SQL de livraison crée une licence de 3 mois pour l'abonnement", async () => {
  const db = await freshDatabase();
  try {
    await seedVerifiedOrder(db, {
      reference: "CMD-SUB-M1B2C3D4-ABCDEF01",
      offer: "subscription",
      product: "OPTIMUS_PRO",
    });

    const expiry = new Date(Date.now() + 90 * 86_400_000).toISOString();
    const delivered = await db.query(deliveredSql, [
      "CMD-SUB-M1B2C3D4-ABCDEF01",
      "payment_verified",
      "hash-sub",
      expiry,
      ADMIN,
      null,
    ]);

    assert.equal(delivered.rows.length, 1, "la commande doit passer en delivered");
    assert.equal(delivered.rows[0].status, "delivered");
    assert.ok(delivered.rows[0].licence_id, "une licence doit être créée");
    assert.ok(delivered.rows[0].licence_expires_at, "la licence doit porter une échéance");

    const licence = await db.query(
      `select product, device_id, purchase_reference, revoked_at,
              expires_at, activated_at
         from activation_keys where purchase_reference = $1`,
      ["CMD-SUB-M1B2C3D4-ABCDEF01"],
    );
    assert.equal(licence.rows.length, 1, "une seule licence, pas de doublon");
    assert.equal(licence.rows[0].product, "OPTIMUS_PRO");
    assert.equal(licence.rows[0].device_id, DEVICE, "licence liée à l'appareil de la commande");
    assert.equal(licence.rows[0].revoked_at, null);

    // Échéance à 90 jours (tolérance d'une minute pour l'horloge de la machine).
    const days = (new Date(licence.rows[0].expires_at).getTime() - Date.now()) / 86_400_000;
    assert.ok(days > 89.9 && days < 90.1, `échéance à ~90 jours, obtenue ${days}`);

    // L'évènement d'audit porte l'identifiant et l'échéance de la licence.
    const event = await db.query(
      `select metadata from purchase_order_events where reference = $1 and event_type = 'delivered'`,
      ["CMD-SUB-M1B2C3D4-ABCDEF01"],
    );
    assert.equal(event.rows.length, 1);
    assert.equal(event.rows[0].metadata.offer, "subscription");
    assert.ok(event.rows[0].metadata.licenceId);
    assert.ok(event.rows[0].metadata.licenceExpiresAt);

    // Rejouer la validation ne fabrique pas une seconde licence.
    const replay = await db.query(deliveredSql, [
      "CMD-SUB-M1B2C3D4-ABCDEF01",
      "payment_verified",
      "hash-sub-2",
      expiry,
      ADMIN,
      null,
    ]);
    assert.equal(replay.rows.length, 0, "une commande déjà livrée ne se re-livre pas");
    const count = await db.query(
      `select count(*)::int as n from activation_keys where purchase_reference = $1`,
      ["CMD-SUB-M1B2C3D4-ABCDEF01"],
    );
    assert.equal(count.rows[0].n, 1);
  } finally {
    await db.close();
  }
});

test("le SQL de livraison laisse une licence perpétuelle aux achats à l'unité", async () => {
  const db = await freshDatabase();
  try {
    await seedVerifiedOrder(db, {
      reference: "CMD-M1B2C3D4-ABCDEF02",
      offer: "deck",
      product: "CARDIO_DECK_04",
      specialty: "cardiologie",
      deckNumber: 4,
    });

    const delivered = await db.query(deliveredSql, [
      "CMD-M1B2C3D4-ABCDEF02",
      "payment_verified",
      "hash-deck",
      null, // <- licenseExpiryFor("deck") renvoie null
      ADMIN,
      null,
    ]);
    assert.equal(delivered.rows[0].status, "delivered");
    assert.equal(delivered.rows[0].licence_expires_at, null);

    const licence = await db.query(
      `select product, expires_at from activation_keys where purchase_reference = $1`,
      ["CMD-M1B2C3D4-ABCDEF02"],
    );
    assert.equal(licence.rows.length, 1);
    assert.equal(licence.rows[0].product, "CARDIO_DECK_04");
    assert.equal(licence.rows[0].expires_at, null);
  } finally {
    await db.close();
  }
});
