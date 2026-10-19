// Garde-fous du gate d'authentification Supabase et de la synchronisation cloud.
//
// Ces verrous protègent deux bugs coûteux déjà rencontrés :
//   1. l'écran « Chargement… » INFINI — causé par `<Scripts />` rendu à
//      l'intérieur d'une branche conditionnelle : le HTML SSR ne contenait alors
//      aucun script client, donc aucune hydratation ;
//   2. la perte de données à la synchronisation — la file locale était vidée
//      alors que `supabase-js` ne lève jamais d'exception (il renvoie `{ error }`).
//
// Les modules testés sont du TypeScript : Node 24 dépile les types nativement et
// un résolveur mappe l'alias `@/` vers `src/` (même approche que
// `scripts/mindmap-layout.test.mjs`).
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

const { normalizePathname, isPublicPath, resolveCloudGate, PUBLIC_PATHS } = await import(
  "../src/lib/cloud/gate.ts"
);
const { decideCloudSync, removeSyncedEvents } = await import("../src/lib/cloud/sync-policy.ts");
const { diagnoseSyncError, syncTargetLabel } = await import("../src/lib/cloud/sync-error.ts");

const read = (rel) => readFileSync(resolve(ROOT, rel), "utf8");

// ─────────────────────────── Gate d'accès ───────────────────────────────────

test("normalizePathname ignore query, hash, casse et slash final", () => {
  assert.equal(normalizePathname("/Tarifs/"), "/tarifs");
  assert.equal(normalizePathname("/bibliotheque?q=cardio"), "/bibliotheque");
  assert.equal(normalizePathname("/cas#top"), "/cas");
  assert.equal(normalizePathname("/"), "/");
  assert.equal(normalizePathname(""), "/");
  assert.equal(normalizePathname(undefined), "/");
  assert.equal(normalizePathname("profil"), "/profil");
});

test("les surfaces publiques restent publiques (achat + légal + connexion)", () => {
  for (const path of ["/tarifs", "/tarifs/", "/a-propos", "/conditions", "/confidentialite", "/login"]) {
    assert.equal(isPublicPath(path), true, `${path} devrait être publique`);
  }
  assert.ok(PUBLIC_PATHS.includes("/tarifs"), "les offres doivent rester consultables sans compte");
  assert.ok(PUBLIC_PATHS.includes("/login"));
});

test("les surfaces produit sont protégées", () => {
  for (const path of ["/", "/bibliotheque", "/cas", "/profil", "/programme", "/signes"]) {
    assert.equal(isPublicPath(path), false, `${path} ne devrait pas être publique`);
  }
  // Un préfixe ne doit pas absorber une route voisine (/tarifs-x ≠ /tarifs).
  assert.equal(isPublicPath("/tarifs-pro"), false);
});

test("aucun verrou quand Supabase n'est pas configuré", () => {
  for (const status of ["unconfigured", "loading", "anonymous", "authenticated", "unavailable"]) {
    assert.equal(
      resolveCloudGate({ configured: false, status, pathname: "/profil" }),
      "app",
      "une configuration absente ne doit jamais bloquer le produit",
    );
  }
});

test("résolution du gate : splash borné, puis connexion, puis application", () => {
  assert.equal(resolveCloudGate({ configured: true, status: "loading", pathname: "/profil" }), "splash");
  assert.equal(resolveCloudGate({ configured: true, status: "anonymous", pathname: "/profil" }), "locked");
  assert.equal(resolveCloudGate({ configured: true, status: "authenticated", pathname: "/profil" }), "app");
  // Une route publique ne clignote jamais en écran de chargement.
  assert.equal(resolveCloudGate({ configured: true, status: "loading", pathname: "/tarifs" }), "public");
  assert.equal(resolveCloudGate({ configured: true, status: "anonymous", pathname: "/tarifs" }), "public");
});

