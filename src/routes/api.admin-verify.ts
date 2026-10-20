import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { rateLimitRequest, retryAfterSeconds } from "@/lib/security/rate-limit.server";

const HASH_BYTES = 32;
const MAX_BODY_BYTES = 4 * 1024;

/**
 * Admin password check. Two independent limits, both fail closed:
 *   - attempts are throttled on the TRUSTED client IP (a forged
 *     `x-forwarded-for` cannot buy a fresh budget), and
 *   - the comparison is length-blind, so the response cannot be used as an
 *     oracle for the secret's size.
 *
 * The response is deliberately just `{ valid }`: it used to echo a `debug`
 * block containing the ADMIN_PASSWORD length, which handed an anonymous caller
 * the exact key length to brute-force against.
 */

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

/**
 * Constant-time string comparison with no length oracle: both sides are hashed
 * first, so unequal-length inputs still take the same, fixed number of
 * operations instead of returning early on a length mismatch.
 */
async function secretsMatch(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [da, db] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  const va = new Uint8Array(da);
  const vb = new Uint8Array(db);
  let diff = 0;
  for (let i = 0; i < va.length; i++) diff |= va[i] ^ vb[i];
  return diff === 0;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 5) return false;
  const algo = parts[0];
  const hashName = parts[1];
  const iterStr = parts[2];
  const saltB64 = parts[3];
  const hashB64 = parts[4];
  if (algo !== "pbkdf2") return false;
  const iterations = parseInt(iterStr, 10);
  if (!Number.isFinite(iterations) || iterations < 1) return false;

  try {
    const salt = b64ToBytes(saltB64);
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw", enc.encode(password), "PBKDF2", false, ["deriveBits"],
    );
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: (((hashName.toLowerCase() === "sha256") ? "SHA-256" : (hashName.toLowerCase() === "sha384") ? "SHA-384" : (hashName.toLowerCase() === "sha512") ? "SHA-512" : (hashName.toLowerCase() === "sha1") ? "SHA-1" : hashName) as AlgorithmIdentifier) },
      key, HASH_BYTES * 8,
    );
    const computed = bytesToB64(new Uint8Array(bits));
    return await secretsMatch(computed, hashB64);
  } catch {
    return false;
  }
}

async function loadStoredHash(): Promise<string | null> {
  try {
    const sql = await getSql();
    const rows = (await sql(
      ["SELECT value FROM admin_config WHERE key = 'admin_password_hash' LIMIT 1"] as unknown as TemplateStringsArray,
    )) as Array<{ value?: string }>;
    if (Array.isArray(rows) && rows.length > 0 && typeof rows[0]?.value === "string") {
      return rows[0].value;
    }
  } catch (e) {
    console.warn("[admin-verify] DB read failed:", (e as Error).message);
  }
  return null;
}

export const Route = createFileRoute("/api/admin-verify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Throttle before doing any work. Unparseable/oversized bodies and wrong
        // guesses all consume the same budget, so the endpoint cannot be used as
        // an unthrottled oracle.
        const decision = await rateLimitRequest(request, "admin-verify", 10, 5 * 60_000);
        if (!decision.ok) {
          return new Response(JSON.stringify({ error: "Trop de tentatives." }), {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "Retry-After": String(retryAfterSeconds(decision)),
            },
          });
        }

        const declared = Number(request.headers.get("content-length"));
        if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
          return new Response(JSON.stringify({ error: "Requête trop volumineuse." }), {
            status: 413,
            headers: { "Content-Type": "application/json" },
          });
        }

        const raw = await request.text().catch(() => "");
        if (raw.length > MAX_BODY_BYTES) {
          return new Response(JSON.stringify({ error: "Requête trop volumineuse." }), {
            status: 413,
            headers: { "Content-Type": "application/json" },
          });
        }

        let body: { adminKey?: unknown } = {};
        try {
          const parsed = JSON.parse(raw || "{}");
          if (parsed && typeof parsed === "object") body = parsed as { adminKey?: unknown };
        } catch {
          body = {};
        }
        const key = typeof body.adminKey === "string" ? body.adminKey.trim() : "";

        const storedHash = await loadStoredHash();
        const valid = storedHash
          ? await verifyPassword(key, storedHash)
          : await (async () => {
              const expected = (process.env.ADMIN_PASSWORD ?? "").trim();
              if (expected.length === 0) return false;
              return secretsMatch(key, expected);
            })();

        return new Response(JSON.stringify({ valid }), {
          status: 200,
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
