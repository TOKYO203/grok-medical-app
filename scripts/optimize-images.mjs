#!/usr/bin/env node
/**
 * Maintenance — ré-encode les images publiques surdimensionnées.
 *
 * Les bannières de profil et illustrations arrivent souvent en pleine résolution
 * (ex. 4000×3000, > 7 Mo), ce qui coûte cher à télécharger sur réseau mobile.
 * Ce script les redimensionne et les recompresse en place, sans dépendance
 * native (jimp est en pur JS).
 *
 * Usage :
 *   node scripts/optimize-images.mjs           # rapport seul
 *   node scripts/optimize-images.mjs --write   # applique les optimisations
 *
 * `public/__grok/**` (chrome de plateforme) est volontairement ignoré.
 */
import { readdirSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";
import process from "node:process";
import { Jimp } from "jimp";

const PUBLIC_DIR = resolve(process.cwd(), "public");
const MAX_WIDTH = 1600;
const JPEG_QUALITY = 72;
const LIMIT_BYTES = 512 * 1024;
const SKIP_DIRECTORIES = new Set(["__grok"]);

const IMAGE_PATTERN = /\.(jpe?g|png)$/i;

function listImages(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRECTORIES.has(entry.name)) continue;
      files.push(...listImages(resolve(directory, entry.name)));
    } else if (entry.isFile() && IMAGE_PATTERN.test(entry.name)) {
      files.push(resolve(directory, entry.name));
    }
  }
  return files;
}

function formatKiB(bytes) {
  return `${(bytes / 1024).toFixed(0)} KiB`;
}

const write = process.argv.includes("--write");
const targets = listImages(PUBLIC_DIR).filter((file) => statSync(file).size > LIMIT_BYTES);

if (targets.length === 0) {
  console.log("[optimize-images] rien à optimiser : toutes les images sont sous la limite.");
  process.exit(0);
}

for (const file of targets) {
  const before = statSync(file).size;
  const label = relative(PUBLIC_DIR, file);
  if (!write) {
    console.log(`[rapport] ${label} — ${formatKiB(before)} (relancer avec --write)`);
    continue;
  }

  const image = await Jimp.read(file);
  if (image.width > MAX_WIDTH) {
    image.resize({ w: MAX_WIDTH });
  }
  await image.write(file, { quality: JPEG_QUALITY });
  const after = statSync(file).size;
  console.log(`[optimize-images] ${label} — ${formatKiB(before)} -> ${formatKiB(after)}`);
}
