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

test("no .env file is ever tracked by git", () => {
  const offenders = tracked.filter((f) => /(^|\/)\.env(\.|$)/.test(f) && !f.endsWith(".example"));
  assert.deepEqual(offenders, [], "un fichier .env est suivi par git — retirer de l'index et purger l'historique");
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
