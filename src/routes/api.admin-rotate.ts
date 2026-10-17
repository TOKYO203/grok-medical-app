import { createFileRoute } from "@tanstack/react-router";

/**
 * TEMPORARY incident-recovery endpoint (kept out of `main`).
 *
 * The production admin password was leaked in a public commit and the live
 * deployment validates it against a PBKDF2 hash stored in `admin_config`, not
 * against the Vercel `ADMIN_PASSWORD` variable. The database connection string
 * is a write-only "sensitive" Vercel variable, so the hash can only be rotated
 * from inside the deployment.
 *
 * Guard: a 256-bit `ADMIN_ROTATE_TOKEN` (sensitive env var, preview only).
 * Without it the route answers 404, exactly like an unknown route. The route is
 * deleted from the working tree as soon as the hash is rotated.
 *
 * Actions:
 *   { action: "check", password } -> { hasHash, matches }
 *   { action: "set",   password } -> { ok: true }
 *
 * It never logs or echoes a password, never returns the stored hash, and sets
 * `Cache-Control: no-store`.
 */

const ITERATIONS = 210_000;
const HASH_BYTES = 32;
const MAX_BODY_BYTES = 2 * 1024;

function notFound(): Response {
  return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
}

export const Route = createFileRoute("/api/admin-rotate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expectedToken = (process.env.ADMIN_ROTATE_TOKEN ?? "").trim();
        if (expectedToken.length < 32) return notFound();

        const crypto = await import("node:crypto");
        const given = request.headers.get("x-rotate-token") ?? "";
        const digest = (v: string) => crypto.createHash("sha256").update(v, "utf8").digest();
        if (!crypto.timingSafeEqual(digest(given), digest(expectedToken))) return notFound();

        const raw = await request.text().catch(() => "");
        if (raw.length > MAX_BODY_BYTES) {
          return new Response(JSON.stringify({ error: "Requête trop volumineuse." }), {
            status: 413,
            headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
          });
        }

        let body: { action?: unknown; password?: unknown } = {};
        try {
          const parsed = JSON.parse(raw || "{}");
          if (parsed && typeof parsed === "object") body = parsed as typeof body;
        } catch {
          body = {};
        }

        const action = body.action;
        const password = typeof body.password === "string" ? body.password : "";
        if (password.length < 12 || password.length > 200) {
          return new Response(JSON.stringify({ error: "Mot de passe invalide." }), {
            status: 400,
            headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
          });
        }

        const { getSql } = await import("@/lib/db");
        const sql = await getSql();

        if (action === "check") {
          const rows = await sql.query<{ value?: string }>(
            "SELECT value FROM admin_config WHERE key = 'admin_password_hash' LIMIT 1",
          );
          const stored = typeof rows?.[0]?.value === "string" ? rows[0].value : null;
          let matches = false;
          if (stored) {
            const parts = stored.split("$");
            if (parts.length === 5 && parts[0] === "pbkdf2" && parts[1] === "sha256") {
              const iterations = Number.parseInt(parts[2], 10);
              const salt = Buffer.from(parts[3], "base64");
              const want = Buffer.from(parts[4], "base64");
              if (Number.isFinite(iterations) && iterations > 0 && want.length > 0) {
                const got = crypto.pbkdf2Sync(password, salt, iterations, want.length, "sha256");
                matches = crypto.timingSafeEqual(got, want);
              }
            }
          }
          return new Response(JSON.stringify({ hasHash: stored !== null, matches }), {
            status: 200,
            headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
          });
        }

        if (action === "set") {
          const salt = crypto.randomBytes(16);
          const hash = crypto.pbkdf2Sync(password, salt, ITERATIONS, HASH_BYTES, "sha256");
          const stored = `pbkdf2$sha256$${ITERATIONS}$${salt.toString("base64")}$${hash.toString("base64")}`;
          await sql.query(
            "CREATE TABLE IF NOT EXISTS admin_config (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())",
          );
          await sql.query(
            "INSERT INTO admin_config (key, value, updated_at) VALUES ('admin_password_hash', $1, NOW()) " +
              "ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()",
            [stored],
          );
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
          });
        }

        return new Response(JSON.stringify({ error: "Action inconnue." }), {
          status: 400,
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
