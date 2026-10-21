import assert from "node:assert/strict";
import test from "node:test";
import { isValidAccessToken } from "../licence-session.server.ts";
import {
  createInternationalOrder,
  makeInternationalReference,
  verifyCheckoutIdentity,
} from "./checkout.server.ts";

/**
 * Ouverture d'un paiement international — identité et commande.
 *
 * Deux garanties, et rien de moins :
 *   1. l'acheteur est identifié par SUPABASE (`GET /auth/v1/user`), jamais par
 *      une valeur du corps de la requête — sinon n'importe qui pourrait créer
 *      une commande au nom d'autrui ;
 *   2. la commande porte le montant RÉELLEMENT débité (1900 + 'EUR'), et un
 *      double-clic ne crée pas deux commandes (UNIQUE user_id + clientRequestId).
 */

const USER_ID = "3f6b1c2d-4e5f-4a6b-8c9d-0e1f2a3b4c5d";
const TOKEN = "jeton-supabase-opaque-de-plus-de-20-caracteres";
const ENV = {
  SUPABASE_URL: "https://demo.supabase.co/",
  SUPABASE_ANON_KEY: "anon-key",
};

type Inserted = { reference: string; user_id: string };

/** Faux SQL : ne répond qu'à l'INSERT de commande et à son audit. */
function fakeSql(onInsert: (params: unknown[]) => Inserted | null = () => null) {
  const state = { inserts: [] as unknown[][], events: [] as unknown[][] };
  return {
    state,
    async query<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
      const sql = text.replace(/\s+/g, " ").trim().toLowerCase();
      if (sql.startsWith("insert into purchase_orders")) {
        state.inserts.push(params);
        const row = onInsert(params);
        return (row ? [row] : []) as T[];
      }
      if (sql.startsWith("insert into purchase_order_events")) {
        state.events.push(params);
        return [] as T[];
      }
      return [] as T[];
    },
  };
}

test("l'identité vient de Supabase, pas du corps de la requête", async () => {
  const calls: string[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push(`${init?.method ?? "GET"} ${String(input)}`);
    assert.equal(
      new Headers(init?.headers).get("authorization"),
      `Bearer ${TOKEN}`,
      "le jeton doit être transmis tel quel à Supabase",
    );
    return Response.json({ id: USER_ID, email: "Acheteur@Example.com " });
  }) as typeof fetch;

  const result = await verifyCheckoutIdentity(TOKEN, { fetchImpl, env: ENV });
  assert.equal(result.ok, true);
  assert.deepEqual(result.ok && result.identity, {
    userId: USER_ID,
    email: "Acheteur@Example.com",
  });
  // C'est bien l'AUTORITÉ qui juge : un appel à /auth/v1/user, jamais une
  // relecture d'un `user_id` fourni par le client.
  assert.deepEqual(calls, ["GET https://demo.supabase.co/auth/v1/user"]);
});

test("un jeton refusé ou absent ne produit aucune identité", async () => {
  const reject = (async () => new Response("{}", { status: 401 })) as typeof fetch;
  const refused = await verifyCheckoutIdentity(TOKEN, { fetchImpl: reject, env: ENV });
  assert.deepEqual(refused, { ok: false, reason: "invalid" });

  let called = false;
  const spy = (async () => {
    called = true;
    return Response.json({ id: USER_ID });
  }) as typeof fetch;

  for (const token of [null, undefined, "", "court", "avec espace interne xx", 42]) {
    const result = await verifyCheckoutIdentity(token, { fetchImpl: spy, env: ENV });
    assert.equal(result.ok, false);
  }
  assert.equal(called, false, "un jeton invalide ne doit pas coûter d'appel réseau");

  // Sans configuration Supabase on ne peut pas vérifier : ni succès, ni 401.
  const unconfigured = await verifyCheckoutIdentity(TOKEN, { fetchImpl: spy, env: {} });
  assert.deepEqual(unconfigured, { ok: false, reason: "unconfigured" });
});

test("une panne réseau de Supabase est distinguée d'un refus", async () => {
  const boom = (async () => {
    throw new Error("ECONNRESET");
  }) as typeof fetch;
  const result = await verifyCheckoutIdentity(TOKEN, { fetchImpl: boom, env: ENV });
  assert.deepEqual(result, { ok: false, reason: "unreachable" });
});

test("un jeton plausible est opaque, borné et sans espace", () => {
  assert.equal(isValidAccessToken(TOKEN), true);
  assert.equal(isValidAccessToken("a".repeat(20)), true);
  assert.equal(isValidAccessToken("a".repeat(19)), false);
  assert.equal(isValidAccessToken("a".repeat(4097)), false);
  assert.equal(isValidAccessToken("deux mots dans un jeton"), false);
  assert.equal(isValidAccessToken(undefined), false);
});

test("la référence internationale respecte le format du tunnel historique", () => {
  const reference = makeInternationalReference(Date.parse("2026-01-01T00:00:00.000Z"));
  // Acceptée partout où une référence est validée (administration, reçus).
  assert.match(reference, /^CMD-SUB-[0-9A-Z]+-[0-9A-F]{8}$/);
  assert.notEqual(reference, makeInternationalReference(Date.parse("2026-01-01T00:00:00.000Z")));
});

test("la commande est créée en euros, montant débité, statut created", async () => {
  const sql = fakeSql((params) => ({ reference: String(params[0]), user_id: String(params[1]) }));

  const result = await createInternationalOrder({
    sql,
    identity: { userId: USER_ID, email: "acheteur@example.com" },
    clientRequestId: "11111111-2222-4333-8444-555555555555",
    now: Date.parse("2026-01-01T00:00:00.000Z"),
  });

  assert.equal(result.ok, true);
  const params = sql.state.inserts[0];
  assert.ok(params);
  // Ordre des paramètres : reference, user_id, client_request_id, optimus_id,
  // product, label, amount, currency.
  assert.equal(params[1], USER_ID, "user_id vérifié");
  assert.equal(params[3], USER_ID, "optimus_id = identité Supabase (pas d'OM-… inventé)");
  assert.equal(params[6], 1900, "19,00 € en centimes");
  assert.equal(params[7], "EUR");
  // Le prix n'est jamais fourni par le client : la requête ne lit que nos valeurs.
  assert.equal(sql.state.events.length, 1, "un événement d'audit à la création");
});

test("un double-clic ne crée pas une seconde commande", async () => {
  // Le `ON CONFLICT (user_id, client_request_id)` renvoie la ligne existante :
  // ici une référence DIFFÉRENTE de celle proposée, donc `created: false`.
  const sql = fakeSql(() => ({ reference: "CMD-SUB-DEJA-00000000", user_id: USER_ID }));

  const result = await createInternationalOrder({
    sql,
    identity: { userId: USER_ID, email: null },
    clientRequestId: "11111111-2222-4333-8444-555555555555",
  });

  assert.equal(result.ok, true);
  assert.equal(result.ok && result.reference, "CMD-SUB-DEJA-00000000");
  assert.equal(result.ok && result.created, false);
  assert.equal(sql.state.events.length, 0, "aucun événement d'audit pour un doublon");
});

test("une panne base ne fabrique pas de commande", async () => {
  const sql = {
    async query(): Promise<never[]> {
      throw new Error("connexion refusée");
    },
  };
  const result = await createInternationalOrder({
    sql,
    identity: { userId: USER_ID, email: null },
    clientRequestId: "11111111-2222-4333-8444-555555555555",
  });
  assert.deepEqual(result, { ok: false, reason: "database" });
});
