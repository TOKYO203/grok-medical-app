import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  BACKUP_TARGETS,
  backupFileName,
  describeManifest,
  dumpEncrypted,
  parseTargets,
  redactDsn,
} from "./backup-postgres.mjs";

test("les deux projets Supabase sont couverts", () => {
  assert.deepEqual(
    BACKUP_TARGETS.map((target) => target.env),
    ["DATABASE_URL", "SUPABASE_DB_URL"],
  );
});

test("une cible absente est signalée sans faire échouer la sauvegarde partielle", () => {
  const { configured, missing } = parseTargets({
    DATABASE_URL: "postgresql://user:secret@db.example.com:5432/optimus",
  });
  assert.equal(configured.length, 1);
  assert.equal(configured[0].label, "app");
  assert.deepEqual(missing.map((m) => m.env), ["SUPABASE_DB_URL"]);
});

test("aucune cible configurée est une erreur explicite", () => {
  assert.throws(() => parseTargets({}), /Aucune cible configurée/);
});

test("un DSN journalisé ne contient jamais le mot de passe", () => {
  const redacted = redactDsn("postgresql://optimus:super-secret@db.example.com:6543/optimus");
  assert.equal(redacted, "postgres://optimus@db.example.com:6543/optimus");
  assert.ok(!redacted.includes("super-secret"));
  assert.equal(redactDsn(""), "(vide)");
  assert.equal(redactDsn("pas-un-dsn"), "(DSN illisible)");
});

test("les noms de fichiers sont horodatés et triables", () => {
  const date = new Date("2026-11-12T18:30:05.123Z");
  assert.equal(backupFileName("app", date), "app-20261112T183005Z.dump.enc");
  assert.equal(backupFileName("supabase-client", date), "supabase-client-20261112T183005Z.dump.enc");
});

test("le pipeline chiffre le dump et le déchiffre à l'identique", async () => {
  const dir = await mkdtemp(join(tmpdir(), "backup-pipeline-"));
  const fakeDump = join(dir, "fake-pg-dump");
  // Un `pg_dump` factice : le pipeline (spawn → openssl → fichier) est réel,
  // seul le binaire PostgreSQL est remplacé — absent de certains environnements.
  await writeFile(fakeDump, '#!/bin/sh\nprintf "optimus-fake-dump:%s\\n" "$*"\n', "utf8");
  await chmod(fakeDump, 0o755);
  const outPath = join(dir, "app-test.dump.enc");
  const passphrase = "phrase-de-passe-de-test-32-caracteres";

  try {
    const result = await dumpEncrypted(
      { url: "postgresql://user:secret@db.example.com:5432/optimus" },
      outPath,
      passphrase,
      { bin: fakeDump },
    );
    assert.ok(result.bytes > 0, "le fichier chiffré doit être non vide");

    const ciphertext = await readFile(outPath);
    assert.ok(
      !ciphertext.includes("optimus-fake-dump"),
      "le contenu du dump ne doit pas apparaître en clair",
    );

    const plaintext = execFileSync(
      "openssl",
      ["enc", "-d", "-aes-256-cbc", "-pbkdf2", "-pass", `pass:${passphrase}`, "-in", outPath],
      { encoding: "utf8" },
    );
    assert.match(plaintext, /optimus-fake-dump:--format=custom --no-owner --no-acl/);
    assert.match(plaintext, /db.example.com/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("un dump sans phrase de passe est refusé", async () => {
  await assert.rejects(
    () => dumpEncrypted({ url: "postgresql://user@db.example.com/optimus" }, "/tmp/never.dump.enc", ""),
    /refus d'écrire un dump non chiffré/,
  );
});

test("le résumé ne divulgue aucun secret et signale les cibles manquantes", () => {
  const summary = describeManifest({
    createdAt: "2026-11-12T00:00:00.000Z",
    targets: [
      {
        label: "app",
        host: "postgres://optimus@db.example.com:5432/optimus",
        bytes: 2048,
        sha256: "abcdef0123456789",
      },
    ],
    notConfigured: ["SUPABASE_DB_URL"],
  });
  assert.match(summary, /1 base\(s\) chiffrée\(s\)/);
  assert.match(summary, /supabase-client|SUPABASE_DB_URL/);
  assert.ok(!summary.includes("secret"));
});
