/**
 * Garde-fous d'hygiène des secrets.
 *
 * Incident du 2026-10-17 : une page de debug temporaire
 * (`src/routes/admin-debug.tsx`, commit a87d8d4) contenait le mot de passe du
 * back-office en clair dans un bouton « Simuler login ». Le fichier a été
 * supprimé trois minutes plus tard, mais il restait lisible dans l'historique
 * public et GitGuardian a ouvert une alerte. Deux leçons en sont tirées ici :
 *
 *   1. une valeur secrète ne doit JAMAIS être écrite dans `src/` — pas même
 *      « temporairement », pas même en dur dans un bouton de simulation ;
 *      un tel bouton lit `process.env`/une saisie, jamais un littéral ;
 *   2. un fichier d'environnement ne doit jamais entrer dans l'index git —
 *      `.gitignore` doit couvrir `.env*`, et aucun `.env` ne doit être suivi.
 *
 * Le scan historique lui-même est fait par gitleaks (`.gitleaks.toml`,
 * job `secret-scan` du workflow Security) ; ces tests verrouillent les règles
 * qui ne dépendent pas d'un binaire externe.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

const tracked = execFileSync("git", ["ls-files"], { encoding: "utf8" })
  .split("\n")
  .filter(Boolean);

// ─────────────────── 1. aucun fichier d'environnement suivi ──────────────────

/**
 * EXCEPTION ASSUMÉE EN V1 — `.env.production` est suivi volontairement.
 *
 * Il ne contient que des valeurs `VITE_*` PUBLIQUES par design : l'URL du projet
 * Supabase, sa clé `anon` (déjà inlinée dans le bundle client, donc publique) et
 * les identifiants de la variante Lemon Squeezy. Aucune n'est un secret serveur.
 *
 * POURQUOI IL EST SUIVI : les variables d'environnement Cloudflare Pages ne sont
 * pas poussées dans l'environnement Vite par `scripts/with-app-env.mjs`, donc
 * `.env.production` est le seul moyen FIABLE de compiler un déploiement avec la
 * configuration cloud. À remplacer en V1.1 par une injection au build
 * (cf. `docs/DECISIONS.md`, AUTH-5).
 *
 * GARDE-FOU : un fichier `.env` suivi reste interdit SAUF ceux listés ici, et
 * chacun doit passer le test suivant — toute variable NON préfixée `VITE_` y
 * serait un secret serveur publié, et fait échouer la suite.
 */
const TRACKED_ENV_ALLOWLIST = new Set([".env.production"]);

test("no .env file is ever tracked by git", () => {
  const offenders = tracked.filter(
    (f) =>
      /(^|\/)\.env(\.|$)/.test(f) && !f.endsWith(".example") && !TRACKED_ENV_ALLOWLIST.has(f),
  );
  assert.deepEqual(offenders, [], "un fichier .env est suivi par git — retirer de l'index et purger l'historique");
});

test("un .env suivi ne contient que des variables VITE_* (publiques par construction)", () => {
  for (const file of TRACKED_ENV_ALLOWLIST) {
    assert.ok(tracked.includes(file), `${file} est allowlisté mais absent de git — mettre à jour la liste`);
    const content = read(`../${file}`);
    const assignments = content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"));
    assert.ok(assignments.length > 0, `${file} ne contient aucune variable`);
    for (const line of assignments) {
      const name = line.slice(0, line.indexOf("=")).trim();
      /**
       * `VITE_` est la seule garantie acceptable : ces variables finissent DANS
       * le bundle navigateur. Un secret n'a donc rien à y faire — et inversement,
       * tout ce qui n'est pas `VITE_` dans un fichier publié est un secret
       * serveur exposé.
       */
      assert.match(
        name,
        /^VITE_[A-Z0-9_]+$/,
        `${file} : « ${name} » n'est pas préfixée VITE_ — un fichier suivi ne doit contenir que des valeurs publiques`,
      );
    }
  }
});

/**
 * CONTRÔLE COMPAGNON DE L'EXCEPTION GITLEAKS (`jwt` sur la clé `anon`).
 *
 * `.gitleaks.toml` exempte la ligne `VITE_SUPABASE_ANON_KEY=…` parce que cette
 * clé est PUBLIQUE par conception. Une exception de scanner n'est acceptable que
 * si ce qu'elle laisse passer est *démontrablement* inoffensif : ce test le
 * démontre à chaque exécution, au lieu de le supposer.
 *
 * Trois propriétés vérifiées, et pourquoi chacune compte :
 *
 *   1. `role === "anon"` — une clé `service_role` contourne TOUTES les policies
 *      RLS. Si l'une d'elles atterrissait ici (copier-coller depuis le tableau de
 *      bord Supabase : c'est l'erreur la plus facile à commettre), elle serait
 *      publiée dans le bundle navigateur, donc pour n'importe qui. L'exception
 *      gitleaks la masquerait : c'est ce test qui la démasque.
 *   2. `ref` = projet de `VITE_SUPABASE_URL` — empêche qu'une clé d'un AUTRE
 *      projet (bac à sable, production) s'immisce dans le fichier suivi.
 *   3. signature présente (`xxxxx.yyyyy.zzzzz`) — une clé tronquée ou un
 *      gabarit « changez-moi » ferait échouer l'authentification en production
 *      sans que rien ne le signale avant déploiement.
 */
