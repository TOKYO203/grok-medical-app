#!/usr/bin/env node
/**
 * GARDE-FOU BUILD CLOUDFLARE — « les stubs ont-ils vraiment mordu ? »
 *
 * Le rejet de la limite (25 MiB) côté Cloudflare est tardif et cryptique.
 * Ce script tourne juste après `vite build`, sur les builds Cloudflare
 * uniquement (CF_PAGES ou STUB_CLOUDFLARE) : il vérifie que les marqueurs des
 * stubs sont présents dans dist/_worker.js et affiche la taille du worker.
 * Échec précoce et actionnable plutôt que "bundle size is over the limit".
 */
import { readFile, readdir, stat } from "node:fs/promises";

const isCloudflare =
  process.env.CF_PAGES === "1" ||
  process.env.CF_PAGES === "true" ||
  process.env.STUB_CLOUDFLARE === "true";

if (!isCloudflare) {
  console.log("[assert-worker-stubs] build non-Cloudflare : rien à vérifier.");
  process.exit(0);
}

if (process.env.VITE_AUTH_ENABLED === "true") {
  console.error(
    "[assert-worker-stubs] VITE_AUTH_ENABLED=true : les stubs better-auth sont INCOMPATIBLES avec l'auth active — la connexion serait cassée. Décider : stubs OU auth, pas les deux.",
  );
  process.exit(1);
}

// _worker.js : fichier (mode simple) ou répertoire (mode advanced).
const candidates = ["dist/_worker.js", "dist/_worker.js/index.mjs", "dist/_worker.js/index.js"];
let code = null;
for (const candidate of candidates) {
  try {
    code = await readFile(candidate, "utf8");
    console.log(`[assert-worker-stubs] lu : ${candidate}`);
    break;
  } catch {
    /* candidate suivant */
  }
}
if (code === null) {
  console.error("[assert-worker-stubs] dist/_worker.js introuvable — le build est-il complet ?");
  process.exit(1);
}

// Taille totale (répertoire advanced mode inclus) — même règle que Cloudflare.
let totalBytes = Buffer.byteLength(code, "utf8");
try {
  const s = await stat("dist/_worker.js");
  if (s.isDirectory()) {
    for (const entry of await readdir("dist/_worker.js")) {
      try {
        const child = await readFile(`dist/_worker.js/${entry}`, "utf8");
        totalBytes += Buffer.byteLength(child, "utf8");
        code += child;
      } catch {}
    }
  }
} catch {}
const mib = totalBytes / (1024 * 1024);
console.log(`[assert-worker-stubs] worker : ${mib.toFixed(2)} MiB (${totalBytes} octets) — limite Cloudflare : 25.00 MiB`);

let failed = false;
const markers = [
  ["[pglite-stub]", "stub PGlite"],
  ["[pg-stub]", "stub pg"],
  ["[stub] kysely", "stub better-auth"],
];
for (const [marker, label] of markers) {
  if (!code.includes(marker)) {
    console.error(
      `[assert-worker-stubs] ${label} ABSENT du worker : les alias de stubs ne s'appliquent pas au bundle Nitro. Couches attendues : resolve.alias + cfStubPlugin + nitro({ alias }) dans vite.config.ts.`,
    );
    failed = true;
  }
}
if (mib >= 25) {
  console.error("[assert-worker-stubs] worker ≥ 25 MiB : le déploiement Cloudflare sera refusé. Réduire avant de déployer.");
  failed = true;
}
process.exit(failed ? 1 : 0);
