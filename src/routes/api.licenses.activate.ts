import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "node:crypto";
import { getSql } from "@/lib/db";
import { signLicenseReceipt } from "@/content/license-receipt.server";
import { rateLimitRequest, retryAfterSeconds } from "@/lib/security/rate-limit.server";
import type { LicenseReceiptPayload } from "@/core/types";

/**
 * `/api/licenses/activate` — TanStack Start handler.
 *
 * WHY THIS FILE DUPLICATES `server/api/licenses/activate.ts`: the Nitro plugin
 * (and therefore every H3 route under `server/api/**`) is only wired when
 * `command === "build" || isPreview` (see `vite.config.ts`). In `vite dev` the
 * TanStack router is the ONLY thing serving `/api/*`, so without this handler
 * the activation endpoint 404s locally and the feature cannot be developed or
 * QA'd at all.
 *
 * The two implementations must stay SECURITY-EQUIVALENT: whichever one Nitro
 * elects in a given environment, a caller must never find a weaker path. This
 * one used to be the weak one — pre-`SELECT` then `UPDATE`, a
 * `deviceId.length < 8` check, no throttling and no `no-store` — which meant the
 * deployed (H3) route could be silently shadowed by an unthrottled twin. The
 * guards below mirror `server/api/licenses/activate.ts` one for one.
 */

/** Hardening parity with the H3 handler — keep these two regexes in sync. */
const KEY_PATTERN = /^OPT-(?:[A-F0-9]{4}-){5}[A-F0-9]{4}$/;
const OPTIMUS_ID_PATTERN = /^OM-[A-F0-9]{8}$/;
const DEVICE_ID_PATTERN = /^[a-f0-9]{12}$/i;

/** Reject an oversized body before parsing it (mirrors the admin/AI routes). */
const MAX_BODY_BYTES = 4 * 1024;

const RATE_LIMIT_MAX = 8;
const RATE_LIMIT_WINDOW_MS = 60_000;

type ActivateBody = {
  key?: unknown;
  optimusId?: unknown;
  deviceId?: unknown;
};

type ActivatedLicense = {
  id: string;
  product: string;
  expires_at: string | Date | null;
  activated_at: string | Date;
};

function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      // Licences are per-device and short-lived enough to matter: never let a
      // proxy or the browser cache an activation answer.
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}

function normalizeKey(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

function keyHash(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

function isoTimestamp(value: string | Date): string {
  return new Date(value).toISOString();
}

export const Route = createFileRoute("/api/licenses/activate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Throttle BEFORE any parsing or DB work: every attempt (valid-looking or
        // not) consumes the same budget, so the endpoint cannot be hammered or
        // used as an unthrottled oracle. Subject = trusted client IP
        // (`client-ip.server.ts`), which forged `x-forwarded-for` cannot widen.
        const decision = await rateLimitRequest(
          request,
          "license-activate",
          RATE_LIMIT_MAX,
          RATE_LIMIT_WINDOW_MS,
        );
        if (!decision.ok) {
          return json(
            { error: "Trop de tentatives. Réessayez plus tard." },
            429,
            { "Retry-After": String(retryAfterSeconds(decision)) },
          );
        }

        const declared = Number(request.headers.get("content-length"));
        if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
          return json({ error: "Requête trop volumineuse." }, 413);
        }

        const raw = await request.text().catch(() => "");
        if (raw.length > MAX_BODY_BYTES) {
          return json({ error: "Requête trop volumineuse." }, 413);
        }

        let body: ActivateBody = {};
        try {
          const parsed = JSON.parse(raw || "{}");
          if (parsed && typeof parsed === "object") body = parsed as ActivateBody;
        } catch {
          return json({ error: "Corps de requête invalide" }, 400);
        }

        const key = normalizeKey(body.key);
        const optimusId = String(body.optimusId ?? "")
          .trim()
          .toUpperCase();
        const deviceId = String(body.deviceId ?? "").trim();

        // Strict format checks, identical to the H3 handler. The old
        // `deviceId.length < 8` accepted any junk string, so device binding was
        // trivially bypassable by sending a fresh non-hex id per request.
        if (
          !KEY_PATTERN.test(key) ||
          !OPTIMUS_ID_PATTERN.test(optimusId) ||
          !DEVICE_ID_PATTERN.test(deviceId)
        ) {
          return json({ error: "Clé ou identifiant invalide." }, 400);
        }

        const privateKey = (process.env.LICENSE_SIGNING_PRIVATE_KEY ?? "").trim();
        if (!privateKey) {
          console.warn("[licenses/activate] LICENSE_SIGNING_PRIVATE_KEY manquante");
          return json({ error: "Le service d'activation sécurisée est temporairement indisponible." }, 503);
        }

        // ONE atomic statement does validation AND binding. The previous
        // `SELECT`-then-`UPDATE` let two concurrent requests on a fresh key both
        // read `device_id = null`, both pass, and both receive a valid signed
        // receipt bound to a DIFFERENT device — a licence-doubling race.
        let license: ActivatedLicense | undefined;
        try {
          const sql = await getSql();
          const rows = await sql.query<ActivatedLicense>(
            `update activation_keys
                set device_id = coalesce(device_id, $2),
                    activated_at = coalesce(activated_at, now())
              where key_hash = $1
                and optimus_id = $3
                and revoked_at is null
                and (expires_at is null or expires_at > now())
                and (device_id is null or device_id = $2)
              returning id, product, expires_at, activated_at`,
            [keyHash(key), deviceId, optimusId],
          );
          license = rows[0];
        } catch (error) {
          console.warn("[licenses/activate] DB error:", (error as Error).message);
          return json({ error: "Le service d'activation sécurisée est temporairement indisponible." }, 503);
        }

        // A single generic answer for "unknown key", "wrong profile", "revoked"
        // and "already bound to another device": distinguishing them let an
        // anonymous caller enumerate which keys exist and which profiles own
        // them. The H3 handler returns the same consolidated message.
        if (!license) {
          return json(
            {
              error:
                "Cette clé est invalide, expirée, révoquée ou déjà liée à un autre appareil.",
            },
            401,
          );
        }

        const payload: LicenseReceiptPayload = {
          version: 1,
          licenseId: license.id,
          product: license.product,
          optimusId,
          deviceId: deviceId.toLowerCase(),
          issuedAt: isoTimestamp(license.activated_at),
          expiresAt: license.expires_at === null ? null : isoTimestamp(license.expires_at),
        };

        try {
          const receipt = signLicenseReceipt(payload, privateKey);
          return json({
            ok: true,
            product: license.product,
            expiresAt: receipt.payload.expiresAt,
            receipt,
          });
        } catch (error) {
          console.warn("[licenses/activate] sign failed:", (error as Error).message);
          return json({ error: "Le service d'activation sécurisée est temporairement indisponible." }, 503);
        }
      },
    },
  },
});
