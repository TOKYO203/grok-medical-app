#!/usr/bin/env node
/**
 * GARDE-FOU BUILD CLOUDFLARE — « les stubs ont-ils vraiment mordu ? »
 *
 * Deux modes :
 *  • Pages   (CF_PAGES, sans CF_WORKER) : cible dist/_worker.js (fichier ou
 *    répertoire) — limite plateforme 25 MiB.
 *  • Workers (CF_WORKER=true) : cible .output/server — wrangler bundle le tout
 *    en un script unique, limite 64 MiB (tous plans, depuis 2026-09-04).
 *
 * Vérifie les marqueurs des stubs, affiche taille + nombre de fichiers, et
 * échoue LOCALEMENT avec un message actionnable avant le rejet plateforme.
 */
import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";

const isCloudflare =
  process.env.CF_PAGES === "1" ||
  process.env.CF_PAGES === "true" ||
  process.env.STUB_CLOUDFLARE === "true";

if (!isCloudflare) {
  console.log("[assert-worker-stubs] build non-Cloudflare : rien à vérifier.");
  process.exit(0);
}

const isWorkerMode = process.env.CF_WORKER === "true";
const LIMIT_MIB = isWorkerMode ? 64 : 25;

if (process.env.VITE_AUTH_ENABLED === "true") {
  console.error(
    "[assert-worker-stubs] VITE_AUTH_ENABLED=true : les stubs better-auth sont INCOMPATIBLES avec l'auth active — la connexion serait cassée. Décider : stubs OU auth, pas les deux.",
  );
  process.exit(1);
}

/** Parcourt un répertoire récursivement : { files: [path], bytes }. */
async function walk(dir, base = dir) {
  const files = [];
  let bytes = 0;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = await walk(full, base);
      files.push(...sub.files);
      bytes += sub.bytes;
    } else if (entry.isFile() && (entry.name.endsWith(".mjs") || entry.name.endsWith(".js"))) {
      const content = await readFile(full, "utf8");
      files.push(full.slice(base.length + 1));
      bytes += Buffer.byteLength(content, "utf8");
    }
  }
  return { files, bytes };
}

let code = "";
let bytes = 0;
let files = [];

if (isWorkerMode) {
  try {
    const walked = await walk(".output/server");
    code = (await Promise.all(walked.files.map((f) => readFile(join(".output/server", f), "utf8")))).join("\n");
    bytes = walked.bytes;
    files = walked.files;
    console.log(`[assert-worker-stubs] mode Workers : .output/server = ${files.length} fichiers JS`);
  } catch {
    console.error("[assert-worker-stubs] .output/server introuvable — le build est-il complet ?");
    process.exit(1);
  }
} else {
  // _worker.js : fichier (mode simple) ou répertoire (mode advanced).
  const candidates = ["dist/_worker.js", "dist/_worker.js/index.mjs", "dist/_worker.js/index.js"];
  let read = null;
  for (const candidate of candidates) {
    try {
      read = { path: candidate, content: await readFile(candidate, "utf8") };
      break;
    } catch {}
  }
  if (read === null) {
    console.error("[assert-worker-stubs] dist/_worker.js introuvable — le build est-il complet ?");
    process.exit(1);
  }
  code = read.content;
  bytes = Buffer.byteLength(code, "utf8");
  try {
    const s = await stat("dist/_worker.js");
    if (s.isDirectory()) {
      const walked = await walk("dist/_worker.js");
      bytes = walked.bytes;
      files = walked.files;
      for (const f of files) {
        code += await readFile(join("dist/_worker.js", f), "utf8");
      }
      console.log(`[assert-worker-stubs] mode Pages : dist/_worker.js/ = ${files.length} fichiers JS`);
      if (files.length > 400) {
        console.warn(`[assert-worker-stubs] ⚠️ ${files.length} fichiers : le listing wrangler plateforme (3.x) plante au-delà de ~450. Migrer sur Workers (wrangler.jsonc + deploy-worker.yml).`);
      }
    }
  } catch {}
}

const mib = bytes / (1024 * 1024);
console.log(`[assert-worker-stubs] worker : ${mib.toFixed(2)} MiB (${bytes} octets, ${files.length} fichiers) — limite ${isWorkerMode ? "Workers" : "Pages"} : ${LIMIT_MIB} MiB`);

let failed = false;
const markers = [
  ["[pglite-stub]", "stub PGlite"],
  ["[pg-stub]", "stub pg"],
  ["[stub] kysely", "stub better-auth"],
];
for (const [marker, label] of markers) {
  if (!code.includes(marker)) {
    console.error(`[assert-worker-stubs] ${label} ABSENT du worker : les alias de stubs ne s'appliquent pas au bundle Nitro. Couches attendues : resolve.alias + cfStubPlugin + nitro({ alias }) dans vite.config.ts.`);
    failed = true;
  }
}
if (mib >= LIMIT_MIB) {
  console.error(`[assert-worker-stubs] worker ≥ ${LIMIT_MIB} MiB : le déploiement sera refusé. Réduire avant de déployer.`);
  failed = true;
}
process.exit(failed ? 1 : 0);
