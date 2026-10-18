import assert from "node:assert/strict";
import test from "node:test";
import { NONCE_PATTERN, NONCE_TTL_MS, consumeNonce, resetNonceStore } from "./replay-guard.ts";

/**
 * Anti-replay : un nonce doit être accepté UNE fois. Le rejeu d'une requête
 * capturée est le vecteur le plus simple pour renouveler un jeton de 24 h
 * indéfiniment ; ces tests verrouillent le comportement des deux backends.
 */

function clearRedisEnv() {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
}

test("le format du nonce est strictement borné", () => {
  assert.ok(NONCE_PATTERN.test("abcdefghijklmnop"));
  assert.ok(NONCE_PATTERN.test("A1b2C3d4E5f6G7h8I9j0_-xyz"));
  assert.equal(NONCE_PATTERN.test("court"), false);
  assert.equal(NONCE_PATTERN.test("a".repeat(65)), false);
  assert.equal(NONCE_PATTERN.test("espaces interdits ici"), false);
});

test("mémoire : un nonce est accepté une fois, puis refusé", async () => {
  clearRedisEnv();
  resetNonceStore();

  const nonce = "nonce-de-test-0001";
  assert.equal(await consumeNonce(nonce), "fresh");
  assert.equal(await consumeNonce(nonce), "replayed");
  assert.equal(await consumeNonce(nonce), "replayed");

  // Un autre nonce reste utilisable.
  assert.equal(await consumeNonce("nonce-de-test-0002"), "fresh");
});

test("mémoire : un nonce expiré (TTL 5 min) redevient utilisable", async () => {
  clearRedisEnv();
  resetNonceStore();

  const nonce = "nonce-de-test-0003";
  const start = Date.now();
  assert.equal(await consumeNonce(nonce, start), "fresh");
  assert.equal(await consumeNonce(nonce, start + NONCE_TTL_MS - 1000), "replayed");
  assert.equal(await consumeNonce(nonce, start + NONCE_TTL_MS + 1000), "fresh");
});

test("mémoire : un nonce mal formé n'ouvre jamais le service", async () => {
  clearRedisEnv();
  resetNonceStore();
  assert.equal(await consumeNonce("court"), "unavailable");
});

test("Redis : SET NX EX 300 est utilisé et un rejeu est détecté", async () => {
  resetNonceStore();
  process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
  process.env.UPSTASH_REDIS_REST_TOKEN = "token-de-test";

  const calls: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    calls.push(String(input));
    // Premier appel : clé créée (« OK ») ; suivants : déjà présente (null).
    const result = calls.length === 1 ? "OK" : null;
    return new Response(JSON.stringify({ result }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  try {
    assert.equal(await consumeNonce("nonce-redis-0001"), "fresh");
    assert.equal(await consumeNonce("nonce-redis-0001"), "replayed");
    assert.equal(calls.length, 2);
    assert.match(calls[0], /\/set\/nonce%3Anonce-redis-0001\/1\?NX&EX=300$/);
  } finally {
    globalThis.fetch = originalFetch;
    clearRedisEnv();
    resetNonceStore();
  }
});

test("Redis : une panne du backend ferme le service (fail closed)", async () => {
  resetNonceStore();
  process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
  process.env.UPSTASH_REDIS_REST_TOKEN = "token-de-test";

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error("réseau indisponible");
  }) as typeof fetch;

  try {
    assert.equal(await consumeNonce("nonce-redis-0002"), "unavailable");
  } finally {
    globalThis.fetch = originalFetch;
    clearRedisEnv();
    resetNonceStore();
  }
});
