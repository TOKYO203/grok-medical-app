#!/usr/bin/env node
/**
 * Importe les photos de couverture de profil décrites dans
 * `scripts/profile-covers.manifest.json` (Wikimedia Commons) et les publie
 * dans `public/profile-covers/`.
 *
 * Contraintes :
 *   - chaque fichier doit être un vrai JPEG ou WebP (magic bytes) ;
 *   - chaque fichier doit rester sous PERFORMANCE_BUDGET.maxPublicAssetBytes ;
 *   - le total de `public/` doit rester sous maxTotalPublicAssetBytes ;
 *   - un fichier CREDITS.md régénère les attributions de licence (CC BY-SA).
 *
 * Déclenché par `.github/workflows/fetch-profile-covers.yml` quand le
 * manifeste change : les octets binaires ne peuvent pas être committés via
 * l'outillage MCP (texte seul), c'est donc la CI qui les importe.
 */
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const COVERS_DIRECTORY = join(ROOT, "public", "profile-covers");
const MAX_ASSET_BYTES = 512 * 1024;
const MAX_TOTAL_PUBLIC_BYTES = 2 * 1024 * 1024;

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
  const riff = bytes.toString("ascii", 0, 4) === "RIFF";
  const webp = bytes.toString("ascii", 8, 12) === "WEBP";
  const isWebp = bytes.length > 12 && riff && webp;
  if (!isJpeg && !isWebp) {
    throw new Error(`${id} : le téléchargement n'est ni un JPEG ni un WebP.`);
  }
  if (bytes.length > MAX_ASSET_BYTES) {
    throw new Error(
      `${id} : ${(bytes.length / 1024).toFixed(1)} KiB dépassent le plafond de ${(MAX_ASSET_BYTES / 1024).toFixed(0)} KiB par actif public.`,
    );
  }
}

async function fetchCover(cover) {
  const response = await fetch(cover.url, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`${cover.id} : HTTP ${response.status} pour ${cover.url}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  assertImage(cover.id, bytes);
  const target = join(ROOT, cover.file);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, bytes);
  return { cover, bytes: bytes.length };
}

function writeCredits(manifest) {
  const lines = [
    "# Crédits des photos de couverture de profil",
    "",
    "Photos issues de [Wikimedia Commons](https://commons.wikimedia.org/),",
    "importées par `scripts/fetch-profile-covers.mjs` (voir le manifeste).",
    "",
  ];
  for (const cover of manifest.covers) {
    lines.push(`- **${cover.title}** (\`${cover.file}\`) — ${cover.author}, ${cover.license} — [page source](${cover.source})`);
  }
  lines.push("");
  writeFileSync(join(COVERS_DIRECTORY, "CREDITS.md"), lines.join("\n"));
}

function totalPublicBytes(directory) {
  let total = 0;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = resolve(directory, entry.name);
    if (entry.isDirectory()) total += totalPublicBytes(absolute);
    else if (entry.isFile()) total += statSync(absolute).size;
  }
  return total;
}

async function main() {
  const manifest = readManifest();
  const imported = [];
  for (const cover of manifest.covers) {
    imported.push(await fetchCover(cover));
  }
  writeCredits(manifest);

  const totalBytes = totalPublicBytes(join(ROOT, "public"));
  if (totalBytes > MAX_TOTAL_PUBLIC_BYTES) {
    throw new Error(
      `public/ pèse ${(totalBytes / 1024).toFixed(1)} KiB, plafond dépassé (${(MAX_TOTAL_PUBLIC_BYTES / 1024).toFixed(0)} KiB). Réduire la largeur demandée dans le manifeste.`,
    );
  }

  const report = imported.map(
    (item) =>
      `- ${relative(ROOT, join(item.cover.file))} : ${(item.bytes / 1024).toFixed(1)} KiB (${item.cover.license}, ${item.cover.author})`,
  );
  console.log(`[covers] ${imported.length} photo(s) importée(s).\n${report.join("\n")}`);
  console.log(`[covers] total public/ : ${(totalBytes / 1024).toFixed(1)} KiB / ${(MAX_TOTAL_PUBLIC_BYTES / 1024).toFixed(0)} KiB`);
}

await main();
