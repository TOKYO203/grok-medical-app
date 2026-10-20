/**
 * Limiteur de débit — comportement RÉEL, pas seulement la forme du source.
 *
 * Ce que ces tests protègent :
 *
 *  1. le REPLI en mémoire (dev, ou panne Upstash) compte vraiment et reste borné ;
 *  2. le chemin PARTAGÉ (Upstash REST) envoie bien les trois commandes qui font
 *     la fenêtre fixe — un `PEXPIRE` sans `NX` repousserait la fenêtre à chaque
 *     appel, et un client régulier ne serait jamais réinitialisé ;
 *  3. une panne du stockage partagé n'ouvre PAS un budget illimité : on retombe
 *     sur le seau mémoire local ;
 *  4. les handlers de route attendent (`await`) le limiteur devenu asynchrone —
 *     oublier l'`await` comparerait une Promise à `undefined` et laisserait
 *     passer toutes les requêtes.
 *
 * Le faux Upstash est un vrai serveur HTTP local : on vérifie le contrat réseau
 * (chemin, jeton, corps) plutôt que de simuler une fonction.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createServer } from "node:http";
import test from "node:test";

import {
  rateLimit,
  rateLimitRequest,
  retryAfterSeconds,
} from "../src/lib/security/rate-limit.server.ts";

const ENV_URL = "UPSTASH_REDIS_REST_URL";
const ENV_TOKEN = "UPSTASH_REDIS_REST_TOKEN";

/** `process.env` restauré même si le test échoue. */
async function withEnv(values, fn) {
  const saved = new Map();
  for (const [key, value] of Object.entries(values)) {
    saved.set(key, process.env[key]);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return await fn();
  } finally {
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

/**
 * Requête avec les en-têtes Cloudflare : `cf-ray` est le marqueur de plateforme
 * réécrit par Cloudflare, `cf-connecting-ip` l'IP de confiance. Sans cela tous
 * les appels retomberaient sur le seau partagé `"shared"`.
 */
function cfRequest(ip) {
  return new Request("https://optimusmedical.pages.dev/api/test", {
    method: "POST",
    headers: { "cf-ray": "8f0e0a0d0-cdg", "cf-connecting-ip": ip },
  });
}

/** Faux Upstash : enregistre les appels, répond ce que le test demande. */
function fakeUpstash(handler) {
  const calls = [];
  const server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      calls.push({
        method: request.method,
        url: request.url,
        authorization: request.headers.authorization,
        contentType: request.headers["content-type"],
        body,
      });
      const { status = 200, payload = [] } = handler(calls.length) ?? {};
      response.writeHead(status, { "content-type": "application/json" });
      response.end(JSON.stringify(payload));
    });
  });
  return {
    calls,
    server,
    start: () =>
      new Promise((resolve) => {
        server.listen(0, "127.0.0.1", () =>
          resolve(`http://127.0.0.1:${server.address().port}`),
        );
      }),
    stop: () => new Promise((resolve) => server.close(resolve)),
  };
}

test("sans Upstash : le seau mémoire compte, isole les sujets et bloque au plafond", async () => {
  await withEnv({ [ENV_URL]: undefined, [ENV_TOKEN]: undefined }, async () => {
    const first = await rateLimitRequest(cfRequest("203.0.113.10"), "mem-a", 3, 60_000);
    const second = await rateLimitRequest(cfRequest("203.0.113.10"), "mem-a", 3, 60_000);
    const third = await rateLimitRequest(cfRequest("203.0.113.10"), "mem-a", 3, 60_000);
    const fourth = await rateLimitRequest(cfRequest("203.0.113.10"), "mem-a", 3, 60_000);

    assert.deepEqual(
      [first.ok, second.ok, third.ok, fourth.ok],
      [true, true, true, false],
      "la 4e requête d'un plafond de 3 doit être refusée",
    );
    assert.equal(fourth.remaining, 0);
    assert.ok(fourth.resetAt > Date.now(), "resetAt doit être dans le futur");

    // Sujet différent = budget différent (sinon un étudiant bloquerait la planète).
    const other = await rateLimitRequest(cfRequest("198.51.100.4"), "mem-a", 3, 60_000);
    assert.equal(other.ok, true);

    // Portée différente = budget différent : /api/ai-stream et /api/admin-verify
    // n'ont pas la même limite et ne doivent pas se consommer mutuellement.
    const otherScope = await rateLimitRequest(cfRequest("203.0.113.10"), "mem-b", 3, 60_000);
    assert.equal(otherScope.ok, true);
  });
});

test("sans en-tête de confiance, tous les appelants partagent un seul seau (fail closed)", async () => {
  await withEnv({ [ENV_URL]: undefined, [ENV_TOKEN]: undefined }, async () => {
    const bare = (ip) =>
      new Request("https://optimus.example/api/test", {
        headers: { "x-forwarded-for": ip },
      });

    const a = await rateLimitRequest(bare("203.0.113.1"), "mem-shared", 2, 60_000);
    const b = await rateLimitRequest(bare("203.0.113.2"), "mem-shared", 2, 60_000);
    const c = await rateLimitRequest(bare("203.0.113.3"), "mem-shared", 2, 60_000);

    assert.deepEqual([a.ok, b.ok, c.ok], [true, true, false]);
  });
});

test("rateLimitRequest est asynchrone, rateLimit (admin) reste synchrone", async () => {
  await withEnv({ [ENV_URL]: undefined, [ENV_TOKEN]: undefined }, async () => {
    const pending = rateLimitRequest(cfRequest("203.0.113.30"), "async-contract", 5, 60_000);
    assert.ok(pending instanceof Promise, "les handlers doivent pouvoir l'attendre");
    await pending;
  });

  const sync = rateLimit("sync-contract", 1, 60_000);
  assert.equal(typeof sync.ok, "boolean");
});

