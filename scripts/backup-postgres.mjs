#!/usr/bin/env node
/**
 * Sauvegarde chiffrée des bases de production.
 *
 * Deux cibles, conformes aux deux projets Supabase décrits dans
 * `docs/V1-READINESS.md` (§ P0-6) :
 *   • `DATABASE_URL`        → base applicative (comptes Better Auth, commandes,
 *                             signalements, journal webhook) ;
 *   • `SUPABASE_DB_URL`     → projet Supabase client (profils, licences).
 *
 * Aucun DSN n'est jamais journalisé : seule l'étiquette et l'hôte apparaissent.
 * Le dump est chiffré à la volée (`pg_dump | openssl enc`), il n'existe donc
 * jamais de copie en clair sur le disque du runner.
 *
 * Usage :
 *   node scripts/backup-postgres.mjs plan              # diagnostic, sans secret
 *   node scripts/backup-postgres.mjs backup --out backups
 *
 * Codes de sortie : 0 succès · 2 configuration incomplète · 1 échec technique.
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { pathToFileURL } from "node:url";

/** Cibles attendues, dans l'ordre de sauvegarde. */
export const BACKUP_TARGETS = [
  {
    label: "app",
    env: "DATABASE_URL",
    purpose: "base applicative (comptes, licences, commandes, webhooks)",
  },
  {
    label: "supabase-client",
    env: "SUPABASE_DB_URL",
    purpose: "projet Supabase client (profils, licences)",
  },
];

/**
 * Résout les cibles configurées depuis un environnement.
 * Une cible absente n'est pas une erreur *si* au moins une est présente : elle
 * est signalée et la sauvegarde partielle reste explicite dans le manifeste.
 *
 * @param {Record<string, string | undefined>} env
 */
export function parseTargets(env = process.env) {
  const configured = [];
  const missing = [];
  for (const target of BACKUP_TARGETS) {
    const url = (env[target.env] ?? "").trim();
    if (url) configured.push({ ...target, url });
    else missing.push({ label: target.label, env: target.env, purpose: target.purpose });
  }
  if (configured.length === 0) {
    throw new Error(
      `Aucune cible configurée — renseigner ${BACKUP_TARGETS.map((t) => t.env).join(" ou ")}.`,
    );
  }
  return { configured, missing };
}

/**
 * Version journalisable d'un DSN : protocole, utilisateur, hôte, base.
 * Le mot de passe n'est jamais renvoyé, même tronqué.
 *
 * @param {string} dsn
 */
