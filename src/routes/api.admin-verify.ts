import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";

const HASH_BYTES = 32;

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

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
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
    return timingSafeEqualStr(computed, hashB64);
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
        const body = (await request.json().catch(() => ({}))) as { adminKey?: string };
        const key = (body?.adminKey ?? "").trim();

        const storedHash = await loadStoredHash();
        if (storedHash) {
          const valid = await verifyPassword(key, storedHash);
          return new Response(
            JSON.stringify({ valid, source: "db" }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        const expected = (process.env.ADMIN_PASSWORD ?? "").trim();
        const valid = expected.length > 0 && timingSafeEqualStr(key, expected);
        return new Response(
          JSON.stringify({
            valid,
            source: "env-fallback",
            debug: { envDefined: expected.length > 0, envLength: expected.length, keyLength: key.length },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
