import assert from "node:assert/strict";
import test from "node:test";
import { computeLemonSignature } from "./signature.ts";
import { handleLemonWebhook } from "./webhook.ts";

/**
 * Webhook de paiement international — comportement HTTP et effets métier.
 *
 * Ces tests appellent le HANDLER réel avec une `Request` fabriquée, et non des
 * fonctions internes : ce qui est vérifié est ce que Lemon Squeezy recevra
 * vraiment (401 / 200 / 503), pas une valeur intermédiaire. La base et Supabase
 * sont des faux, ce qui rend les assertions possibles sans Postgres ni réseau.
 */

const SECRET = "secret-de-test-lemonsqueezy";
const USER_ID = "3f6b1c2d-4e5f-4a6b-8c9d-0e1f2a3b4c5d";
const REFERENCE = "CMD-SUB-M1B2C3D4-ABCDEF01";
const NOW = Date.parse("2026-01-01T00:00:00.000Z");

const ENV = {
  SUPABASE_URL: "https://demo.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
};

type OrderRow = {
  reference: string;
  user_id: string;
  status: string;
  product: string;
  currency: string | null;
  amount: number | string;
};

type SqlState = {
  claimed: boolean;
  eventStatus: string | null;
  order: OrderRow | null;
  transitions: string[];
  statements: { text: string; params: unknown[] }[];
};

function makeState(order: OrderRow | null = null): SqlState {
  return { claimed: false, eventStatus: null, order, transitions: [], statements: [] };
}

/**
 * Faux SQL : suffisamment fidèle pour distinguer les 5 requêtes du module
 * (revendication, clôture, recherche de commande, transition, journal), sans
 * embarquer Postgres dans la suite de tests.
 */
function fakeSql(state: SqlState) {
  return {
    async query<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
      const sql = text.replace(/\s+/g, " ").trim().toLowerCase();
      state.statements.push({ text: sql, params });

      if (sql.startsWith("insert into webhook_events")) {
        if (state.claimed) return [] as T[]; // déjà traité ⇒ rejeu
        state.claimed = true;
        return [{ status: "received" }] as T[];
      }
      if (sql.startsWith("update webhook_events")) {
        state.eventStatus = String(params[2]);
        return [] as T[];
      }
      if (sql.includes("update purchase_orders")) {
        const to = String(params[2]);
        state.transitions.push(to);
        if (state.order) state.order = { ...state.order, status: to };
        return [{ status: to }] as T[];
      }
      if (sql.includes("from purchase_orders")) {
        return (state.order ? [state.order] : []) as T[];
      }
      return [] as T[];
    },
  };
}

function fakeSupabase(options: { fail?: boolean; existing?: unknown[] } = {}) {
  const calls: { url: string; method: string; body: unknown }[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : null;
    calls.push({ url, method, body });

    if (options.fail) return new Response("erreur", { status: 500 });
    if (method === "GET") return Response.json(options.existing ?? []);
    return Response.json([{ id: "lic-123" }], { status: 201 });
  }) as typeof fetch;
  return { fetchImpl, calls };
}

function orderCreatedPayload(overrides: Record<string, unknown> = {}) {
  return {
    meta: {
      event_name: "order_created",
      custom_data: { user_id: USER_ID, order_reference: REFERENCE },
    },
    data: {
      type: "orders",
      id: "42",
      attributes: {
        status: "paid",
        total: 1900,
        currency: "EUR",
        user_email: "acheteur@example.com",
        created_at: "2026-01-01T00:00:00.000Z",
        test_mode: true,
        refunded: false,
      },
    },
    ...overrides,
  };
}

async function post(
  body: unknown,
  deps: {
    sql: ReturnType<typeof fakeSql>;
    fetchImpl?: typeof fetch;
    env?: Record<string, string | undefined>;
    secret?: string | null;
    signature?: string;
  },
) {
  const raw = typeof body === "string" ? body : JSON.stringify(body);
  const signature =
    deps.signature ?? (await computeLemonSignature(raw, deps.secret ?? SECRET));
  const request = new Request("https://app.test/api/webhooks/lemonsqueezy", {
    method: "POST",
    headers: { "content-type": "application/json", "x-signature": signature },
    body: raw,
  });
  return handleLemonWebhook(request, {
    sql: deps.sql,
    fetchImpl: deps.fetchImpl,
    env: deps.env ?? ENV,
    secret: deps.secret === undefined ? SECRET : deps.secret,
    now: () => NOW,
  });
}

