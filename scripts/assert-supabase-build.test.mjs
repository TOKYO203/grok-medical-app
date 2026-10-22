/**
 * Garde-fou du garde-fou : `scripts/assert-supabase-build.mjs`.
 *
 * Le bug du 2026-10-22 n'était pas un bug de code mais un BUILD publié sans
 * configuration cloud. Un test qui ne lirait que les sources passerait (le
 * `import.meta.env.VITE_SUPABASE_URL` est bien écrit). On teste donc la
 * DÉCISION et la RECHERCHE sur des artefacts factices, sans lancer de build.
 */
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  CLOUD_ENV_KEYS,
  describeViolation,
  evaluateCloudBuild,
  findMissingConstants,
  parseEnvFile,
  readExpectedCloudConfig,
} from "./assert-supabase-build.mjs";

const URL_VALUE = "https://abcdefghijklmnop.supabase.co";
const KEY_VALUE = "anon-key-value";

async function fixture(files) {
  const root = await mkdtemp(join(tmpdir(), "assert-supabase-"));
  const assets = join(root, "dist", "assets");
  await mkdir(assets, { recursive: true });
  for (const [name, contents] of Object.entries(files)) {
    await writeFile(join(assets, name), contents, "utf8");
  }
  return { root, staticDirectory: join(root, "dist") };
}

test("parseEnvFile ignore commentaires, guillemets et valeurs vides", () => {
  const parsed = parseEnvFile(
    [
      "# commentaire",
      "",
      `VITE_SUPABASE_URL=${URL_VALUE}`,
      'VITE_SUPABASE_ANON_KEY="abc"',
      "VITE_SUPABASE_EMPTY=",
      "ligne sans egal",
    ].join("\n"),
  );
  assert.equal(parsed.VITE_SUPABASE_URL, URL_VALUE);
  assert.equal(parsed.VITE_SUPABASE_ANON_KEY, "abc");
  assert.equal("VITE_SUPABASE_EMPTY" in parsed, false, "une valeur vide = variable absente");
  assert.equal("ligne sans egal" in parsed, false);
});

test("la configuration attendue vient de l'environnement, puis des fichiers .env", async () => {
  const root = await mkdtemp(join(tmpdir(), "assert-supabase-env-"));
  await writeFile(
    join(root, ".env.production"),
    `VITE_SUPABASE_URL=${URL_VALUE}\nVITE_SUPABASE_ANON_KEY=${KEY_VALUE}\n`,
    "utf8",
  );

  const fromFile = readExpectedCloudConfig(root, {});
  assert.equal(fromFile.VITE_SUPABASE_URL, URL_VALUE);
  assert.equal(fromFile.VITE_SUPABASE_ANON_KEY, KEY_VALUE);

  // L'environnement du build est prioritaire (c'est ce que Vite lit en premier).
  const fromEnv = readExpectedCloudConfig(root, { VITE_SUPABASE_URL: "https://env.example" });
  assert.equal(fromEnv.VITE_SUPABASE_URL, "https://env.example");
  assert.equal(fromEnv.VITE_SUPABASE_ANON_KEY, KEY_VALUE, "les deux moitiés sont fusionnées");
});

test("les constantes réellement inlinées sont retrouvées dans le bundle", async () => {
  const { staticDirectory } = await fixture({
    "index-abc.js": `const url="${URL_VALUE}";const key="${KEY_VALUE}";`,
  });
  const expected = { VITE_SUPABASE_URL: URL_VALUE, VITE_SUPABASE_ANON_KEY: KEY_VALUE };
  assert.deepEqual(findMissingConstants(staticDirectory, expected), []);
});

test("un bundle publié sans variables est SIGNALÉ (le bug du 2026-10-22)", async () => {
  const { staticDirectory } = await fixture({
    "index-abc.js": "const o=!!(i&&a);",
    "index-abc.css": ".app{}",
  });
  const expected = { VITE_SUPABASE_URL: URL_VALUE, VITE_SUPABASE_ANON_KEY: KEY_VALUE };
  assert.deepEqual(findMissingConstants(staticDirectory, expected), [...CLOUD_ENV_KEYS]);

  const report = evaluateCloudBuild({ expected, missing: [...CLOUD_ENV_KEYS], staticDirectory });
  assert.equal(report.ok, false);
  assert.equal(report.status, "violation");
  const message = describeViolation(report);
  assert.match(message, /ABSENTE/);
  assert.match(message, /ALLOW_CLOUDLESS_BUILD=1/, "le message doit documenter l'échappatoire");
});

test("une seule moitié présente suffit à échouer (isSupabaseConfigured exige les deux)", async () => {
  const { staticDirectory } = await fixture({
    "index-abc.js": `const url="${URL_VALUE}";`,
  });
  const expected = { VITE_SUPABASE_URL: URL_VALUE, VITE_SUPABASE_ANON_KEY: KEY_VALUE };
  assert.deepEqual(findMissingConstants(staticDirectory, expected), ["VITE_SUPABASE_ANON_KEY"]);
  const report = evaluateCloudBuild({ expected, missing: ["VITE_SUPABASE_ANON_KEY"], staticDirectory });
  assert.equal(report.ok, false, "l'URL seule ne configure pas Supabase");
});

test("aucune configuration attendue = rien à vérifier (build local)", () => {
  const report = evaluateCloudBuild({ expected: {}, missing: [], staticDirectory: "dist" });
  assert.equal(report.ok, true);
  assert.equal(report.status, "cloudless");
});

test("l'échappatoire ALLOW_CLOUDLESS_BUILD est explicite et n'échoue pas", () => {
  const expected = { VITE_SUPABASE_URL: URL_VALUE, VITE_SUPABASE_ANON_KEY: KEY_VALUE };
  const report = evaluateCloudBuild({
    expected,
    missing: [...CLOUD_ENV_KEYS],
    allowCloudless: true,
    staticDirectory: "dist",
  });
  assert.equal(report.ok, true);
  assert.equal(report.status, "cloudless-allowed");
  assert.deepEqual(report.missing, [...CLOUD_ENV_KEYS], "le manque reste visible dans le rapport");
});

test("le garde-fou est branché sur les scripts de build publiés", async () => {
  const { readFile } = await import("node:fs/promises");
  const packageJson = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  );
  const scripts = packageJson.scripts;
  assert.match(scripts["postbuild:cloud"], /assert-supabase-build\.mjs/);
  for (const script of ["build", "build:netlify", "build:cloudflare"]) {
    assert.match(
      scripts[script],
      /postbuild:cloud/,
      `${script} doit exécuter le contrôle cloud : c'est la voie de publication`,
    );
  }
});
