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
  const inline = [...root.matchAll(/<script\b[^>]*>/gi)];
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

test("script-src ne porte ni hash ni nonce (sinon 'unsafe-inline' est ignoré)", () => {
  const src = readFileSync("server/middleware/security-headers.ts", "utf8");
  const fn = src.slice(src.indexOf("function scriptSrc"), src.indexOf("function scriptSrc") + 700);
  assert.match(fn, /script-src 'self' 'unsafe-inline'/, "la directive de base doit rester");
  // Incident 2026-11-27 : un hash VALIDE dans script-src désactive 'unsafe-inline'
  // et bloque les scripts d'hydratation de TanStack -> page blanche en production.
  assert.doesNotMatch(fn, /sha256-/, "aucun hash ne doit être émis dans script-src");
  assert.doesNotMatch(fn, /nonce-/, "aucun nonce partiel ne doit être émis");
  assert.doesNotMatch(src, /script-src 'self' 'unsafe-inline' '\$\{THEME_BOOT_HASH\}'/);
});

test("la politique du middleware et celle du CDN restent identiques sur script-src", () => {
  const headers = readFileSync("public/_headers", "utf8");
  assert.match(headers, /script-src 'self' 'unsafe-inline'/);
  const middleware = readFileSync("server/middleware/security-headers.ts", "utf8");
  assert.match(middleware, /'unsafe-inline'/);
});