const BASE_ORDER: OrderRow = {
  reference: REFERENCE,
  user_id: USER_ID,
  status: "created",
  product: "OPTIMUS_PRO",
  currency: "EUR",
  amount: 1900,
};

test("rejette une signature invalide avec un 401, sans toucher à la base", async () => {
  const state = makeState(BASE_ORDER);
  const sql = fakeSql(state);
  const supabase = fakeSupabase();

  const response = await post(orderCreatedPayload(), {
    sql,
    fetchImpl: supabase.fetchImpl,
    signature: "b".repeat(64),
  });

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { ok: false, error: "invalid_signature" });
  // Aucune requête SQL, aucun appel Supabase : l'appel n'est même pas parsé.
  assert.equal(state.statements.length, 0);
  assert.equal(supabase.calls.length, 0);
});

test("refuse tout quand le secret du webhook n'est pas configuré (503)", async () => {
  const state = makeState(BASE_ORDER);
  const response = await post(orderCreatedPayload(), {
    sql: fakeSql(state),
    secret: null,
    signature: "c".repeat(64),
  });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { ok: false, error: "webhook_unconfigured" });
  assert.equal(state.statements.length, 0);
});

test("traite un order_created payé : licence Supabase + commande livrée", async () => {
  const state = makeState(BASE_ORDER);
  const supabase = fakeSupabase();

  const response = await post(orderCreatedPayload(), {
    sql: fakeSql(state),
    fetchImpl: supabase.fetchImpl,
  });

  assert.equal(response.status, 200);
  const body = (await response.json()) as Record<string, unknown>;
  assert.equal(body.ok, true);
  assert.equal(body.outcome, "delivered");
  assert.equal(body.reference, REFERENCE);
  assert.equal(body.licenceId, "lic-123");

  // La licence est écrite AVANT le passage en livré (sinon : commande livrée
  // sans accès, le pire état possible).
  const created = supabase.calls.find((call) => call.method === "POST");
  assert.ok(created, "la licence doit être créée dans Supabase");
  const payload = (created.body as Record<string, unknown>[])[0];
  assert.equal(payload.user_id, USER_ID);
  assert.equal(payload.status, "active");
  assert.equal(payload.plan, "premium");
  // `licences.licence_hash` est NOT NULL dans le schéma réel, et c'est lui qui
  // porte l'idempotence côté base : deux livraisons du même ordre écrivent la
  // MÊME valeur au lieu de créer deux lignes.
  assert.equal(payload.licence_hash, "lemonsqueezy:42");
  // 90 jours (3 × 30) ancrés sur l'horodatage de la COMMANDE, pas sur `now`.
  assert.equal(payload.expires_at, "2026-04-01T00:00:00.000Z");

  // La chaîne légale est parcourue cran par cran (trigger de la migration 0011).
  assert.deepEqual(state.transitions, [
    "instructions_requested",
    "proof_ready",
    "verification_pending",
    "payment_verified",
    "delivered",
  ]);
  assert.equal(state.order?.status, "delivered");
  assert.equal(state.eventStatus, "processed");

  // La commande porte désormais la référence du fournisseur.
  const advance = state.statements.find((statement) =>
    statement.text.includes("update purchase_orders"),
  );
  assert.ok(advance);
  assert.equal(advance.params[4], "42");
});

test("un rejeu du même order_id ne délivre pas une seconde licence", async () => {
  const state = makeState(BASE_ORDER);
  const supabase = fakeSupabase();
  const deps = { sql: fakeSql(state), fetchImpl: supabase.fetchImpl };

  const first = await post(orderCreatedPayload(), deps);
  assert.equal(first.status, 200);
  const licenceCalls = () => supabase.calls.filter((call) => call.method === "POST").length;
  assert.equal(licenceCalls(), 1);

  const replay = await post(orderCreatedPayload(), deps);
  assert.equal(replay.status, 200);
  const body = (await replay.json()) as Record<string, unknown>;
  assert.equal(body.outcome, "duplicate");
  // Le point central : toujours UNE seule écriture de licence.
  assert.equal(licenceCalls(), 1);
});

