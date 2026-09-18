import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  isMigrationFile,
  migrationName,
  migrationPathsForAuth,
  pendingMigrations,
} from "./migration-plan.mjs";
import { projectRoot } from "./with-app-env.mjs";

const AUTH_MIGRATION = "0001_auth.sql";

test("_migrations keys on basename, not path", () => {
  assert.equal(migrationName("/migrations/0002_todos.sql"), "0002_todos.sql");
  assert.equal(migrationName("migrations/auth/0001_auth.sql"), "0001_auth.sql");
  assert.equal(migrationName("0001_auth.sql"), "0001_auth.sql");
});

test("a file already applied from another directory does not re-apply", () => {
  assert.deepEqual(
    pendingMigrations(["/migrations/auth/0001_auth.sql"], ["0001_auth.sql"]),
    [],
  );
});

test("pending migrations are returned in name order", () => {
  assert.deepEqual(
    pendingMigrations(
      ["/migrations/0003_c.sql", "/migrations/0001_a.sql", "/migrations/0002_b.sql"],
      ["0001_a.sql"],
    ),
    [
      { name: "0002_b.sql", path: "/migrations/0002_b.sql" },
      { name: "0003_c.sql", path: "/migrations/0003_c.sql" },
    ],
  );
});

test("non-.sql entries are dropped", () => {
  assert.equal(isMigrationFile("auth"), false);
  assert.deepEqual(pendingMigrations(["auth", "README.md"], []), []);
});

test("auth-off migration planning excludes the auth directory", () => {
  assert.deepEqual(
    migrationPathsForAuth(
      ["0003_app.sql", "README.md"],
      ["auth/0001_auth.sql", "auth/0013_integrity.sql"],
      false,
    ),
    ["0003_app.sql"],
  );
});

test("auth-on migration planning includes auth files and root files", () => {
  const selected = migrationPathsForAuth(
    ["0003_app.sql", "0006_identity.sql"],
    ["auth/0001_auth.sql", "auth/0013_integrity.sql"],
    true,
  );
  assert.deepEqual(
    pendingMigrations(selected, []).map(({ name }) => name),
    ["0001_auth.sql", "0003_app.sql", "0006_identity.sql", "0013_integrity.sql"],
  );
});

test("a legacy root copy wins over the auth source with the same basename", () => {
  const selected = migrationPathsForAuth(
    ["0001_auth.sql", "0003_app.sql"],
    ["auth/0001_auth.sql"],
    true,
  );
  assert.deepEqual(selected, ["0001_auth.sql", "0003_app.sql"]);
});

test("the Better Auth schema remains versioned under migrations/auth", () => {
  const authPath = join(projectRoot(), "migrations", "auth", AUTH_MIGRATION);
  assert.equal(existsSync(authPath), true);
  assert.ok(readdirSync(join(projectRoot(), "migrations", "auth")).includes(AUTH_MIGRATION));
});
