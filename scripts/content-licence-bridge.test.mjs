// Garde-fous — PONT LICENCE SUPABASE → JWT DE CONTENU.
//
// BUG RÉEL (2026-10-20) : un client dont la licence était créée dans Supabase
// (table `public.licences`) restait bloqué sur « Activer ma licence ». Le
// contenu Premium exige un JWT de contenu de 24 h, et ce jeton ne s'obtenait
// qu'en SAISISSANT une clé sur /pro — alors que le schéma mesuré de `licences`
// ne contient AUCUNE colonne de clé.
//
// Ce test verrouille les propriétés qui rendent la correction durable :
//   1. la règle « licence active » est la même partout (client et serveur) ;
//   2. seule une clé réellement échangeable est envoyée à /api/licenses/verify
//      (un SHA-256 ou un `manual-…` ne peuvent pas produire de jeton) ;
//   3. le pont serveur vérifie le jeton d'accès AUPRÈS de Supabase, filtre sur
//      l'utilisateur vérifié et refuse de signer sans licence active ;
//   4. la session de contenu est établie au démarrage (et non à la main sur
//      /pro), et les pages qui avaient reçu un 401 se rechargent d'elles-mêmes ;
//   5. le cookie lu par le garde serveur est bien celui que le client écrit.
//
// Les modules testés sont du TypeScript : Node 24 dépile les types nativement
// et un résolveur mappe l'alias `@/` vers `src/` (même approche que
// `scripts/cloud-auth-gate.test.mjs`).
import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { registerHooks } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const SRC = pathToFileURL(resolve(ROOT, "src") + "/").href;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      const base = SRC + specifier.slice(2);
      for (const ext of ["", ".ts", ".tsx", ".js"]) {
        if (existsSync(new URL(base + ext))) return { url: base + ext, shortCircuit: true };
      }
    }
    return nextResolve(specifier, context);
  },
});

const {
  activeLicence,
  isActiveLicence,
  isVerifiableLicenceKey,
  licenceIdentity,
  licenceKeyFromRow,
  licenceExpiry,
} = await import("../src/lib/cloud/licence.ts");

const read = (rel) => readFileSync(resolve(ROOT, rel), "utf8");

// ─────────────────────── Règle « licence active » ───────────────────────────

const NOW = Date.parse("2026-10-20T12:00:00.000Z");

test("une licence révoquée ou expirée n'est jamais active", () => {
  assert.equal(isActiveLicence({ id: "a", status: "active" }, NOW), true);
  assert.equal(isActiveLicence({ id: "b", status: "revoked" }, NOW), false);
  assert.equal(isActiveLicence({ id: "c", status: "ACTIVE", expires_at: "2026-10-19T00:00:00Z" }, NOW), false);
  assert.equal(isActiveLicence({ id: "d", status: "active", expires_at: "2027-01-01T00:00:00Z" }, NOW), true);
});

test("un statut inconnu n'ouvre l'accès que sur une preuve (échéance ou activation)", () => {
  // Rien : ni statut, ni échéance, ni activation → on ne suppose pas « payé ».
  assert.equal(isActiveLicence({ id: "e" }, NOW), false);
  assert.equal(isActiveLicence({ id: "f", expires_at: "2027-01-01T00:00:00Z" }, NOW), true);
  // Licence à vie accordée à la main : activée, sans échéance.
  assert.equal(isActiveLicence({ id: "g", activated_at: "2026-01-01T00:00:00Z" }, NOW), true);
});

test("l'échéance accepte ISO 8601 et epoch (secondes comme millisecondes)", () => {
  assert.equal(licenceExpiry({ expires_at: "2026-10-20T12:00:01Z" }), Date.parse("2026-10-20T12:00:01Z"));
  assert.equal(licenceExpiry({ expires_at: 1_800_000_000 }), 1_800_000_000_000);
  assert.equal(licenceExpiry({ expiresAt: 1_800_000_000_000 }), 1_800_000_000_000);
  assert.equal(licenceExpiry({}), null);
});

