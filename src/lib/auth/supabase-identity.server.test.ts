import assert from "node:assert/strict";
import test from "node:test";
import {
  clearSupabaseIdentityCache,
  isSupabaseAccessToken,
  readJwtExpiryMs,
  readJwtPayload,
  resolveSupabaseBearer,
  verifySupabaseIdentity,
} from "./supabase-identity.server.ts";

/**
 * IDENTITÉ SUPABASE CÔTÉ SERVEUR — le garde-fou de la « double authentification ».
 *
 * BUG CORRIGÉ (2026-10-22) : le tunnel Mobile Money, `/achats`, `/donnees` et
 * l'export de compte passaient par `authMiddleware`, qui ne savait résoudre
 * qu'une session Better Auth. Sur le déploiement (où `/api/auth/*` ne répond
 * pas), un utilisateur pourtant connecté par Supabase recevait 401 : il devait
 * « se reconnecter » pour accéder à `/pro`.
 *
 * Ce que ce test verrouille :
 *   1. un jeton émis par un AUTRE projet (ou un jeton opaque) n'est jamais pris
 *      pour un jeton Supabase — sinon un jeton Better Auth serait envoyé à
 *      Supabase, refusé, et l'utilisateur légitime déconnecté du bac à sable ;
 *   2. l'identité ne vient que de la RÉPONSE de l'émetteur, jamais du jeton ;
 *   3. les quatre issues (vérifié / refusé / injoignable / non applicable) sont
 *      distinctes, parce qu'elles n'appellent pas la même réponse HTTP ;
 *   4. une panne réseau n'est pas mémorisée (sinon 60 s d'indisponibilité) ;
 *   5. une déconnexion (`auth/v1/user` → 401) est bien mémorisée, et une
 *      vérification réussie évite un second appel.
 */

const ENV = {
  SUPABASE_URL: "https://demo.supabase.co",
  SUPABASE_ANON_KEY: "anon-key",
};

const USER_ID = "0d4efcb8-b510-4748-affd-8e868d7dd56f";

