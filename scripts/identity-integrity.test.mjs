import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const readMigration = (path) => readFile(new URL(`../migrations/${path}`, import.meta.url), "utf8");
const [authSchema, appSchema, identityText, identityForeignKeys] = await Promise.all([
  readMigration("auth/0001_auth.sql"),
  readMigration("0003_add_publications_and_surveys.sql"),
  readMigration("0006_user_identity_text.sql"),
  readMigration("auth/0013_user_identity_foreign_keys.sql"),
]);

test("auth identity migration preserves real users, clears untrusted orphans and enforces future references", async () => {
  const db = new PGlite();
  await db.waitReady;
  try {
    await db.exec(authSchema);
    await db.exec(appSchema);

    const realUserId = "11111111-2222-3333-4444-555555555555";
    const orphanUserId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    await db.query(
      `insert into "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
       values ($1, $2, $3, true, now(), now())`,
      [realUserId, "Migration User", "migration-user@example.invalid"],
    );

    await db.query(
      "insert into publications (id, title, created_by) values ($1, $2, $3)",
      ["10000000-0000-4000-8000-000000000001", "Trusted author", realUserId],
    );
    await db.query(
      "insert into publications (id, title, created_by) values ($1, $2, $3)",
      ["10000000-0000-4000-8000-000000000002", "Legacy orphan", orphanUserId],
    );
    await db.query(
      "insert into surveys (id, title, created_by) values ($1, $2, $3)",
      ["20000000-0000-4000-8000-000000000001", "Trusted survey", realUserId],
    );
    await db.query(
      "insert into survey_responses (id, survey_id, respondent_id, answers) values ($1, $2, $3, '[]'::jsonb)",
      [
        "30000000-0000-4000-8000-000000000001",
        "20000000-0000-4000-8000-000000000001",
        orphanUserId,
      ],
    );

    await db.exec(identityText);
    await db.exec(identityForeignKeys);

    const publications = await db.query(
      "select title, created_by from publications order by title",
    );
    const trusted = publications.rows.find((row) => row.title === "Trusted author");
    const orphan = publications.rows.find((row) => row.title === "Legacy orphan");
    assert.equal(trusted?.created_by, realUserId);
    assert.equal(orphan?.created_by, null);

    const response = await db.query("select respondent_id from survey_responses limit 1");
    assert.equal(response.rows[0]?.respondent_id, null);

    await assert.rejects(
      db.query(
        "insert into publications (id, title, created_by) values ($1, $2, $3)",
        ["10000000-0000-4000-8000-000000000003", "Rejected fake author", "fake-user-id"],
      ),
      /foreign key|violates/i,
    );

    const validInsert = await db.query(
      "insert into publications (id, title, created_by) values ($1, $2, $3) returning created_by",
      ["10000000-0000-4000-8000-000000000004", "Verified author", realUserId],
    );
    assert.equal(validInsert.rows[0]?.created_by, realUserId);

    await db.query('delete from "user" where "id" = $1', [realUserId]);
    const afterDelete = await db.query(
      "select created_by from publications where title = 'Verified author'",
    );
    assert.equal(afterDelete.rows[0]?.created_by, null, "deleting an account must not delete authored content");
  } finally {
    await db.close();
  }
});