test("la licence retenue est la plus favorable, jamais la première venue", () => {
  const rows = [
    { id: "revoked", status: "revoked" },
    { id: "old", status: "active", expires_at: "2026-11-01T00:00:00Z" },
    { id: "hoj", status: "active", expires_at: "2026-12-01T00:00:00Z" },
    { id: "lifetime", status: "active" },
  ];
  assert.equal(activeLicence(rows, NOW)?.id, "lifetime");
  assert.equal(activeLicence([{ id: "x", status: "expired" }], NOW), null);
  assert.equal(activeLicence([], NOW), null);
});

// ─────────────── Échangeabilité de la clé (clé vs hash) ─────────────────────

test("seules les clés échangeables partent vers /api/licenses/verify", () => {
  const payload = Buffer.from(JSON.stringify({ v: 1, licenseId: "L-1", tier: "premium" })).toString(
    "base64url",
  );
  assert.equal(isVerifiableLicenceKey(`OPT1.${payload}.${"A".repeat(64)}`), true);
  assert.equal(isVerifiableLicenceKey("OPT-1234-ABCD-5678-EF90-1234-5678"), true);

  // Ni un SHA-256, ni un identifiant « manuel », ni un UUID ne sont échangeables.
  assert.equal(isVerifiableLicenceKey("a".repeat(64)), false);
  assert.equal(isVerifiableLicenceKey("manual-123"), false);
  assert.equal(isVerifiableLicenceKey(""), false);
  assert.equal(isVerifiableLicenceKey(null), false);
});

test("la clé est lue sous plusieurs noms de colonnes, le hash compris", () => {
  assert.equal(licenceKeyFromRow({ license_key: "OPT-A" }), "OPT-A");
  assert.equal(licenceKeyFromRow({ licence_hash: "OPT1.aa.bb" }), "OPT1.aa.bb");
  assert.equal(licenceKeyFromRow({ token: "  OPT-B  " }), "OPT-B");
  assert.equal(licenceKeyFromRow({ id: "L-1" }), null);
});

test("l'identité d'une licence ne divulgue jamais la clé", () => {
  const identity = licenceIdentity({ id: "L-42", license_key: "OPT1.secret.secret" });
  assert.equal(identity, "L-42");
  assert.doesNotMatch(identity, /OPT1|secret/);
});

// ──────────────── Contrat client ↔ garde serveur (cookie) ───────────────────

test("le garde serveur lit exactement le cookie écrit par le client", async () => {
  const server = await import("../src/lib/auth/session.server.ts");
  const client = await import("../src/lib/auth/session.ts");
  assert.equal(client.SESSION_COOKIE_NAME, server.SESSION_COOKIE_NAME);
  assert.equal(client.SESSION_COOKIE_NAME, "optimus_session");

  const viaCookie = new Request("http://localhost/content/signes/_catalog.json", {
    headers: { cookie: `theme=dark; ${server.SESSION_COOKIE_NAME}=aaa.bbb.ccc` },
  });
  assert.equal(server.tokenFromRequest(viaCookie), "aaa.bbb.ccc");

  const viaBearer = new Request("http://localhost/content/signes/_catalog.json", {
    headers: { authorization: "Bearer ddd.eee.fff" },
  });
  assert.equal(server.tokenFromRequest(viaBearer), "ddd.eee.fff");

  assert.equal(server.tokenFromRequest(new Request("http://localhost/")), null);
});

// ─────────────────── Pont serveur : vérification Supabase ───────────────────

const CONFIG_KEYS = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"];