/** Construit un JWT non signé (la signature n'est jamais vérifiée ici). */
function jwt(payload: Record<string, unknown>, signature = "sig"): string {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode(payload)}.${signature}`;
}

const SUPABASE_TOKEN = jwt({
  iss: "https://demo.supabase.co/auth/v1",
  aud: "authenticated",
  sub: USER_ID,
  exp: Math.floor(Date.now() / 1000) + 3600,
  role: "authenticated",
});

const FOREIGN_TOKEN = jwt({
  iss: "https://autre-projet.supabase.co/auth/v1",
  aud: "authenticated",
  sub: USER_ID,
  exp: Math.floor(Date.now() / 1000) + 3600,
});

/** Réponse 200 de `GET /auth/v1/user`. */
function okUser(userId = USER_ID, email = "etudiant@optimus-qa.invalid") {
  return new Response(JSON.stringify({ id: userId, email }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

/** Espion `fetch` : enregistre les appels et sert la réponse fournie. */
function fetchSpy(response: () => Response | Promise<Response>) {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : String(input);
    const headers = Object.fromEntries(
      Object.entries((init?.headers ?? {}) as Record<string, string>).map(([k, v]) => [
        k.toLowerCase(),
        String(v),
      ]),
    );
    calls.push({ url, headers });
    return response();
  }) as typeof fetch;
  return { impl, calls };
}

test.beforeEach(() => clearSupabaseIdentityCache());

test("un jeton d'un autre projet Supabase n'est JAMAIS pris pour le nôtre", async () => {
  const { impl, calls } = fetchSpy(() => okUser());
  // Détection par l'émetteur exact, sans appel réseau.
  assert.equal(isSupabaseAccessToken(FOREIGN_TOKEN, { url: ENV.SUPABASE_URL, anonKey: "k" }), false);
  assert.equal(isSupabaseAccessToken(SUPABASE_TOKEN, { url: ENV.SUPABASE_URL, anonKey: "k" }), true);

  const result = await verifySupabaseIdentity(FOREIGN_TOKEN, { env: ENV, fetchImpl: impl });
  assert.deepEqual(result, { ok: false, reason: "not-supabase" });
  // Preuve : aucun appel réseau n'a été fait vers Supabase avec ce jeton.
  assert.equal(calls.length, 0);
});

test("un jeton opaque (Better Auth) n'est pas classé Supabase", async () => {
  const opaque = "jeton-better-auth-opaque-de-plus-de-20-caracteres";
  assert.equal(readJwtPayload(opaque), null);
  assert.equal(readJwtExpiryMs(opaque), null);
  const { impl, calls } = fetchSpy(() => okUser());
  const resolved = await resolveSupabaseBearer(opaque, { env: ENV, fetchImpl: impl });
  assert.equal(resolved.kind, "not-applicable");
  assert.equal(calls.length, 0);
});

test("l'identité vient de la réponse de l'émetteur, jamais du jeton", async () => {
  // Le jeton prétend `sub: A`, l'émetteur répond `id: B` : c'est B qui gagne.
  const claimed = "11111111-1111-4111-8111-111111111111";
  const real = "22222222-2222-4222-8222-222222222222";
  const token = jwt({
    iss: "https://demo.supabase.co/auth/v1",
    aud: "authenticated",
    sub: claimed,
    exp: Math.floor(Date.now() / 1000) + 3600,
  });
  const { impl, calls } = fetchSpy(() => okUser(real, "reel@optimus-qa.invalid"));
  const resolved = await resolveSupabaseBearer(token, { env: ENV, fetchImpl: impl });
  assert.deepEqual(resolved, {
    kind: "verified",
    userId: real,
    email: "reel@optimus-qa.invalid",
  });
  assert.equal(calls[0].url, "https://demo.supabase.co/auth/v1/user");
  // Clé PUBLIQUE seulement : aucune clé `service_role` ne doit transiter ici.
  assert.equal(calls[0].headers.apikey, ENV.SUPABASE_ANON_KEY);
  assert.match(calls[0].headers.authorization, /^Bearer /);
});

test("jeton refusé par Supabase → rejected (401), et c'est mémorisé", async () => {
  const { impl, calls } = fetchSpy(() => new Response("{}", { status: 401 }));
  const first = await resolveSupabaseBearer(SUPABASE_TOKEN, { env: ENV, fetchImpl: impl });
  assert.equal(first.kind, "rejected");
  const second = await resolveSupabaseBearer(SUPABASE_TOKEN, { env: ENV, fetchImpl: impl });
  assert.equal(second.kind, "rejected");
  assert.equal(calls.length, 1, "un refus mémorisé évite de marteler l'émetteur");
});

test("une vérification réussie évite un second appel (cache 60 s)", async () => {
  const { impl, calls } = fetchSpy(() => okUser());
  const first = await resolveSupabaseBearer(SUPABASE_TOKEN, { env: ENV, fetchImpl: impl });
  const second = await resolveSupabaseBearer(SUPABASE_TOKEN, { env: ENV, fetchImpl: impl });
  assert.equal(first.kind, "verified");
  assert.deepEqual(first, second);
  assert.equal(calls.length, 1);
  // Le cache expire : au-delà de la fenêtre, on revérifie.
  const later = await resolveSupabaseBearer(SUPABASE_TOKEN, {
    env: ENV,
    fetchImpl: impl,
    now: () => Date.now() + 61_000,
  });
  assert.equal(later.kind, "verified");
  assert.equal(calls.length, 2);
});

test("Supabase injoignable → unreachable, et la panne n'est PAS mémorisée", async () => {
  const { impl, calls } = fetchSpy(() => {
    throw new Error("network down");
  });
  const first = await resolveSupabaseBearer(SUPABASE_TOKEN, { env: ENV, fetchImpl: impl });
  assert.equal(first.kind, "unreachable");
  const second = await resolveSupabaseBearer(SUPABASE_TOKEN, { env: ENV, fetchImpl: impl });
  assert.equal(second.kind, "unreachable");
  // Deux tentatives : une panne de 2 s ne doit pas condamner l'utilisateur 60 s.
  assert.equal(calls.length, 2);
});

test("un 500 de Supabase est aussi une indisponibilité, pas une déconnexion", async () => {
  const { impl } = fetchSpy(() => new Response("boom", { status: 500 }));
  const resolved = await resolveSupabaseBearer(SUPABASE_TOKEN, { env: ENV, fetchImpl: impl });
  assert.equal(resolved.kind, "unreachable");
});

test("Supabase non configuré côté serveur → not-applicable (repli historique)", async () => {
  const { impl, calls } = fetchSpy(() => okUser());
  const resolved = await resolveSupabaseBearer(SUPABASE_TOKEN, { env: {}, fetchImpl: impl });
  assert.equal(resolved.kind, "not-applicable");
  assert.equal(calls.length, 0);
});

test("sans jeton → not-applicable", async () => {
  const resolved = await resolveSupabaseBearer(undefined, { env: ENV });
  assert.equal(resolved.kind, "not-applicable");
});

test("l'expiration du jeton est lisible sans le vérifier", () => {
  const exp = Math.floor(Date.now() / 1000) + 120;
  const token = jwt({ iss: "https://demo.supabase.co/auth/v1", exp });
  assert.equal(readJwtExpiryMs(token), exp * 1000);
});
