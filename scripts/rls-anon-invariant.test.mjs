/**
 * Invariant RLS : toute table atteinte avec le client Supabase ANONYME doit être
 * déclarée ici, avec sa justification. Voir docs/RLS-AUDIT.md.
 *
 * Le but n'est pas d'interdire — trois tables vivent hors dépôt — mais de rendre
 * chaque nouvelle accessibilité anonyme visible en revue et bloquante en CI.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const ANON_CLIENT = "@/lib/supabase";

/** table -> [fichier, justification] */
const ALLOWLIST = new Map([
  ["profiles", ["src/lib/sync-engine.ts", "table Supabase managée hors migrations — RLS à vérifier (docs/RLS-AUDIT.md)"]],
  ["progressions", ["src/lib/sync-engine.ts", "table Supabase managée hors migrations — RLS à vérifier (docs/RLS-AUDIT.md)"]],
  ["licences", ["src/lib/cloud/content-session.ts", "lecture défensive : échoue sans GRANT/RLS, voir note l.373"]],
]);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry) && !/\.test\./.test(entry)) out.push(full);
  }
  return out;
}

test("aucune table inconnue n'est lue avec la clé anonyme Supabase", () => {
  const offenders = [];
  for (const file of walk("src")) {
    const src = readFileSync(file, "utf8");
    if (!src.includes(ANON_CLIENT)) continue;
    for (const m of src.matchAll(/\.from\("([a-z_]+)"\)/g)) {
      const table = m[1];
      const allowed = ALLOWLIST.get(table);
      if (!allowed) {
        offenders.push(`${file} → ${table} (table non déclarée)`);
        continue;
      }
      if (!file.replace(/\\/g, "/").endsWith(allowed[0])) {
        offenders.push(`${file} → ${table} (fichier non déclaré, attendu ${allowed[0]})`);
      }
    }
  }
  assert.deepEqual(offenders, [], `accès anonyme non documenté :\n${offenders.join("\n")}`);
});

test("chaque table de l'allowlist est justifiée", () => {
  for (const [table, [file, why]] of ALLOWLIST) {
    assert.ok(file.endsWith(".ts") || file.endsWith(".tsx"), `${table} : fichier attendu`);
    assert.ok(why.length > 20, `${table} : justification trop courte`);
  }
});
