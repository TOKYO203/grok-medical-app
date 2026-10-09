import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "node:crypto";
import { getSql } from "@/lib/db";
import { signLicenseReceipt } from "@/content/license-receipt.server";
import type { LicenseReceiptPayload } from "@/core/types";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

type ActivateBody = {
  key?: string;
  optimusId?: string;
  deviceId?: string;
  devicePublicKey?: string;
};

type Row = {
  id: string;
  optimus_id: string;
  device_id: string | null;
  product: string;
  expires_at: string | Date | null;
  activated_at: string | Date | null;
  revoked_at: string | Date | null;
};

export const Route = createFileRoute("/api/licenses/activate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: ActivateBody;
        try {
          body = (await request.json()) as ActivateBody;
        } catch {
          return json({ error: "Corps de requête invalide" }, 400);
        }

        const key = (body.key ?? "").trim().toUpperCase();
        const optimusId = (body.optimusId ?? "").trim().toUpperCase();
        const deviceId = (body.deviceId ?? "").trim();

        if (!key.startsWith("OPT-")) {
          return json({ error: "Clé d'activation invalide" }, 400);
        }
        if (!/^OM-[A-F0-9]{8}$/.test(optimusId)) {
          return json({ error: "Optimus ID invalide" }, 400);
        }
        if (deviceId.length < 8) {
          return json({ error: "Identifiant d'appareil manquant" }, 400);
        }

        const keyHash = createHash("sha256").update(key, "utf8").digest("hex");

        let row: Row | null = null;
        try {
          const sql = await getSql();
          const rows = (await sql.query(
            "SELECT id, optimus_id, device_id, product, expires_at, activated_at, revoked_at FROM activation_keys WHERE key_hash = $1 LIMIT 1",
            [keyHash],
          )) as Row[];
          row = rows?.[0] ?? null;
        } catch (e) {
          console.warn("[licenses/activate] DB read failed:", (e as Error).message);
          return json({ error: "Erreur base de données" }, 500);
        }

        if (!row) return json({ error: "Clé introuvable" }, 404);
        if (row.revoked_at) return json({ error: "Clé révoquée" }, 403);

        const now = Date.now();
        if (row.expires_at && new Date(row.expires_at).getTime() < now) {
          return json({ error: "Clé expirée" }, 403);
        }
        if (row.optimus_id !== optimusId) {
          return json({ error: "Cette clé est liée à un autre profil" }, 403);
        }
        if (row.activated_at && row.device_id && row.device_id !== deviceId) {
          return json({ error: "Clé déjà utilisée sur un autre appareil" }, 409);
        }

        try {
          const sql = await getSql();
          await sql.query(
            "UPDATE activation_keys SET activated_at = COALESCE(activated_at, now()), device_id = $1 WHERE id = $2",
            [deviceId, row.id],
          );
        } catch (e) {
          console.warn("[licenses/activate] DB write failed:", (e as Error).message);
          return json({ error: "Échec de l'enregistrement" }, 500);
        }

        const privateKey = (process.env.LICENSE_SIGNING_PRIVATE_KEY ?? "").trim();
        if (!privateKey) {
          console.warn("[licenses/activate] LICENSE_SIGNING_PRIVATE_KEY manquante");
          return json({ error: "Configuration serveur incomplète" }, 500);
        }

        const payload: LicenseReceiptPayload = {
          version: 1,
          licenseId: row.id,
          product: row.product,
          optimusId: row.optimus_id,
          deviceId,
          issuedAt: new Date().toISOString(),
          expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
        };

        try {
          const receipt = signLicenseReceipt(payload, privateKey);
          return json({ receipt });
        } catch (e) {
          console.warn("[licenses/activate] sign failed:", (e as Error).message);
          return json({ error: "Échec de signature" }, 500);
        }
      },
    },
  },
});