async function withSupabaseEnv(values, run) {
  const saved = Object.fromEntries(CONFIG_KEYS.map((key) => [key, process.env[key]]));
  for (const key of CONFIG_KEYS) delete process.env[key];
  Object.assign(process.env, values);
  try {
    return await run();
  } finally {
    for (const key of CONFIG_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
}

const { verifyLicenceSession, supabaseServerConfig, isValidAccessToken } = await import(
  "../src/server/licence-session.server.ts"
);

/** Faux Supabase : deux routes seulement, comme le vrai service. */
function fakeSupabase({ user = { id: "user-1" }, userStatus = 200, rows = [], rowsStatus = 200 } = {}) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url: String(url), headers: init?.headers });
    if (String(url).endsWith("/auth/v1/user")) {
      return new Response(JSON.stringify(userStatus === 200 ? user : { error: "bad_jwt" }), {
        status: userStatus,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (String(url).includes("/rest/v1/licences")) {
      return new Response(JSON.stringify(rowsStatus === 200 ? rows : { message: "denied" }), {
        status: rowsStatus,
        headers: { "Content-Type": "application/json" },
      });
    }
    throw new Error(`URL inattendue: ${url}`);
  };
  return { fetchImpl, calls };
}

test("sans configuration Supabase, le pont répond « unconfigured » (jamais 200)", async () => {
  await withSupabaseEnv({}, async () => {
    assert.equal(supabaseServerConfig(), null);
    const result = await verifyLicenceSession("x".repeat(40));
    assert.deepEqual(result, { ok: false, reason: "unconfigured" });
  });
});

test("un jeton d'accès refusé par Supabase ne signe rien", async () => {
  await withSupabaseEnv(
    { SUPABASE_URL: "https://example.supabase.co", SUPABASE_ANON_KEY: "anon-key" },
    async () => {
      assert.equal(isValidAccessToken("x".repeat(40)), true);
      assert.equal(isValidAccessToken("court"), false);

      const { fetchImpl } = fakeSupabase({ userStatus: 401 });
      const result = await verifyLicenceSession("x".repeat(40), { fetchImpl, now: () => NOW });
      assert.deepEqual(result, { ok: false, reason: "invalid" });
    },
  );
});

test("le pont ne signe que pour une licence ACTIVE de l'utilisateur vérifié", async () => {
  await withSupabaseEnv(
    { SUPABASE_URL: "https://example.supabase.co", SUPABASE_ANON_KEY: "anon-key" },
    async () => {
      const revoked = fakeSupabase({ rows: [{ id: "L-1", status: "revoked" }] });
      assert.deepEqual(
        await verifyLicenceSession("x".repeat(40), { fetchImpl: revoked.fetchImpl, now: () => NOW }),
        { ok: false, reason: "no-licence" },
      );

      const ok = fakeSupabase({
        rows: [{ id: "L-2", status: "active", plan: "premium", expires_at: "2027-01-01T00:00:00Z" }],
      });
      const result = await verifyLicenceSession("x".repeat(40), {
        fetchImpl: ok.fetchImpl,
        now: () => NOW,
      });
      assert.equal(result.ok, true);
      assert.equal(result.licenceId, "supabase:L-2");
      assert.equal(result.userId, "user-1");

      // Le filtre est EXPLICITE : RLS reste la première barrière, mais si elle
      // était mal configurée on ne doit jamais lire la licence d'un autre.
      const licencesCall = ok.calls.find((call) => call.url.includes("/rest/v1/licences"));
      assert.match(licencesCall.url, /user_id=eq\.user-1/);
      // Et la clé publique anonyme, jamais un secret service_role.
      assert.equal(licencesCall.headers.apikey, "anon-key");
      assert.equal(licencesCall.headers.authorization, `Bearer ${"x".repeat(40)}`);
    },
  );
});

test("une lecture impossible (droits manquants, panne) ferme l'accès en 503", async () => {
  await withSupabaseEnv(
    { SUPABASE_URL: "https://example.supabase.co", SUPABASE_ANON_KEY: "anon-key" },
    async () => {
      const denied = fakeSupabase({ rowsStatus: 403 });
      assert.deepEqual(
        await verifyLicenceSession("x".repeat(40), { fetchImpl: denied.fetchImpl, now: () => NOW }),
        { ok: false, reason: "unreachable" },
      );

      const offline = async () => {
        throw new TypeError("Failed to fetch");
      };
      assert.deepEqual(
        await verifyLicenceSession("x".repeat(40), { fetchImpl: offline, now: () => NOW }),
        { ok: false, reason: "unreachable" },
      );
    },
  );
});

// ───────────────────────── Câblage applicatif ──────────────────────────────

test("une seule route serveur émet la session de contenu", () => {
  const routes = readdirSync(resolve(ROOT, "src/routes"));
  const handlers = routes.filter((file) =>
    read(`src/routes/${file}`).includes('"/api/licenses/session"'),
  );
  assert.deepEqual(handlers, ["api.licenses.session.ts"]);

  const route = read("src/routes/api.licenses.session.ts");
  assert.match(route, /verifyLicenceSession\(accessToken\)/, "le jeton d'accès doit être vérifié");
  assert.match(route, /signContentToken\(licence\.licenceId\)/, "signature serveur uniquement");
  assert.match(route, /rateLimitRequest\(/, "quota obligatoire");
  assert.match(route, /"Cache-Control": "no-store"/, "un jeton ne se met jamais en cache");
  assert.doesNotMatch(route, /console\.log/, "aucune trace du jeton dans les journaux");
  assert.doesNotMatch(route, /service_role/i, "la clé service_role n'a rien à faire ici");
});

test("le pont est monté au démarrage, pas seulement sur /pro", () => {
  const root = read("src/routes/__root.tsx");
  assert.match(root, /import \{ ContentSessionBridge \} from "@\/components\/content-session-bridge"/);
  assert.match(root, /<ContentSessionBridge \/>/);
  // Dans le shell applicatif : couvre un lien direct vers /signes ou /pathologie.
  assert.match(root, /<LicenseRevocationBridge \/>\s*[\s\S]{0,400}<ContentSessionBridge \/>/);
});

test("les surfaces verrouillées se débloquent sans clic", () => {
  const signes = read("src/routes/signes.tsx");
  assert.match(signes, /awaitContentSessionIfLikely\(\)/);
  assert.match(signes, /subscribeContentSession/);
  assert.match(
    signes,
    /\}, \[contentSession\.generation\]\);/,
    "un nouveau jeton doit relancer le chargement",
  );

  const pathologie = read("src/routes/pathologie.$slug.tsx");
  assert.match(pathologie, /ensureContentSession\(\)/);
  assert.match(pathologie, /router\.invalidate\(\)/);
  assert.match(pathologie, /if \(getToken\(\)\) return;/, "pas de boucle si un jeton existe déjà");
});