test("la clé Supabase suivie est publique ET non privilégiée (justifie l'exception gitleaks)", () => {
  const file = ".env.production";
  const values = new Map();
  for (const line of read(`../${file}`).split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator <= 0) continue;
    values.set(
      trimmed.slice(0, separator).trim(),
      trimmed
        .slice(separator + 1)
        .trim()
        .replace(/^["']|["']$/g, ""),
    );
  }

  const url = values.get("VITE_SUPABASE_URL");
  const key = values.get("VITE_SUPABASE_ANON_KEY");
  assert.ok(url, `${file} doit déclarer VITE_SUPABASE_URL`);
  assert.ok(key, `${file} doit déclarer VITE_SUPABASE_ANON_KEY`);

  const parts = key.split(".");
  assert.equal(parts.length, 3, "la clé doit être un JWT complet (en-tête.payload.signature)");
  assert.ok(parts[2].length >= 16, "la signature du JWT est absente ou tronquée");

  let claims;
  try {
    claims = JSON.parse(Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
  } catch {
    assert.fail("le payload de la clé n'est pas un JSON décodable — clé corrompue");
  }

  assert.notEqual(
    claims.role,
    "service_role",
    "DANGER : une clé service_role est publiée dans le bundle navigateur — elle contourne toutes les policies RLS. " +
      "Utiliser la clé `anon` côté client ; la clé privilégiée ne doit exister que dans l'environnement serveur.",
  );
  assert.equal(claims.role, "anon", `rôle inattendu « ${claims.role} » : une clé client doit être « anon »`);

  const projectRef = new URL(url).hostname.split(".")[0];
  assert.equal(
    claims.ref,
    projectRef,
    `la clé vient d'un autre projet Supabase (« ${claims.ref} » vs « ${projectRef} ») — vérifier les variables du déploiement`,
  );
});

test(".gitignore ignores every .env flavour and the temp work dirs", () => {
  const ignore = read("../.gitignore");
  assert.match(ignore, /^\.env\*$/m, ".env* doit être ignoré (couvre .env, .env.local, .env.*.local)");
  for (const dir of [".qa-tmp/", ".calc-tmp/", ".audit-tmp/", ".bak/"]) {
    assert.ok(ignore.includes(dir), `${dir} doit être ignoré : ces dossiers contiennent des secrets de travail`);
  }
});

// ───────────── 2. aucun littéral de mot de passe dans le code source ────────

/** Motifs qui trahissent une valeur secrète écrite en dur dans `src/`. */
const HARDCODED_SECRET = [
  // setAdminKey("…"), adminKey: "…", password = "…" — littéral entre guillemets.
  /\b(?:setAdminKey|adminKey|admin_key|adminPassword)\s*[:=(]\s*["'`][^"'`\s]{6,}["'`]/,
  // Un mot de passe assigné en clair dans un composant ou une route.
  /\b(?:password|passwd|motDePasse)\s*[:=]\s*["'`][^"'`\s]{8,}["'`]/,
];

test("src/ never contains a hardcoded admin password or key literal", async () => {
  const { readdirSync } = await import("node:fs");
  const offenders = [];
  const walk = (dir) => {
    for (const entry of readdirSync(new URL(dir, import.meta.url), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        walk(rel);
        continue;
      }
      if (!/\.(ts|tsx|js|jsx|mjs)$/.test(entry.name)) continue;
      const source = read(rel)
        // Les commentaires décrivent le problème (« le mot de passe en clair »),
        // ils ne le contiennent pas.
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      for (const pattern of HARDCODED_SECRET) {
        const match = source.match(pattern);
        if (match) offenders.push(`${rel.replace("../", "")} → ${match[0].slice(0, 60)}`);
      }
    }
  };
  walk("../src");
  assert.deepEqual(offenders, [], "valeur secrète écrite en dur dans src/ — lire l'environnement serveur à la place");
});

test("the temporary debug route stays deleted", () => {
  assert.equal(
    existsSync(new URL("../src/routes/admin-debug.tsx", import.meta.url)),
    false,
    "admin-debug.tsx contenait le mot de passe admin en clair : ne jamais le recréer",
  );
});

// ─────────────── 3. l'admin ne s'authentifie que côté serveur ────────────────

test("the admin password is compared only from server-side environment", () => {
  const guard = read("../src/lib/security/admin-auth.server.ts");
  assert.match(guard, /process\.env\.ADMIN_PASSWORD/, "le mot de passe admin doit venir de l'environnement serveur");
  assert.match(guard, /timingSafeEqual/, "la comparaison doit rester à temps constant");
  // Aucune trace du secret dans un module client (`VITE_` = inliné dans le bundle).
  assert.doesNotMatch(guard, /VITE_ADMIN|import\.meta\.env/, "jamais de préfixe VITE_ pour un secret serveur");
});

test("gitleaks config extends the default ruleset and justifies every exception", () => {
  const config = read("../.gitleaks.toml");
  assert.match(config, /\[extend\]\s*\nuseDefault = true/, "les règles par défaut de gitleaks doivent être actives");
  const allowlists = config.match(/\[\[allowlists\]\][\s\S]*?(?=\[\[allowlists\]\]|$)/g) ?? [];
  assert.ok(allowlists.length > 0, "au moins une exception documentée est attendue");
  for (const block of allowlists) {
    assert.match(block, /description = "[^"]{10,}"/, "chaque exception doit porter une justification écrite");
  }
  // Le fichier qui a fuité ne doit jamais être ré-allowlisté.
  assert.doesNotMatch(config, /admin-debug/, "admin-debug.tsx ne doit pas être exempté du scan");
});