export function redactDsn(dsn) {
  const raw = (dsn ?? "").trim();
  if (!raw) return "(vide)";
  try {
    const url = new URL(raw);
    const user = url.username ? `${decodeURIComponent(url.username)}@` : "";
    const db = url.pathname.replace(/^\//, "") || "(base inconnue)";
    return `postgres://${user}${url.hostname}:${url.port || "5432"}/${db}`;
  } catch {
    // Un DSN en `postgresql://` reste parsable par URL ; si ce n'est pas le cas,
    // on ne tente pas de deviner et on ne renvoie rien de sensible.
    return "(DSN illisible)";
  }
}

/**
 * Nom de fichier déterministe et trié chronologiquement.
 * @param {string} label
 * @param {Date} date
 */
export function backupFileName(label, date = new Date()) {
  const stamp = date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return `${label}-${stamp}.dump.enc`;
}

/** @param {Buffer | string} buffer */
function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

/** Attend la fin d'un processus enfant et renvoie code + stderr. */
function waitExit(child, name) {
  let stderr = "";
  child.stderr?.on("data", (chunk) => {
    stderr += String(chunk);
  });
  return new Promise((resolve) => {
    child.on("error", (error) => resolve({ code: -1, stderr: `${name}: ${error.message}` }));
    child.on("close", (code) => resolve({ code: code ?? -1, stderr }));
  });
}

/**
 * `pg_dump` chiffré en flux : le dump ne touche jamais le disque en clair.
 *
 * @param {{ url: string }} target
 * @param {string} outPath
 * @param {string} passphrase
 * @param {{ bin?: string }} [options] `bin` permet de vérifier le pipeline sans
 *   PostgreSQL installé (voir scripts/backup-postgres.test.mjs) ; en production
 *   c'est toujours `pg_dump` du PATH.
 * @returns {Promise<{ bytes: number, pgDumpStderr: string }>}
 */
export async function dumpEncrypted(target, outPath, passphrase, options = {}) {
  if (!passphrase) throw new Error("BACKUP_ENCRYPTION_KEY manquant : refus d'écrire un dump non chiffré.");
  const bin = options.bin ?? process.env.BACKUP_PG_DUMP_BIN ?? "pg_dump";

  const dump = spawn(
    bin,
    ["--format=custom", "--no-owner", "--no-acl", target.url],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  const openssl = spawn(
    "openssl",
    ["enc", "-aes-256-cbc", "-salt", "-pbkdf2", "-pass", "env:BACKUP_ENCRYPTION_KEY"],
    {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, BACKUP_ENCRYPTION_KEY: passphrase },
    },
  );

  const sink = createWriteStream(outPath);

  const dumpDone = waitExit(dump, bin);
  const opensslDone = waitExit(openssl, "openssl");

  await Promise.all([
    pipeline(dump.stdout, openssl.stdin),
    pipeline(openssl.stdout, sink),
  ]);

  const [{ code: dumpCode, stderr: dumpErr }, { code: sslCode, stderr: sslErr }] = await Promise.all([
    dumpDone,
    opensslDone,
  ]);

  if (dumpCode !== 0) throw new Error(`pg_dump a échoué (${dumpCode}): ${redact(dumpErr, target.url)}`);
  if (sslCode !== 0) throw new Error(`openssl a échoué (${sslCode}): ${sslErr.trim()}`);

  const buffer = await readFile(outPath);
  return { bytes: buffer.length, pgDumpStderr: dumpErr.trim() };
}

/** Retire un DSN (et son mot de passe) d'un message d'erreur. */
function redact(text, dsn) {
  const safe = text.replaceAll(dsn, redactDsn(dsn));
  return safe.replace(/password=[^\s]+/gi, "password=***");
}

/**
 * Sauvegarde toutes les cibles configurées, écrit les empreintes et un manifeste.
 * @param {object} options
 * @param {string} options.outDir
 * @param {Record<string, string | undefined>} [options.env]
 * @param {Date} [options.now]
 */
export async function backupAll({ outDir, env = process.env, now = new Date() }) {
  const { configured, missing } = parseTargets(env);
  const passphrase = (env.BACKUP_ENCRYPTION_KEY ?? "").trim();
  if (!passphrase) {
    throw Object.assign(
      new Error("BACKUP_ENCRYPTION_KEY manquant — un dump non chiffré n'est pas acceptable."),
      { exitCode: 2 },
    );
  }

  await mkdir(outDir, { recursive: true });
  const entries = [];
  for (const target of configured) {
    const file = backupFileName(target.label, now);
    const path = join(outDir, file);
    const { bytes } = await dumpEncrypted(target, path, passphrase);
    const digest = sha256(await readFile(path));
    await writeFile(`${path}.sha256`, `${digest}  ${file}\n`, "utf8");
    entries.push({
      label: target.label,
      sourceEnv: target.env,
      purpose: target.purpose,
      host: redactDsn(target.url),
      file,
      bytes,
      sha256: digest,
      encrypted: true,
    });
  }

  const manifest = {
    schemaVersion: 1,
    createdAt: now.toISOString(),
    encryption: "openssl enc -aes-256-cbc -salt -pbkdf2",
    targets: entries,
    notConfigured: missing.map((m) => m.env),
  };
  await writeFile(join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return manifest;
}

/** Résumé affichable (aucun secret). */
export function describeManifest(manifest) {
  const lines = [
    `Sauvegarde ${manifest.createdAt} — ${manifest.targets.length} base(s) chiffrée(s)`,
  ];
  for (const entry of manifest.targets) {
    lines.push(`  • ${entry.label} (${entry.host}) — ${entry.bytes} octets — sha256 ${entry.sha256.slice(0, 12)}…`);
  }
  if (manifest.notConfigured.length) {
    lines.push(`  ⚠ non configuré : ${manifest.notConfigured.join(", ")}`);
  }
  return lines.join("\n");
}

async function main() {
  const [command = "plan", ...rest] = process.argv.slice(2);
  const outIndex = rest.indexOf("--out");
  const outDir = outIndex >= 0 ? rest[outIndex + 1] : "backups";

  if (command === "plan") {
    const { configured, missing } = parseTargets(process.env);
    console.log(`[backup] cibles configurées : ${configured.length}`);
    for (const target of configured) {
      console.log(`  • ${target.label} (${target.env}) → ${redactDsn(target.url)}`);
    }
    for (const target of missing) {
      console.log(`  ⚠ ${target.label} non configurée (${target.env}) — ${target.purpose}`);
    }
    console.log(
      (process.env.BACKUP_ENCRYPTION_KEY ?? "").trim()
        ? "[backup] chiffrement : clé présente"
        : "[backup] chiffrement : BACKUP_ENCRYPTION_KEY ABSENTE (sauvegarde refusée)",
    );
    return;
  }

  if (command !== "backup") {
    console.error(`[backup] commande inconnue « ${command} » — attendu : plan | backup`);
    process.exitCode = 2;
    return;
  }

  const manifest = await backupAll({ outDir });
  console.log(describeManifest(manifest));
}

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  main().catch((error) => {
    console.error(`[backup] ${error?.message ?? error}`);
    process.exit(error?.exitCode ?? 1);
  });
}
