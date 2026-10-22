import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * GARDE-FOU — « ce déploiement sait-il encaisser ? »
 *
 * Incident du 2026-10-22 : le bouton « Payer par Carte » répondait 503 en
 * production. Rien n'était cassé au sens de `tsc`/`eslint`/tests/budget : le
 * serveur lisait `process.env` alors que les valeurs n'existaient qu'en tant que
 * `import.meta.env` INLINÉ au build. Ces tests figent les trois choses qui ont
 * rendu l'incident invisible :
 *
 *   1. la résolution d'environnement est PARTAGÉE (aucun module serveur ne peut
 *      réimplémenter un `process.env.SUPABASE_URL ?? …` local) ;
 *   2. le déploiement peut être interrogé (`/api/health/checkout`) sans exposer
 *      une seule valeur sensible ;
 *   3. le client ne renvoie plus vers `/login` sur une session INCERTAINE, et
 *      n'accuse plus la connexion de l'utilisateur d'une panne serveur.
 */

const ROOT = resolve(import.meta.dirname, "..");
const read = (relative) => readFileSync(resolve(ROOT, relative), "utf8");

test("la configuration Supabase n'est résolue qu'à un seul endroit", () => {
  const helper = read("src/server/supabase-env.server.ts");
  assert.match(helper, /export function mergedServerEnv/);
  assert.match(helper, /import\.meta as ImportMeta & \{ env\?: EnvLike \}/);
  assert.match(helper, /process\.env as EnvLike/);

  const session = read("src/server/licence-session.server.ts");
  assert.match(session, /readServerSupabaseConfig\(mergedServerEnv\(env\)\)/);
  // Le repli local historique ne doit pas revenir : c'est lui qui rendait le
  // worker aveugle aux valeurs inlinées.
  assert.ok(
    !/env\.SUPABASE_URL \?\? env\.VITE_SUPABASE_URL/.test(session),
    "chaîne de repli locale réintroduite dans licence-session.server.ts",
  );

  const delivery = read("src/server/lemonsqueezy/delivery.ts");
  assert.match(delivery, /resolveSupabaseServiceKey\(merged\)/);
  assert.ok(
    !/env\.SUPABASE_URL \?\? env\.VITE_SUPABASE_URL/.test(delivery),
    "chaîne de repli locale réintroduite dans delivery.ts",
  );

  const identity = read("src/lib/auth/supabase-identity.server.ts");
  assert.match(identity, /mergedServerEnv\(\)/);
});

test("l'endpoint de santé du déploiement n'expose AUCUNE valeur", () => {
  const route = read("src/routes/api.health.checkout.ts");

  // Uniquement des booléens (identité, clé de service) et une source de base.
  assert.match(route, /identity: Boolean\(supabase\)/);
  assert.match(route, /serviceKey: Boolean\(serviceKey\)/);
  assert.match(route, /source: dbSource/);

  // Aucune valeur : ni objet de configuration sérialisé, ni spread, ni URL.
  assert.ok(!route.includes("json(supabase"), "la config Supabase est renvoyée telle quelle");
  assert.ok(!route.includes("...supabase"), "la config Supabase est étalée dans la réponse");
  assert.ok(!/url:\s*(supabase|env)/.test(route), "une URL est renvoyée par l'endpoint");
  assert.ok(!route.includes("console.log"), "l'endpoint journalise au lieu de répondre");

  // Jamais mis en cache : un CDN figerait un « ready: true » périmé.
  assert.match(route, /cache-control": "no-store"/);
  assert.match(route, /x-robots-tag/);
});

test("l'endpoint de santé distingue PGLite d'une base Postgres injoignable", () => {
  const route = read("src/routes/api.health.checkout.ts");
  // C'est LA distinction qui manquait : sans elle, « pas de DATABASE_URL » et
  // « base en panne » produisent le même 503 côté navigateur.
  assert.match(route, /if \(dbSource !== "postgres"\) return \{ reachable: null, reason: "embedded-pglite" \}/);
  assert.match(route, /select 1 as ok/);
  assert.match(route, /DB_PROBE_TIMEOUT_MS/);
});

test("le 503 du tunnel carte dit POURQUOI il échoue", () => {
  const route = read("src/routes/api.checkout.lemonsqueezy.ts");
  assert.match(route, /"identity_unconfigured"/);
  assert.match(route, /"identity_unreachable"/);
  assert.ok(
    (route.match(/reason: "database"/g) ?? []).length >= 2,
    "les échecs de base doivent aussi porter une raison",
  );
  // Un jeton refusé reste un 401 : on n'accuse pas la configuration pour un
  // client qui présente un mauvais jeton.
  assert.match(route, /identity\.reason === "invalid"\) return json\(\{ error: "unauthorized" \}, 401\)/);
});

test("/tarifs ne redirige plus vers /login sur une session incertaine", () => {
  const page = read("src/routes/tarifs.tsx");
  assert.match(page, /decideCardAuthGate\(authStatus, Boolean\(session\?\.access_token\)\)/);
  // La forme fautive (toute absence de session ⇒ /login) ne doit pas revenir.
  assert.ok(
    !page.includes("if (!session?.user)"),
    "redirection inconditionnelle vers /login réintroduite",
  );
  // Le code d'échec doit rester lisible en QA (sans DevTools).
  assert.match(page, /data-lemon-error-code/);
});

test("un seul message peut parler de connexion : celui d'une vraie panne réseau", () => {
  // On compare du CODE, pas de la documentation : un commentaire qui cite la
  // formule fautive ne doit pas faire échouer le test (même leçon que
  // `content-assets-cache` : un garde-fou doit parser, pas lire en brut).
  const code = read("src/lib/checkout/messages.ts")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

  const blame = [
    /v[ée]rifiez votre connexion/gi,
    /v[ée]rifiez votre r[ée]seau/gi,
    /connexion (?:internet )?instable/gi,
  ];
  const hits = blame.flatMap((re) => code.match(re) ?? []);

  // `status === null` = la requête n'a JAMAIS joint le serveur : là, et là
  // seulement, parler de connexion est exact. Toute autre occurrence signifie
  // qu'on renvoie l'utilisateur chercher une panne serveur chez lui.
  assert.equal(hits.length, 1, `formulations accusatrices : ${hits.join(" | ")}`);
  assert.match(code, /if \(status === null\)[\s\S]{0,200}v[ée]rifiez votre connexion/i);

  // Le contraire est exigé : dire que rien n'a été débité quand c'est vrai.
  assert.match(code, /Aucun montant n'a été débité|rien n'a été débité/);
});

test("l'audit d'encaissement sait interroger un DÉPLOIEMENT", () => {
  const script = read("scripts/payment-readiness.mjs");
  assert.match(script, /--host/);
  assert.match(script, /\/api\/health\/checkout/);
  assert.match(script, /remote:db-source/);
  assert.match(script, /remote:ready/);
});
