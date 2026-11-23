#!/usr/bin/env node
// scripts/sync-content.mjs — source unique : src/content/data → public/data
import { cp, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const FILES = [
  ['src/content/data/decks.json',       'public/data/decks.json'],
  ['src/content/data/cases.json',       'public/data/cases.json'],
  ['src/content/data/diagnostics.json', 'public/data/diagnostics.json'],
];

let n = 0;
for (const [from, to] of FILES) {
  try {
    await mkdir(dirname(to), { recursive: true });
    await cp(from, to, { preserveTimestamps: false });
    console.log(`✔ ${from} → ${to}`);
    n++;
  } catch (e) {
    if (e.code === 'ENOENT') console.log(`⚠️  absent : ${from}`);
    else throw e;
  }
}
console.log(`\n✅ ${n} fichier(s) synchronisé(s)`);
