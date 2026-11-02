/**
 * Façade legacy : expose uniquement getPurchaseLicense.
 *
 * TODO (PR 4) : migrer getPurchaseLicense vers @/features/purchase/client
 * puis supprimer ce fichier. Les autres serverFns purchase sont déjà dans
 * @/features/purchase/{client,admin,create}.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { referenceSchema } from "@/features/purchase/schemas";
import {
  ownedPurchase,
  discardableKeyHash,
  toIsoOrNull,
} from "@/features/purchase/shared";
import { licenseExpiryFor } from "@/content/purchase-order";
import type { LicenseReceipt } from "@/core/types";

export const getPurchaseLicense = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ reference: referenceSchema }))
  .handler(async ({ data, context }) => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const current = await ownedPurchase(sql, data.reference, context.userId);
    if (!current) throw new Error("Commande introuvable.");
    if (current.status !== "delivered" || !current.device_id) return null;

    // Crée la licence si la commande a été livrée avant cette version (idempotent).
    const rows = await sql.query<{
      id: string;
      expires_at: string | Date | null;
      activated_at: string | Date;
    }>(
      `with existing as (
         select id, expires_at, activated_at
           from activation_keys
          where purchase_reference = $1
          order by created_at asc
          limit 1
       ), inserted as (
         insert into activation_keys (
           key_hash, optimus_id, product, expires_at, purchase_reference, device_id, activated_at
         )
         select $2, $3, $4, $5::timestamptz, $1, $6, now()
          where not exists (select 1 from existing)
         returning id, expires_at, activated_at
       )
       select * from existing
       union all
       select * from inserted`,
      [
        current.reference,
        discardableKeyHash(),
        current.optimus_id,
        current.product,
        licenseExpiryFor(current.offer),
        current.device_id,
      ],
    );
    const licence = rows[0];
    if (!licence) throw new Error("Licence introuvable.");

    const issuedAt = toIsoOrNull(licence.activated_at) ?? new Date().toISOString();
    const expiresAt = toIsoOrNull(licence.expires_at);
    const base = {
      reference: current.reference,
      product: current.product,
      licenseId: licence.id,
      issuedAt,
      expiresAt,
    };

    // La clé est lue dans un module *.server.ts : deux garde-fous du dépôt
    // interdisent qu'une clé privée soit référencée dans un module isomorphe
    // (celui-ci est importé par des composants clients).
    const { readLicenseSigningKey } = await import("@/server/license-signing-key.server");
    const signingKey = readLicenseSigningKey();
    if (!signingKey) {
      console.warn("[purchase-license] clé de signature absente : reçu non signé");
      return { ...base, status: "signing-unavailable" as const, receipt: null };
    }

    try {
      const { signLicenseReceipt } = await import("@/content/license-receipt.server");
      const receipt: LicenseReceipt = signLicenseReceipt(
        {
          version: 1,
          licenseId: licence.id,
          product: current.product,
          optimusId: current.optimus_id,
          deviceId: current.device_id.toLowerCase(),
          issuedAt,
          expiresAt,
        },
        signingKey,
      );
      return { ...base, status: "issued" as const, receipt };
    } catch (error) {
      console.warn("[purchase-license] sign failed:", (error as Error).message);
      return { ...base, status: "signing-unavailable" as const, receipt: null };
    }
  });
