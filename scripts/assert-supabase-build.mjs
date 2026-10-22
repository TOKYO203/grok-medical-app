#!/usr/bin/env node
/**
 * GARDE-FOU DE BUILD — « ce déploiement sait-il où est le cloud ? »
 *
 * POURQUOI CE SCRIPT
 * Le bug du 2026-10-22 (« la connexion cloud n'est pas encore configurée sur ce
 * déploiement ») n'était pas un bug de code : un build a été PUBLIÉ sans
 * `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`. `isSupabaseConfigured` valait
 * donc `false`, l'application retombait sur l'ancien système Better Auth et
 * affichait un repli. Aucun gate ne l'a vu : `tsc`, `eslint`, les tests, le
 * budget de performance et le smoke test passent tous très bien avec un bundle
 * SANS configuration cloud — le build est simplement « muet ».
 *
 * Ce qu'on vérifie : les deux constantes publiques sont réellement INLINÉES dans
 * le bundle client. Vite remplace `import.meta.env.VITE_*` par un littéral au
 * build ; si la variable manquait, la chaîne n'existe nulle part dans les
 * fichiers publiés. Chercher la valeur attendue dans les assets est donc une
 * preuve directe, pas une supposition.
 *
 * POURQUOI CE N'EST PAS UN TEST UNITAIRE
 * Un test unitaire lit le SOURCE (`import.meta.env.VITE_SUPABASE_URL` est bien
 * écrit dans `src/lib/supabase.ts`) — il passe même quand le build n'a aucune
 * variable. La seule mesure honnête porte sur l'ARTEFACT.
 *
 * ÉCHAPPATOIRE ASSUMÉE
 * Un build volontairement « sans cloud » (QA hors-ligne, démonstration locale)
 * reste possible avec `ALLOW_CLOUDLESS_BUILD=1`, journalisé explicitement pour
 * ne jamais passer inaperçu.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { findStaticDirectory } from "./performance-budget.mjs";

/** Variables publiques (préfixe `VITE_`) qui conditionnent `isSupabaseConfigured`. */
export const CLOUD_ENV_KEYS = Object.freeze([
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
]);

const ENV_FILE_CANDIDATES = [".env.production", ".env.production.local", ".env.local", ".env"];

/**
 * Extrait des variables d'un fichier `.env`, sans dépendance.
 * Les valeurs vides sont ignorées (Vite les traite comme absentes).
 */
export function parseEnvFile(contents) {
  const values = {};
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    let value = line.slice(separator + 1).trim();
    const quoted =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"));
    if (quoted) value = value.slice(1, -1);
    if (!value) continue;
    values[key] = value;
  }
  return values;
}

/**
 * Configuration cloud ATTENDUE pour ce build.
 *
 * Priorité à l'environnement réel (c'est lui que Vite lit en premier), puis aux
 * fichiers `.env*` du mode production. `key` est renseignée pour diagnostiquer
 * quelle moitié manque.
 */
export function readExpectedCloudConfig(root = process.cwd(), environment = process.env) {
  const expected = {};
  for (const key of CLOUD_ENV_KEYS) {
    const fromEnv = environment[key]?.trim();
    if (fromEnv) expected[key] = fromEnv;
  }
  for (const file of ENV_FILE_CANDIDATES) {
    if (CLOUD_ENV_KEYS.every((key) => expected[key])) break;
    const absolute = resolve(root, file);
    if (!existsSync(absolute)) continue;
    let contents;
    try {
      contents = readFileSync(absolute, "utf8");
    } catch {
      continue;
    }
    const parsed = parseEnvFile(contents);
    for (const key of CLOUD_ENV_KEYS) {
      if (!expected[key] && parsed[key]) expected[key] = parsed[key];
    }
  }
  return expected;
}

/** Liste récursive des fichiers d'un dossier (assets hachés = un seul niveau, mais restons robustes). */
export function listFiles(directory) {
  if (!existsSync(directory) || !statSync(directory).isDirectory()) return [];
  const files = [];
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const absolute = resolve(current, entry.name);
      if (entry.isDirectory()) walk(absolute);
      else if (entry.isFile()) files.push(absolute);
    }
  };
  walk(directory);
  return files;
}

