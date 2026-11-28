/**
 * Garde-fou de versionnement du schéma.
 *
 * Toute table atteinte par `.from("<table>")` doit être créée par une migration.
 * Les trois exceptions actuelles sont documentées dans docs/SCHEMA-VERSIONING.md ;
 * elles vivent hors dépôt et doivent disparaître de ces listes le jour où leur
 * migration est écrite (le test échoue tant que l'entrée est périmée).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

/** table → raison de l'absence de migration */
const UNVERSIONED = new Map([
  ["profiles", "schéma Supabase managé hors dépôt — cf. docs/SCHEMA-VERSIONING.md"],
  ["progressions", "schéma Supabase managé hors dépôt — cf. docs/SCHEMA-VERSIONING.md"],
  ["licences", "schéma Supabase managé hors dépôt — cf. docs/SCHEMA-VERSIONING.md"],
]);

function migrationTables() {
  const tables = new Set();
  for (const dir of ["migrations"]) {
    for (const file of readdirSync(dir)) {
      if (!file.endsWith(".sql")) continue;
      const src = readFileSync(join(dir, file), "utf8");
      for (const m of src.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z_]+)/gi)) {
        tables.add(m[1].toLowerCase());
      }
    }
  }
  return tables;
}

function referencedTables() {
  const refs = new Map(); // table -> [fichiers]
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(entry) && !/\.test\./.test(entry)) {
        const src = readFileSync(full, "utf8");
        for (const m of src.matchAll(/\.from\("([a-z_]+)"\)/g)) {
          const table = m[1];
          const list = refs.get(table) ?? [];
          list.push(full.replace(/\\/g, "/"));
          refs.set(table, list);
        }
      }
    }
  };
  walk("src");
  return refs;
}

test("toute table utilisée est créée par une migration (ou déclarée hors dépôt)", () => {
  const migrated = migrationTables();
  const refs = referencedTables();
  const offenders = [];
  for (const [table, files] of refs) {
    if (migrated.has(table)) continue;
    if (UNVERSIONED.has(table)) continue;
    offenders.push(`${table} ← ${[...new Set(files)].join(", ")}`);
  }
  assert.deepEqual(offenders, [], `tables non versionnées :\n${offenders.join("\n")}`);
});

test("l'allowlist ne contient aucune table désormais versionnée", () => {
  const migrated = migrationTables();
  const stale = [...UNVERSIONED.keys()].filter((t) => migrated.has(t));
  assert.deepEqual(stale, [], `retirer de UNVERSIONED : ${stale.join(", ")}`);
});

test("chaque exception hors dépôt est justifiée par une raison écrite", () => {
  for (const [table, why] of UNVERSIONED) {
    assert.ok(why.length > 30, `${table} : justification trop courte`);
    assert.match(why, /SCHEMA-VERSIONING/, `${table} : la raison doit citer le document de référence`);
  }
});
