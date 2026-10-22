#!/usr/bin/env node
/**
 * Importe les photos de couverture de profil décrites dans
 * `scripts/profile-covers.manifest.json` (Wikimedia Commons) et les publie
 * dans `public/profile-covers/`.
 *
 * Chaque photo est recadrée en 1200×400 centré — exactement le traitement
 * que la page /profil applique aux couvertures personnalisées (canvas 1200×400,
 * scale max, crop centré) — puis recompresse en JPEG qualité 72, la
 * compression maison de `scripts/optimize-images.mjs` (jimp, pur JS).
 *
 * Contraintes :
 *   - chaque fichier doit être un vrai JPEG ou WebP (magic bytes) ;
 *   - chaque fichier doit rester sous PERFORMANCE_BUDGET.maxPublicAssetBytes ;
 *   - le total des actifs du shell de `public/` (hors `content/`, comme
 *     `inspectPublicAssetBudget`) doit rester sous maxTotalPublicAssetBytes ;
 *   - CREDITS.md régénère les attributions de licence (CC BY-SA).
 *
 * Déclenché par `.github/workflows/fetch-profile-covers.yml` quand le
 * manifeste ou ce script change : les octets binaires ne peuvent pas être
 * committés via l'outillage MCP (texte seul), c'est donc la CI qui les importe.
 *
 * ⚠️ Wikimedia refuse (HTTP 403) les clients sans User-Agent descriptif —
 * la politique d'accès l'exige explicitement.
 */
import { mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Jimp } from "jimp";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const COVERS_DIRECTORY = join(ROOT, "public", "profile-covers");
const PUBLIC_DIRECTORY = join(ROOT, "public");
const COVER_WIDTH = 1200;
const COVER_HEIGHT = 400;
const JPEG_QUALITY = 72;
const MAX_ASSET_BYTES = 512 * 1024;
const MAX_TOTAL_PUBLIC_BYTES = 2 * 1024 * 1024;
const USER_AGENT =
  "grok-medical-app-cover-import/1.0 (https://github.com/TOKYO203/grok-medical-app; import des couvertures de profil, licence CC BY-SA)";
// Couvertures existantes recompresseées à la volée : le rendu est identique
// (le CSS recadre déjà en bandeau), le poids mobile est divisé par ~2,7.
const LEGACY_COVERS = ["public/profile-covers/canal.jpg"];

function readManifest() {
  const manifestPath = join(ROOT, "scripts", "profile-covers.manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (!Array.isArray(manifest.covers) || manifest.covers.length === 0) {
    throw new Error("Le manifeste ne contient aucune couverture.");
  }
  return manifest;
}

function assertImage(id, bytes) {
  const isJpeg = bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isWebp =
    bytes.length > 12 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP";
  if (!isJpeg && !isWebp) {
    throw new Error(`${id} : la réponse n'est ni un JPEG ni un WebP (reçu ${bytes.length} octets).`);
  }
}

async function writeCoverBand(id, source, target) {
  const image = await Jimp.read(source);
  const scale = Math.max(COVER_WIDTH / image.width, COVER_HEIGHT / image.height);
  image.resize({
    w: Math.round(image.width * scale),
    h: Math.round(image.height * scale),
  });
  image.crop({
    x: Math.round((image.width - COVER_WIDTH) / 2),
    y: Math.round((image.height - COVER_HEIGHT) / 2),
    w: COVER_WIDTH,
    h: COVER_HEIGHT,
  });
  mkdirSync(dirname(target), { recursive: true });
  await image.write(target, { quality: JPEG_QUALITY });
  const bytes = statSync(target).size;
  if (bytes > MAX_ASSET_BYTES) {
    throw new Error(
      `${id} : ${(bytes / 1024).toFixed(1)} KiB dépassent le plafond de ${(MAX_ASSET_BYTES / 1024).toFixed(0)} KiB par actif public.`,
    );
  }
  return bytes;
}

function delay(ms) {
  return new Promise((resolveTimer) => {
    setTimeout(resolveTimer, ms);
  });
}

async function fetchCover(cover) {
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(cover.url, {
        redirect: "follow",
        headers: { "User-Agent": USER_AGENT },
      });
      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status} (type ${response.headers.get("content-type") ?? "inconnu"})`,
        );
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      assertImage(cover.id, bytes);
      mkdirSync(COVERS_DIRECTORY, { recursive: true });
      const downloaded = join(COVERS_DIRECTORY, `.source-${cover.id}.jpg`);
      writeFileSync(downloaded, bytes);
      const target = join(ROOT, cover.file);
      const finalBytes = await writeCoverBand(cover.id, downloaded, target);
      unlinkSync(downloaded);
      return { cover, target, bytes: finalBytes };
    } catch (error) {
      lastError = error;
      console.warn(`[covers] ${cover.id} : tentative ${attempt}/3 échouée — ${error.message}`);
      await delay(1500 * attempt);
    }
  }
  throw new Error(`${cover.id} : échec après 3 tentatives — ${lastError?.message ?? lastError}`);
}

function writeCredits(manifest) {
  const lines = [
    "# Crédits des photos de couverture de profil",
    "",
    "Photos issues de [Wikimedia Commons](https://commons.wikimedia.org/),",
    "importées et recadrées en 1200×400 par `scripts/fetch-profile-covers.mjs`",
    "(voir le manifeste).",
    "",
  ];
  for (const cover of manifest.covers) {
    lines.push(
      `- **${cover.title}** (\`${cover.file}\`) — ${cover.author}, ${cover.license} — [page source](${cover.source})`,
    );
  }
  lines.push("");
  writeFileSync(join(COVERS_DIRECTORY, "CREDITS.md"), lines.join("\n"));
}

// Total des actifs du shell : tout sauf `content/` (données téléchargées à la
// demande, budgétées séparément) — même règle que inspectPublicAssetBudget.
function totalShellBytes(directory, prefix = "") {
  let total = 0;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPrefix = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entryPrefix === "content") continue;
      total += totalShellBytes(absolute, entryPrefix);
    } else if (entry.isFile()) {
      total += statSync(absolute).size;
    }
  }
  return total;
}

async function main() {
  const manifest = readManifest();
  const imported = [];
  for (const cover of manifest.covers) {
    imported.push(await fetchCover(cover));
  }
  for (const legacy of LEGACY_COVERS) {
    const absolute = join(ROOT, legacy);
    const before = statSync(absolute).size;
    const after = await writeCoverBand(legacy, absolute, absolute);
    console.log(`[covers] ${legacy} recompressé : ${(before / 1024).toFixed(1)} -> ${(after / 1024).toFixed(1)} KiB`);
  }
  writeCredits(manifest);

  const totalBytes = totalShellBytes(PUBLIC_DIRECTORY);
  if (totalBytes > MAX_TOTAL_PUBLIC_BYTES) {
    throw new Error(
      `public/ pèse ${(totalBytes / 1024).toFixed(1)} KiB, plafond dépassé (${(MAX_TOTAL_PUBLIC_BYTES / 1024).toFixed(0)} KiB).`,
    );
  }

  const report = imported.map(
    (item) =>
      `- ${item.cover.file} : ${(item.bytes / 1024).toFixed(1)} KiB (${item.cover.license}, ${item.cover.author})`,
  );
  console.log(`[covers] ${imported.length} photo(s) importée(s).\n${report.join("\n")}`);
  console.log(
    `[covers] total public/ (hors content/) : ${(totalBytes / 1024).toFixed(1)} KiB / ${(MAX_TOTAL_PUBLIC_BYTES / 1024).toFixed(0)} KiB`,
  );
}

await main();
