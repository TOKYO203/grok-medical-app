/**
 * Regression tests for the security pass on route shadowing, client-side
 * secrets and upstream error disclosure.
 *
 * Three defects are locked down here:
 *   1. `/api/licenses/activate` was implemented TWICE — a hardened H3 handler in
 *      `server/api/` and a weak TanStack handler in `src/routes/`. In `vite dev`
 *      the Nitro plugin is not wired (it only runs for build/preview), so the
 *      WEAK twin was the only one serving the path, and the hardened handler the
 *      other security tests assert on was never reached. Both implementations
 *      must now enforce the same guards.
 *   2. A dead module read a paid provider key from a `VITE_`-prefixed variable,
 *      i.e. a value Vite inlines into the browser bundle.
 *   3. `/api/ai-stream` is unauthenticated and streamed the provider's raw error
 *      body back to the caller.
 *
 * The behavioural layer imports the pure helpers directly (Node 24 strips the
 * types); the rest is asserted against source text with comments removed, since
 * these are handlers/components that cannot be invoked from a unit test.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

/** Source with comments removed, so negative assertions ignore documentation. */
const code = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const tanstackActivate = read("../src/routes/api.licenses.activate.ts");
const h3Activate = read("../server/api/licenses/activate.ts");
const serverAi = read("../src/lib/ai/server-ai.server.ts");
const aiStream = read("../src/routes/api.ai-stream.ts");

// ────────────────────── 1. route shadowing / parity ───────────────────────

test("the activation route validates the key, profile and device strictly", () => {
  // `deviceId.length < 8` accepted any 8-char junk string, so a caller could
  // rebind a licence by inventing a fresh device id per request.
  assert.doesNotMatch(code(tanstackActivate), /deviceId\.length\s*<\s*8/);
  assert.match(tanstackActivate, /\^\[a-f0-9\]\{12\}\$/i);
  for (const source of [tanstackActivate, h3Activate]) {
    assert.match(source, /OPT-\(\?:\[A-F0-9\]\{4\}-\)\{5\}\[A-F0-9\]\{4\}/);
    assert.match(source, /OM-\[A-F0-9\]\{8\}/);
  }
});

test("the activation route binds the device in ONE atomic statement", () => {
  // A pre-SELECT followed by an UPDATE let two concurrent requests on a fresh
  // key both pass the "not yet bound" check and both receive a signed receipt
  // bound to a different device — a licence-doubling TOCTOU race.
  assert.match(tanstackActivate, /update activation_keys/);
  assert.match(tanstackActivate, /device_id is null or device_id = \$2/);
  assert.match(tanstackActivate, /returning id, product, expires_at, activated_at/);
  assert.doesNotMatch(code(tanstackActivate), /SELECT id, optimus_id, device_id/);
});

test("the activation route is throttled on the trusted client IP", () => {
  assert.match(tanstackActivate, /rateLimitRequest\(\s*request,\s*"license-activate",/);
  assert.match(tanstackActivate, /status: 429|,\s*429,/);
  assert.match(tanstackActivate, /Retry-After/);
});

test("the activation route fails closed and never enumerates keys", () => {
  // "Clé introuvable" / "liée à un autre profil" / "déjà utilisée" told an
  // anonymous caller which keys exist and which profile owns them.
  assert.doesNotMatch(code(tanstackActivate), /Clé introuvable/);
  assert.doesNotMatch(code(tanstackActivate), /autre profil/);
  assert.match(tanstackActivate, /Cache-Control":\s*"no-store"/);
  assert.match(tanstackActivate, /LICENSE_SIGNING_PRIVATE_KEY/);
});

test("both activation implementations use the same guard set", () => {
  // Whichever handler Nitro elects must be equally safe; a divergence here is
  // how the weak twin stayed invisible.
  for (const source of [tanstackActivate, h3Activate]) {
    assert.match(source, /activation_keys/);
    assert.match(source, /signLicenseReceipt/);
    assert.match(source, /revoked_at is null/);
    assert.doesNotMatch(source, /rejectUnauthorized:\s*false/);
  }
});

// ───────────────────── 2. no secret in a VITE_ variable ───────────────────

/** Every `src/**` module (client-reachable), recursively. */
function srcFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...srcFiles(full));
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

test("no module reads a paid credential from a browser-exposed VITE_ variable", () => {
  const root = new URL("../src", import.meta.url).pathname;
  const offenders = [];
  for (const file of srcFiles(root)) {
    const source = code(readFileSync(file, "utf8"));
    // Vite inlines every `VITE_*` value into the client bundle, so a secret
    // named that way is public. `*_PUBLIC_KEY` is the legitimate exception.
    if (/VITE_[A-Z0-9_]*(API_KEY|SECRET|PRIVATE_KEY|ACCESS_TOKEN)/.test(source)) {
      offenders.push(file);
    }
  }
  assert.deepEqual(offenders, [], `secrets in VITE_ variables: ${offenders.join(", ")}`);
});

test("the dead client-side provider client is gone", () => {
  const root = new URL("../", import.meta.url).pathname;
  assert.equal(
    existsSync(`${root}src/lib/intelligence/model/groq-client.ts`),
    false,
    "a browser-side module must never hold a provider API key",
  );
});

// ─────────────── 3. no raw upstream error reaches the caller ──────────────

test("provider diagnostics are logged, never streamed to the caller", () => {
  // `${provider} ${res.status} — ${detail}` was forwarded verbatim through the
  // SSE `error` event of the unauthenticated proxy.
  assert.doesNotMatch(code(serverAi), /throw new Error\(`\$\{provider\}/);
  assert.doesNotMatch(code(serverAi), /detail\.slice\(0, 200\)/);
  assert.match(serverAi, /console\.error\(/);
  assert.match(code(serverAi), /throw new Error\(\s*res\.status === 429/);
});

test("the AI proxy keeps its errors information-free", () => {
  // The thrown message is what a caller receives over the SSE stream, so it must
  // not name the missing env vars or otherwise describe the server config.
  assert.match(code(serverAi), /throw new Error\("Le service d'IA n'est pas configuré\."\)/);
  assert.match(aiStream, /rateLimitRequest\(request, "ai-stream", 20, 60_000\)/);
});

// ─────────────── 4. the env template matches the real config ─────────────

test("the env template documents the secrets the code actually requires", () => {
  const template = read("../.env.example");
  // RATE_LIMIT_SALT is enforced by server/lib/rate-limit.ts: without it in
  // production the limiter fails closed and BOTH licence endpoints answer 503.
  assert.match(template, /^RATE_LIMIT_SALT=/m);
  assert.match(template, /^ADMIN_PASSWORD=/m);
  assert.match(template, /^DATABASE_URL=/m);
  assert.match(template, /^LICENSE_SIGNING_PRIVATE_KEY=/m);
  // Variables this codebase never reads: an operator copying the template would
  // configure the wrong thing.
  assert.doesNotMatch(template, /JWT_SECRET/);
  assert.doesNotMatch(template, /^PORT=/m);
});
