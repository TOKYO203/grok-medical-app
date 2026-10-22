import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (p) => readFile(new URL(`../${p}`, import.meta.url), "utf8");

const [bridge, legacyBridge, model, purchaseOrders, useAppUser, middleware, verify, root] =
  await Promise.all([
    read("src/components/cloud-identity-bridge.tsx"),
    read("src/components/optimus-sync-bridge.tsx"),
    read("src/lib/optimus-sync-model.ts"),
    read("src/lib/purchase-orders.ts"),
    read("src/hooks/useAppUser.ts"),
    read("src/lib/auth/middleware.ts"),
    read("src/lib/auth/verify.server.ts"),
    read("src/routes/__root.tsx"),
  ]);

/* ───────────────────── 1. Une seule source d'identité ───────────────────── */

test("l'interface ne consulte qu'une seule source d'identité", async () => {
  /**
   * La « double authentification » venait de deux fournisseurs interrogés en
   * parallèle : Supabase et Better Auth. Ils devaient rester confinés à
   * `useAppUser`, qui choisit l'un OU l'autre — jamais les deux pages.
   */
  for (const page of ["src/routes/pro.tsx", "src/routes/achats.tsx", "src/routes/donnees.tsx"]) {
    const source = await read(page);
    assert.match(source, /useAppUser/, `${page} doit passer par useAppUser`);
    assert.doesNotMatch(
      source,
      /useCurrentUserState/,
      `${page} interroge encore Better Auth directement — c'est la double authentification`,
    );
  }
  assert.match(useAppUser, /isSupabaseConfigured/, "useAppUser doit arbitrer selon la configuration");
});

/* ────────── 2. Provisionnement serveur : le blocage trouvé par la QA ────────── */

test("le pont provisionne `optimus_user_state` pour une session Supabase", async () => {
  /**
   * RÉGRESSION MESURÉE EN QA : le tunnel lisait `optimus_user_state`, une table
   * qui n'était alimentée que par le pont Better Auth. Dès que l'identité est
   * devenue unique, ce pont a été suspendu pour les sessions Supabase — plus
   * personne ne créait la ligne, et l'achat répondait « Connectez et
   * synchronisez votre compte Optimus avant de créer une commande. »
   */
  assert.match(bridge, /pullOptimusState/, "le pont doit LIRE avant d'écrire");
  assert.match(bridge, /pushOptimusState/, "le pont doit créer la ligne serveur");
  assert.ok(
    bridge.indexOf("pullOptimusState") < bridge.indexOf("pushOptimusState"),
    "la lecture doit précéder l'écriture",
  );
  assert.match(
    bridge,
    /if \(pulled\.snapshot\) return;/,
    "un instantané existant interdit l'écriture : sinon un appareil neuf écrase la progression cloud",
  );
  assert.match(
    bridge,
    /if \(pulled\.syncSuspended\) return;/,
    "un compte en cours d'effacement ne doit jamais être ressuscité",
  );
  assert.match(bridge, /buildOptimusSnapshot/, "l'instantané doit être construit par le modèle partagé");
  // Le tunnel exige la ligne : le message doit rester une preuve de la dépendance.
  assert.match(
    purchaseOrders,
    /optimus_user_state/,
    "createPremiumPurchaseOrder lit optimus_user_state — c'est la raison du provisionnement",
  );
});

/* ────────── 3. Un seul constructeur d'instantané (pas de duplication) ────────── */

test("l'instantané synchronisable est construit à un seul endroit", async () => {
  assert.match(model, /export function buildOptimusSnapshot/, "le modèle doit exporter le constructeur");
  assert.match(
    legacyBridge,
    /buildOptimusSnapshot/,
    "le pont historique doit réutiliser le constructeur partagé",
  );
  for (const [name, source] of [
    ["optimus-sync-bridge.tsx", legacyBridge],
    ["cloud-identity-bridge.tsx", bridge],
  ]) {
    assert.doesNotMatch(
      source,
      /function buildSnapshot\s*\(/,
      `${name} redéfinit le constructeur — deux formes possibles pour un même serveur`,
    );
  }
});

/* ────────── 4. Le serveur juge le jeton par son émetteur ────────── */

test("le jeton Supabase est vérifié par son émetteur, jamais décodé localement", async () => {
  const identity = await read("src/lib/auth/supabase-identity.server.ts");
  assert.match(identity, /auth\/v1\/user/, "la vérification doit appeler l'émetteur");
  assert.match(identity, /apikey/, "la requête doit porter la clé anonyme");
  assert.doesNotMatch(
    identity,
    /SERVICE_ROLE/,
    "le serveur ne doit jamais utiliser la clé service_role pour vérifier un utilisateur",
  );
  assert.match(identity, /readJwtPayload/, "le payload sert à classer le jeton, pas à authentifier seul");
  assert.match(verify, /resolveSupabaseBearer/, "requireUserId doit passer par la résolution Supabase d'abord");
  assert.match(
    middleware,
    /bearerToken/,
    "le middleware doit transmettre le jeton de la session cloud",
  );
  // L'identité ne peut venir que de la réponse de l'émetteur.
  assert.match(identity, /sub/, "l'identité vient du `sub` renvoyé par l'émetteur");
});

test("le pont d'identité cloud est monté une seule fois, dans la racine", async () => {
  assert.match(root, /CloudIdentityBridge/, "le pont doit être monté dans __root");
  const mounts = root.match(/<CloudIdentityBridge\s*\/>/g) ?? [];
  assert.equal(mounts.length, 1, "un seul montage : deux ponts écriraient deux fois la même ligne");
});