test("Upstash configuré : une seule requête /pipeline, INCR + PEXPIRE NX + PTTL", async () => {
  const fake = fakeUpstash(() => ({
    payload: [{ result: 1 }, { result: 1 }, { result: 60_000 }],
  }));
  const url = await fake.start();

  try {
    await withEnv({ [ENV_URL]: url, [ENV_TOKEN]: "token-de-test" }, async () => {
      const result = await rateLimitRequest(cfRequest("203.0.113.50"), "redis-a", 10, 60_000);

      assert.equal(result.ok, true);
      assert.equal(result.remaining, 9, "count=1 pour un plafond de 10 → 9 restants");
      assert.ok(
        result.resetAt >= Date.now() + 55_000,
        "resetAt doit refléter le TTL renvoyé par Redis, pas la fenêtre théorique",
      );
    });

    assert.equal(fake.calls.length, 1, "un seul aller-retour réseau par requête");
    const [call] = fake.calls;
    assert.equal(call.method, "POST");
    assert.equal(call.url, "/pipeline");
    assert.equal(call.authorization, "Bearer token-de-test");
    assert.match(call.contentType, /application\/json/);

    const commands = JSON.parse(call.body);
    assert.deepEqual(commands[0], ["INCR", "optimus:ratelimit:redis-a:203.0.113.50"]);
    assert.deepEqual(commands[1], ["PEXPIRE", "optimus:ratelimit:redis-a:203.0.113.50", 60_000, "NX"]);
    assert.deepEqual(commands[2], ["PTTL", "optimus:ratelimit:redis-a:203.0.113.50"]);
    assert.equal(commands[1][3], "NX", "sans NX, chaque appel repousserait la fenêtre");
  } finally {
    await fake.stop();
  }
});

test("Upstash configuré : le compteur partagé refuse au-delà du plafond", async () => {
  const fake = fakeUpstash(() => ({
    payload: [{ result: 11 }, { result: 0 }, { result: 240_000 }],
  }));
  const url = await fake.start();

  try {
    await withEnv({ [ENV_URL]: url, [ENV_TOKEN]: "token-de-test" }, async () => {
      const result = await rateLimitRequest(cfRequest("203.0.113.51"), "redis-b", 10, 60_000);
      assert.equal(result.ok, false);
      assert.equal(result.remaining, 0);
      assert.ok(result.resetAt > Date.now());
      assert.ok(retryAfterSeconds(result) >= 200, "Retry-After suit le TTL réel (240 s)");
    });
  } finally {
    await fake.stop();
  }
});

test("panne du stockage partagé : repli mémoire, jamais de budget illimité", async () => {
  let calls = 0;
  const fake = fakeUpstash(() => {
    calls += 1;
    return calls === 1
      ? { status: 500, payload: { error: "boom" } }
      : { payload: [{ error: "WRONGTYPE" }, null, null] };
  });
  const url = await fake.start();

  try {
    await withEnv({ [ENV_URL]: url, [ENV_TOKEN]: "token-de-test" }, async () => {
      // 1) HTTP 500 → repli mémoire : la requête passe MAIS est comptée localement.
      const first = await rateLimitRequest(cfRequest("203.0.113.60"), "redis-down", 1, 60_000);
      assert.equal(first.ok, true);

      // 2) Erreur Redis dans le pipeline → repli mémoire : le seau local est déjà
      //    à 1/1, la requête suivante doit donc être refusée.
      const second = await rateLimitRequest(cfRequest("203.0.113.60"), "redis-down", 1, 60_000);
      assert.equal(second.ok, false);
    });
  } finally {
    await fake.stop();
  }
});

test("une URL Upstash invalide n'active pas le backend partagé", async () => {
  await withEnv({ [ENV_URL]: "ftp://nope", [ENV_TOKEN]: "token" }, async () => {
    const first = await rateLimitRequest(cfRequest("203.0.113.70"), "redis-invalid", 1, 60_000);
    const second = await rateLimitRequest(cfRequest("203.0.113.70"), "redis-invalid", 1, 60_000);
    assert.deepEqual([first.ok, second.ok], [true, false]);
  });
});

test("aucun handler de route n'oublie d'attendre le limiteur asynchrone", () => {
  const routesDir = new URL("../src/routes/", import.meta.url);
  const offenders = [];

  for (const name of readdirSync(routesDir)) {
    if (!name.endsWith(".ts") && !name.endsWith(".tsx")) continue;
    const source = readFileSync(new URL(name, routesDir), "utf8");
    if (!source.includes("rateLimitRequest(")) continue;
    for (const match of source.matchAll(/(.{0,40})rateLimitRequest\(/g)) {
      const before = match[1];
      if (!/\bawait\s+$/.test(before)) offenders.push(`${name}: ${before.trim()}rateLimitRequest(`);
    }
  }

  assert.deepEqual(
    offenders,
    [],
    "un rateLimitRequest sans await compare une Promise : il laisse tout passer",
  );
});

test("le limiteur partagé ne dépend d'aucun SDK (0 dépendance ajoutée)", () => {
  const pkg = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  );
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  for (const name of Object.keys(deps)) {
    assert.ok(
      !name.startsWith("@upstash/"),
      `${name} : le limiteur passe par l'API REST d'Upstash (cf. src/server/replay-guard.ts)`,
    );
  }

  const source = readFileSync(
    new URL("../src/lib/security/rate-limit.server.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /\/pipeline/, "le compteur passe par /pipeline");
  assert.match(source, /MAX_BUCKETS\s*=\s*\d+/, "le seau mémoire doit rester borné");
  assert.match(source, /rateLimitMemory\(key, max, windowMs\)/, "le repli mémoire doit rester branché");
});