test("un paiement sans user_id est conservé pour traitement manuel (200, unmatched)", async () => {
  const state = makeState(BASE_ORDER);
  const supabase = fakeSupabase();

  const response = await post(
    orderCreatedPayload({
      meta: { event_name: "order_created", custom_data: {} },
    }),
    { sql: fakeSql(state), fetchImpl: supabase.fetchImpl },
  );

  assert.equal(response.status, 200);
  const body = (await response.json()) as Record<string, unknown>;
  assert.equal(body.outcome, "unmatched");
  assert.equal(body.reason, "missing-user");
  assert.equal(state.eventStatus, "unmatched");
  assert.equal(supabase.calls.length, 0);
  assert.deepEqual(state.transitions, []);
});

test("un événement non payé n'écrit rien et ne demande pas de rejeu (200)", async () => {
  const state = makeState(BASE_ORDER);
  const supabase = fakeSupabase();

  const response = await post(
    orderCreatedPayload({
      data: {
        type: "orders",
        id: "43",
        attributes: { status: "pending", total: 1900, currency: "EUR" },
      },
    }),
    { sql: fakeSql(state), fetchImpl: supabase.fetchImpl },
  );

  assert.equal(response.status, 200);
  const body = (await response.json()) as Record<string, unknown>;
  assert.equal(body.outcome, "ignored");
  assert.equal(body.reason, "not-paid");
  assert.equal(state.statements.length, 0);
  assert.equal(supabase.calls.length, 0);
});

test("sans Supabase configuré, on échoue en 503 pour que Lemon Squeezy rejoue", async () => {
  const state = makeState(BASE_ORDER);
  const response = await post(orderCreatedPayload(), {
    sql: fakeSql(state),
    fetchImpl: fakeSupabase().fetchImpl,
    // Ni SUPABASE_URL ni clé de service : la licence EST le produit livré.
    env: {},
  });

  assert.equal(response.status, 503);
  const body = (await response.json()) as Record<string, unknown>;
  assert.equal(body.outcome, "failed");
  assert.equal(body.reason, "licence");
  assert.equal(state.eventStatus, "failed");
  assert.deepEqual(state.transitions, []);
});

test("une panne d'écriture de licence n'avance pas la commande", async () => {
  const state = makeState(BASE_ORDER);
  const response = await post(orderCreatedPayload(), {
    sql: fakeSql(state),
    fetchImpl: fakeSupabase({ fail: true }).fetchImpl,
  });

  assert.equal(response.status, 503);
  assert.equal(state.eventStatus, "failed");
  assert.deepEqual(state.transitions, []);
  assert.equal(state.order?.status, "created");
});

test("un corps signé mais illisible renvoie 400", async () => {
  const state = makeState(BASE_ORDER);
  const response = await post("{ceci n'est pas du json", { sql: fakeSql(state) });
  assert.equal(response.status, 400);
  assert.equal(state.statements.length, 0);
});

test("la chaîne de statuts du webhook est autorisée par le trigger SQL", async () => {
  const { PROGRESS_PATH } = await import("./delivery.ts");
  const { readFile } = await import("node:fs/promises");

  // Le trigger `guard_purchase_order_status_transition` (migration 0011) refuse
  // tout saut de statut. Si le webhook parcourt un cran que la base n'autorise
  // pas, le paiement échoue au moment de la livraison — en production, sur un
  // client qui a payé. On confronte donc le code au SQL plutôt que de faire
  // confiance à deux listes tenues à la main.
  const sql = await readFile("migrations/0011_purchase_state_machine.sql", "utf8");
  const allowed = new Set(
    [...sql.matchAll(/OLD\.status\s*=\s*'([a-z_]+)'\s+AND\s+NEW\.status\s*=\s*'([a-z_]+)'/g)].map(
      (match) => `${match[1]}->${match[2]}`,
    ),
  );
  assert.ok(allowed.size >= 6, `transitions lues dans le SQL : ${allowed.size}`);

  for (let index = 1; index < PROGRESS_PATH.length; index += 1) {
    const from = PROGRESS_PATH[index - 1];
    const to = PROGRESS_PATH[index];
    assert.ok(allowed.has(`${from}->${to}`), `transition refusée par la base : ${from} -> ${to}`);
  }
  assert.equal(PROGRESS_PATH[0], "created");
  assert.equal(PROGRESS_PATH.at(-1), "delivered");
});
