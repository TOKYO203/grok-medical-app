/**
 * Garde-fou CSP : l'application n'écrit qu'UN SEUL script inline (le boot de
 * thème, réputé statique et hashé). Tout nouveau script inline est une dérive
 * qui doit être décidée explicitement — voir docs/CSP-INLINE.md.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

test("un seul script inline est écrit par l'application : le boot de thème", () => {
  const root = readFileSync("src/routes/__root.tsx", "utf8");
  const inline = [...root.matchAll(/<script\b[^>]*>/g)];
  assert.equal(inline.length, 1, `scripts inline trouvés dans __root.tsx : ${inline.length}`);
  assert.match(root, /dangerouslySetInnerHTML=\{\{ __html: THEME_BOOT_SCRIPT \}\}/);
});

test("aucun autre fichier n'injecte de HTML exécutable", () => {
  const offenders = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(entry.name)) {
        const normalized = full.replace(/\\/g, "/");
        if (normalized === "src/routes/__root.tsx") continue;
        const src = readFileSync(full, "utf8");
        if (src.includes("dangerouslySetInnerHTML")) offenders.push(normalized);
      }
    }
  };
  walk("src");
  assert.deepEqual(offenders, [], `HTML injecté hors du boot de thème : ${offenders.join(", ")}`);
});

test("le hash du boot de thème est quoté dans script-src", () => {
  const src = readFileSync("server/middleware/security-headers.ts", "utf8");
  assert.match(src, /script-src 'self' 'unsafe-inline' '\$\{THEME_BOOT_HASH\}'/);
  assert.doesNotMatch(src, /script-src 'self' 'unsafe-inline' \$\{THEME_BOOT_HASH\}/);
});

test("la politique du middleware et celle du CDN restent identiques sur script-src", () => {
  const headers = readFileSync("public/_headers", "utf8");
  assert.match(headers, /script-src 'self' 'unsafe-inline'/);
  const middleware = readFileSync("server/middleware/security-headers.ts", "utf8");
  assert.match(middleware, /'unsafe-inline'/);
});