test("un cloud INJOIGNABLE ne verrouille pas l'application (hors-ligne)", () => {
  // « unavailable » = aucune réponse obtenue (chunk du SDK absent, requête
  // expirée). Verrouiller là-dessus enfermerait un utilisateur hors-ligne sur
  // l'écran de connexion, y compris pour du contenu déjà en cache.
  assert.equal(resolveCloudGate({ configured: true, status: "unavailable", pathname: "/profil" }), "app");
  assert.equal(resolveCloudGate({ configured: true, status: "unavailable", pathname: "/" }), "app");
  // La distinction avec une absence de session EXPLICITE reste nette.
  assert.equal(resolveCloudGate({ configured: true, status: "anonymous", pathname: "/" }), "locked");
});

test("un échec de chargement du SDK est retenté (jamais mémorisé)", () => {
  const client = read("src/lib/supabase.ts");
  // Un échec de `import()` mis en cache condamnerait le cloud jusqu'au prochain
  // rechargement de page, alors que la reconnexion réseau suffit.
  assert.match(client, /\.catch\(\(\) => \{[\s\S]{0,400}?pending = null;/, "l'échec doit libérer la promesse");
  assert.match(client, /return null;\s*\}\);\s*\n\s*\n\s*return pending;/, "la promesse doit être relue après réinitialisation");

  const session = read("src/lib/cloud/session.ts");
  // « unavailable » et « anonymous » ne veulent pas dire la même chose.
  assert.match(session, /\| "unavailable"/, "le statut unavailable doit exister");
  assert.match(
    session,
    /publish\(\{ status: "unavailable", session: null \}\)/,
    "une absence de réponse doit être distinguée d'une absence de session",
  );
  assert.match(session, /retryOnReconnect\(\)/, "le retour du réseau doit rejouer le démarrage");
  assert.match(session, /addEventListener\(\s*"online"/, "l'écouteur online doit exister");
});

// ─────────────────────── Politique de synchronisation ───────────────────────

test("on ne tente une sync que si cloud + réseau + session + file sont réunis", () => {
  assert.deepEqual(decideCloudSync({ configured: true, online: true, hasSession: true, queueLength: 3 }), {
    action: "sync",
  });
  assert.deepEqual(decideCloudSync({ configured: false, online: true, hasSession: true, queueLength: 3 }), {
    action: "skip",
    reason: "unconfigured",
  });
  // Hors-ligne : la file NE DOIT PAS être touchée.
  assert.deepEqual(decideCloudSync({ configured: true, online: false, hasSession: true, queueLength: 3 }), {
    action: "skip",
    reason: "offline",
  });
  assert.deepEqual(decideCloudSync({ configured: true, online: true, hasSession: false, queueLength: 3 }), {
    action: "skip",
    reason: "signed-out",
  });
  assert.deepEqual(decideCloudSync({ configured: true, online: true, hasSession: true, queueLength: 0 }), {
    action: "skip",
    reason: "empty",
  });
});

test("hors-ligne l'emporte sur l'absence de session (aucun appel réseau)", () => {
  assert.deepEqual(decideCloudSync({ configured: true, online: false, hasSession: false, queueLength: 9 }), {
    action: "skip",
    reason: "offline",
  });
});

test("seuls les événements réellement envoyés quittent la file", () => {
  const queue = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const remaining = removeSyncedEvents(queue, ["a", "b"]);
  assert.deepEqual(remaining.map((e) => e.id), ["c"]);
  // L'entrée n'est jamais mutée (Zustand doit recevoir un nouveau tableau).
  assert.deepEqual(queue.map((e) => e.id), ["a", "b", "c"]);
  // Un événement arrivé PENDANT l'envoi survit.
  assert.deepEqual(removeSyncedEvents([...queue, { id: "late" }], new Set(["a"])).map((e) => e.id), [
    "b",
    "c",
    "late",
  ]);
  assert.deepEqual(removeSyncedEvents(queue, new Set()).map((e) => e.id), ["a", "b", "c"]);
  assert.deepEqual(removeSyncedEvents(queue, new Set(["inconnu"])).map((e) => e.id), ["a", "b", "c"]);
});

// ──────────────────── Verrous de source (anti-régression) ───────────────────

test("__root.tsx rend <Scripts /> en enfant DIRECT de <body>, sans condition", () => {
  const source = read("src/routes/__root.tsx");
  const body = source.slice(source.lastIndexOf("<body>"), source.lastIndexOf("</body>"));
  assert.ok(body.length > 0, "<body> introuvable");

  const scriptTags = body.match(/<Scripts\b/g) ?? [];
  assert.equal(scriptTags.length, 1, "<Scripts /> doit apparaître exactement une fois dans <body>");

  // Enfant direct de <body> = indentation de 8 espaces. Toute imbrication dans
  // un ternaire ou un fragment conditionnel augmente l'indentation et casse
  // l'hydratation (écran figé sur le rendu SSR).
  assert.match(body, /^ {8}<Scripts \/>$/m, "<Scripts /> doit être un enfant direct de <body>");

  // Le pont de preview et le toaster ne dépendent pas d'une session.
  assert.match(body, /^ {8}<PreviewHostBridge \/>$/m);
  assert.match(body, /^ {8}<Toaster$/m);

  // Plus aucun écran « Chargement » conditionné à la session dans le document.
  assert.doesNotMatch(source, /Chargement\.\.\./);
});

test("le head conserve les métadonnées PWA/SEO (manifeste, icône, description)", () => {
  const source = read("src/routes/__root.tsx");
  for (const needle of [
    "/manifest.webmanifest",
    "/favicon.svg",
    "/__grok/icon-180.png",
    'name: "description"',
    'name: "apple-mobile-web-app-capable"',
  ]) {
    assert.ok(source.includes(needle), `head: ${needle} manquant`);
  }
});

test("le client Supabase ne lève jamais à l'import et reste HORS du chunk d'entrée", () => {
  const source = read("src/lib/supabase.ts");
  assert.match(source, /isSupabaseConfigured/);
  assert.match(source, /export function loadSupabase\(\): Promise<SupabaseClient \| null>/);
  // Chargement paresseux : un import statique du SDK entrerait dans le chunk
  // d'entrée de TOUTES les pages (+~160 Kio), y compris /tarifs et les pages
  // légales qui n'en ont aucun besoin.
  assert.match(source, /import\("@supabase\/supabase-js"\)/, "le SDK doit être importé dynamiquement");
  assert.doesNotMatch(
    source,
    /^import\s+(?!type\b)[^;]*from\s+"@supabase\/supabase-js"/m,
    "aucun import runtime statique du SDK",
  );
  assert.doesNotMatch(source, /createClient\([^)]*\|\|\s*""/, 'jamais createClient("", "")');
  // Aucun module ne doit réintroduire l'import statique.
  for (const file of ["src/lib/cloud/session.ts", "src/lib/sync-engine.ts", "src/components/AuthScreen.tsx"]) {
    assert.doesNotMatch(
      read(file),
      /^import\s+(?!type\b)[^;]*from\s+"@supabase\/supabase-js"/m,
      `${file} ne doit pas importer le SDK statiquement`,
    );
  }
});

test("la sync ne vide la file qu'après un succès complet", () => {
  const source = read("src/lib/sync-engine.ts");
  assert.match(source, /removeSyncedEvents/, "la purge doit passer par la politique testée");
  assert.doesNotMatch(source, /syncQueue:\s*\[\]/, "interdiction de vider la file en aveugle");
  // PostgREST renvoie `{ error }` : le code doit le contrôler explicitement.
  const errorChecks = source.match(/if \([a-zA-Z]*[Ee]rror\)/g) ?? [];
  assert.ok(errorChecks.length >= 2, "chaque upsert doit contrôler `error`");
  assert.match(source, /navigator\.onLine/);
  assert.match(source, /if \(activeLoop\) return activeLoop\.stop/, "boucle unique");
});

test("un seul écran de connexion : /login délègue à AuthScreen quand Supabase est configuré", () => {
  const login = read("src/routes/login.tsx");
  assert.match(login, /if \(isSupabaseConfigured\) return <AuthScreen \/>;/);
});

test("l'écran d'authentification utilise les tokens (aucune couleur en dur)", () => {
  const source = read("src/components/AuthScreen.tsx");
  assert.doesNotMatch(source, /#[0-9a-fA-F]{3,8}\b/, "pas de hex : uniquement des tokens de thème");
  assert.match(source, /data-cloud-auth="screen"/);
  assert.match(source, /autoComplete="email"/);
  assert.match(source, /autoComplete=\{isSignUp \? "new-password" : "current-password"\}/);
  assert.match(source, /role="alert"/);
});

test("une seule route serveur implémente /api/licenses/verify", () => {
  const routes = readdirSync(resolve(ROOT, "src/routes"));
  const handlers = routes.filter((file) => read(`src/routes/${file}`).includes('"/api/licenses/verify"'));
  assert.deepEqual(handlers, ["api.licenses.verify.ts"]);
  // Aucune route H3 concurrente : le handler H3 (server/api) et la route
  // TanStack doivent rester uniques, sinon le gagnant dépend de dev/build.
  const h3 = existsSync(resolve(ROOT, "server/api/licenses/verify.ts"));
  assert.equal(h3, false, "pas de second handler H3 pour /api/licenses/verify");
});

// ─────────────────── Diagnostic des erreurs de synchronisation ──────────────

test("42501 est identifié comme un problème de droits à corriger côté projet", () => {
  const diagnosis = diagnoseSyncError(
    { code: "42501", message: "permission denied for table progressions" },
    syncTargetLabel("progressions"),
  );
  assert.equal(diagnosis.kind, "permissions");
  assert.equal(diagnosis.configuration, true, "seule une action côté Supabase débloque");
  assert.match(diagnosis.message, /progression/);
  assert.match(diagnosis.message, /appareil/, "l'utilisateur doit savoir que rien n'est perdu");
});

test("une table absente est distinguée d'un problème de droits", () => {
  assert.equal(diagnoseSyncError({ code: "PGRST205", message: "Could not find the table" }).kind, "missing-table");
  assert.equal(diagnoseSyncError({ code: "42P01", message: "relation does not exist" }).kind, "missing-table");
  assert.equal(diagnoseSyncError({ code: "23505", message: "duplicate key value" }).kind, "conflict");
  assert.equal(diagnoseSyncError({ code: "PGRST116", message: "JWT expired" }).kind, "auth");
});

test("une panne réseau est annoncée comme temporaire, jamais comme une perte", () => {
  const diagnosis = diagnoseSyncError({ message: "TypeError: Failed to fetch" });
  assert.equal(diagnosis.kind, "offline");
  assert.equal(diagnosis.configuration, false);
  assert.match(diagnosis.message, /retour de la connexion/);
});

test("le diagnostic ne fuit jamais le message brut ni la requête SQL", () => {
  const diagnosis = diagnoseSyncError({
    code: "42501",
    message: "permission denied for table progressions",
    details: "GRANT SELECT ON public.progressions TO authenticated;",
    hint: "Grant the required privileges to the current role",
  });
  assert.doesNotMatch(diagnosis.message, /GRANT|public\.|42501|select |insert /i);
  assert.doesNotMatch(diagnosis.message, /authenticated/, "pas de jargon de rôle dans l'interface");
});

test("un cas inconnu reste actionnable (retentée automatiquement)", () => {
  const diagnosis = diagnoseSyncError(null);
  assert.equal(diagnosis.kind, "unknown");
  assert.match(diagnosis.message, /reten/);
});

test("la synchronisation expose un diagnostic sur TOUS les chemins d'échec", () => {
  const source = read("src/lib/sync-engine.ts");
  // `{ status: "failed"` = les sites de retour (le type déclare une forme
  // indentée différemment, donc sans accolade).
  const returns = source.match(/\{ status: "failed"|^\s+status: "failed",/gm) ?? [];
  const diagnoses = source.match(/diagnosis: diagnoseSyncError\(/g) ?? [];
  assert.ok(returns.length >= 4, `chemins d'échec couverts : ${returns.length} (session ×2, progressions, profiles)`);
  assert.equal(diagnoses.length, 2, "progressions et profiles portent un diagnostic");
  assert.match(source, /diagnosis: sessionDiagnosis\(\)/, "une session illisible est expliquée");
  // Le résultat est mémorisé pour l'interface (aucun échec muet).
  assert.match(source, /export function lastCloudSyncResult\(\)/);
});

test("le SQL de droits manquants couvre les 3 tables sans excès de privilège", () => {
  const sql = read("docs/supabase/002-grants.sql");
  for (const table of ["profiles", "progressions", "licences"]) {
    assert.ok(sql.includes(`public.${table}`), `table ${table} absente du script`);
  }
  // `delete` n'est accordé à personne, et `anon` ne reçoit aucun droit.
  assert.doesNotMatch(sql, /^\s*grant[^;]*\bdelete\b/im);
  assert.doesNotMatch(sql, /^\s*grant[^;]*\bto anon\b/im);
  // RLS est réaffirmé explicitement (sans RLS, un GRANT serait une ouverture).
  // On compte les INSTRUCTIONS, pas les occurrences du texte : la consigne
  // elle-même cite `enable row level security` dans ses commentaires, et un
  // garde-fou qui lit les commentaires finit par échouer sur sa propre
  // documentation (leçon `content-assets-cache`).
  const rlsStatements = sql.match(/^\s*alter table\s+public\.\w+\s+enable row level security;/gim) ?? [];
  assert.equal(rlsStatements.length, 3);
});

test("le SQL pose aussi les policies RLS : un GRANT sans policy ne débloque rien", () => {
  const sql = read("docs/supabase/002-grants.sql");

  // `enable row level security` SANS policy = zéro ligne lisible et toute
  // écriture refusée, avec le MÊME code 42501 qu'un GRANT manquant : l'appel
  // serait donc diagnostiqué « droits manquants » et l'utilisateur renvoyé vers
  // un script… déjà exécuté. Les deux moitiés doivent voyager ensemble.
  for (const [table, column, commands] of [
    ["profiles", "id", ["select", "insert", "update"]],
    ["progressions", "user_id", ["select", "insert", "update"]],
  ]) {
    for (const command of commands) {
      const policy = new RegExp(
        `create policy optimus_${table}_${command}_own on public\\.${table}\\s+for ${command} to authenticated`,
        "i",
      );
      assert.match(sql, policy, `policy ${command} manquante sur ${table}`);
    }
    assert.match(
      sql,
      new RegExp(`${column} = auth\\.uid\\(\\)`, "i"),
      `${table} doit filtrer sur ${column} = auth.uid()`,
    );
  }

  // Idempotence : rejouer le script ne doit pas lever « policy already exists ».
  assert.equal(
    (sql.match(/drop policy if exists/g) ?? []).length >= 6,
    true,
    "chaque policy doit être précédée d'un drop if exists (script rejouable)",
  );

  // `licences` reste en LECTURE seule, et la policy est conditionnée à
  // l'existence de `user_id` (colonne de Phase 2, pas encore garantie).
  assert.doesNotMatch(sql, /for (insert|update|delete) to authenticated\s+on public\.licences/i);
  assert.match(sql, /column_name = 'user_id'/, "la policy licences doit être conditionnée à user_id");
  assert.match(sql, /create policy optimus_licences_select_own/i);

  // Aucune policy ne doit faire confiance à une valeur envoyée par le client
  // (pas de `user_id = current_setting` ni de colonne de corps de requête).
  assert.doesNotMatch(sql, /current_setting\s*\(/i);
});