/**
 * Cherche chaque valeur attendue dans les fichiers PUBLIÉS (JS et HTML).
 *
 * On ne limite pas aux `.js` : le préambule SSR et les attributs de préchargement
 * peuvent apparaître dans un HTML. Un fichier manquant n'est pas une erreur
 * (le bundle est ce qu'il est) ; c'est la présence de la valeur qui compte.
 */
export function findMissingConstants(staticDirectory, expected) {
  const needles = CLOUD_ENV_KEYS.filter((key) => expected[key]).map((key) => ({
    key,
    value: expected[key],
  }));
  if (needles.length === 0) return [];

  const found = new Set();
  for (const absolute of listFiles(staticDirectory)) {
    if (!/\.(?:js|mjs|css|html)$/.test(absolute)) continue;
    if (found.size === needles.length) break;
    let contents;
    try {
      contents = readFileSync(absolute, "utf8");
    } catch {
      continue;
    }
    for (const needle of needles) {
      if (!found.has(needle.key) && contents.includes(needle.value)) found.add(needle.key);
    }
  }
  return needles.filter((needle) => !found.has(needle.key)).map((needle) => needle.key);
}

/**
 * Décision PURE (testable sans build) :
 *   - `configured` : configuration attendue ET présente dans l'artefact ;
 *   - `cloudless`  : aucune configuration attendue (build volontairement local) ;
 *   - `violation`  : configuration attendue MAIS absente de l'artefact publié.
 */
export function evaluateCloudBuild({ expected, missing, allowCloudless = false, staticDirectory }) {
  const expectedKeys = CLOUD_ENV_KEYS.filter((key) => expected[key]);
  if (expectedKeys.length === 0) {
    return {
      ok: true,
      status: allowCloudless ? "cloudless-allowed" : "cloudless",
      expectedKeys,
      missing: [],
      staticDirectory,
    };
  }
  if (missing.length === 0) {
    return { ok: true, status: "configured", expectedKeys, missing: [], staticDirectory };
  }
  if (allowCloudless) {
    return {
      ok: true,
      status: "cloudless-allowed",
      expectedKeys,
      missing,
      staticDirectory,
    };
  }
  return { ok: false, status: "violation", expectedKeys, missing, staticDirectory };
}

/** Une seule moitié de la configuration suffit-elle ? Non : `isSupabaseConfigured` exige les deux. */
export function describeViolation(report) {
  const missing = report.missing.join(" et ");
  return [
    `[assert-supabase-build] configuration cloud attendue mais ABSENTE du bundle publié : ${missing}.`,
    "  Conséquence en production : l'application ne trouve pas Supabase, retombe sur l'ancien",
    "  système de connexion et affiche « la connexion cloud n'est pas configurée ».",
    "  Correctif : renseigner VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY avant le build",
    "  (ces variables ont le préfixe VITE_ : elles sont PUBLIQUES par construction).",
    "  Build volontairement sans cloud : ALLOW_CLOUDLESS_BUILD=1.",
  ].join("\n");
}

function main() {
  const root = process.cwd();
  const staticDirectory = findStaticDirectory(root);
  if (!staticDirectory) {
    console.error(
      "[assert-supabase-build] aucun dossier de build trouvé (dist, .vercel/output/static, …) ; lancer le build avant ce contrôle.",
    );
    process.exitCode = 1;
    return;
  }

  const allowCloudless =
    process.env.ALLOW_CLOUDLESS_BUILD === "1" || process.env.ALLOW_CLOUDLESS_BUILD === "true";
  const expected = readExpectedCloudConfig(root);
  const missing = findMissingConstants(staticDirectory, expected);
  const report = evaluateCloudBuild({
    expected,
    missing,
    allowCloudless,
    staticDirectory: relative(root, staticDirectory) || ".",
  });

  if (!report.ok) {
    console.error(describeViolation(report));
    process.exitCode = 1;
    return;
  }

  if (report.status === "configured") {
    console.log(
      `[assert-supabase-build] ok — ${report.expectedKeys.join(" + ")} présents dans ${report.staticDirectory}.`,
    );
    return;
  }

  const detail = report.missing.length > 0 ? ` (manquant : ${report.missing.join(", ")})` : "";
  console.warn(
    allowCloudless
      ? `[assert-supabase-build] build SANS configuration cloud autorisé explicitement (ALLOW_CLOUDLESS_BUILD=1)${detail} — ne pas publier cet artefact en production.`
      : `[assert-supabase-build] build sans configuration cloud${detail} — aucune valeur à vérifier, contrôle ignoré.`,
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main();