test("une lecture client impossible ne remplace pas la décision du serveur", () => {
  const contentSession = read("src/lib/cloud/content-session.ts");
  // Régression mesurée en QA : `query-failed` renvoyé juste après la lecture
  // client faisait sortir AVANT l'appel au pont serveur — le seul chemin qui
  // débloque une licence sans clé. Le client est une optimisation, pas un juge.
  assert.doesNotMatch(contentSession, /markNone\("query-failed"\)/);
  // La lecture client est bien conditionnée (donc contournable), et l'appel au
  // pont serveur vient APRÈS ce bloc, jamais dedans.
  assert.match(contentSession, /if \(Array\.isArray\(rows\)\) \{/);
  const serverCallIndex = contentSession.indexOf("requestSessionToken(accessToken)");
  const clientBlockIndex = contentSession.indexOf("if (Array.isArray(rows)) {");
  assert.ok(clientBlockIndex > 0 && serverCallIndex > clientBlockIndex, "le pont serveur doit rester atteignable");
});

test("un refus serveur 403 pose aussi le mémo négatif", () => {
  const contentSession = read("src/lib/cloud/content-session.ts");
  // Sans cela, un compte SANS licence (le cas le plus fréquent) referait un
  // aller-retour serveur à chaque montage de page.
  const block = contentSession.slice(contentSession.indexOf('if (granted.status === 403)'));
  assert.match(block.slice(0, 400), /writeMemo\(subject\)/);
});

test("le pont n'est pas un chemin dérobé : aucun contenu servi sans licence", () => {
  const contentSession = read("src/lib/cloud/content-session.ts");
  // Le jeton n'est posé QUE sur une réponse serveur de succès.
  assert.match(contentSession, /if \(!response\.ok \|\| typeof payload\.token !== "string"\)/);
  // Aucune clé de licence journalisée.
  assert.doesNotMatch(contentSession, /console\.(log|warn|error)\([^)]*key/);
});

test("/pro ne contient plus de texte commercial codé en dur sur Mobile Money", () => {
  const pro = read("src/routes/pro.tsx");
  assert.doesNotMatch(pro, /Mobile Money/);
  assert.match(pro, /data-pro-pricing-link/);
  assert.match(pro, /to="\/tarifs"/);
});
