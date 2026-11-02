/**
 * Server fns admin : liste toutes les commandes + revue (validation/livraison/refund).
 * Extraits de purchase-orders.ts (PR 2/3).
 */
import { createServerFn } from "@tanstack/react-start";
import { licenseExpiryFor } from "@/content/purchase-order";
import { authMiddleware } from "@/lib/auth/middleware";
import { adminDecisionSchema } from "@/features/purchase/schemas";
import {
  discardableKeyHash,
  purchaseByReference,
  requirePurchaseAdmin,
  toIsoOrNull,
  toPurchase,
  type AdminPurchaseOrder,
  type PurchaseRow,
} from "@/features/purchase/shared";

export const listPremiumPurchaseOrdersForAdmin = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    requirePurchaseAdmin(context.userId);
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const rows = await sql.query<PurchaseRow>(
      `select * from purchase_orders
       order by updated_at desc
       limit 500`,
    );
    return rows.map(
      (row): AdminPurchaseOrder => ({
        purchase: toPurchase(row),
        userId: row.user_id,
        optimusId: row.optimus_id,
        paymentProvider: row.payment_provider,
        paymentReference: row.payment_reference,
        proofDigest: row.proof_digest,
        deviceId: row.device_id,
      }),
    );
  });

export const reviewPremiumPurchaseOrder = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(adminDecisionSchema)
  .handler(async ({ data, context }) => {
    requirePurchaseAdmin(context.userId);
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const current = await purchaseByReference(sql, data.reference);
    if (!current) throw new Error("Commande introuvable.");

    if (current.status === data.decision) {
      let revokedLicenses = 0;
      if (data.decision === "refunded") {
        const count = await sql.query<{ count: number | string }>(
          `select count(*)::int as count
             from activation_keys
             where purchase_reference = $1 and revoked_at is not null`,
          [data.reference],
        );
        revokedLicenses = Number(count[0]?.count ?? 0);
      }
      return { purchase: toPurchase(current), revokedLicenses, licenceExpiresAt: null };
    }

    if (data.decision === "payment_verified") {
      if (current.status !== "verification_pending") {
        throw new Error("La commande doit etre en verification avant validation du paiement.");
      }
      if (
        !current.payment_reference ||
        !current.proof_digest ||
        !current.proof_attached
      ) {
        throw new Error("La reference et la preuve de paiement doivent etre presentes.");
      }
    }

    if (data.decision === "delivered") {
      if (current.status !== "payment_verified") {
        throw new Error("Le paiement doit etre valide avant livraison.");
      }
      if (
        !current.device_id ||
        !current.device_key_id ||
        !current.device_public_key
      ) {
        throw new Error("Aucune demande appareil securisee n'est liee a cette commande.");
      }
    }

    if (data.decision === "refunded" && current.status !== "delivered") {
      throw new Error("Seule une commande livree peut etre marquee remboursee.");
    }

    if (
      data.decision === "rejected" &&
      ["delivered", "refunded"].includes(current.status)
    ) {
      throw new Error("Une commande deja livree ou remboursee ne peut pas etre rejetee.");
    }

    if (data.decision === "refunded") {
      const refunded = await sql.query<
        PurchaseRow & { revoked_licenses: number | string }
      >(
        `with updated as (
           update purchase_orders
              set status = 'refunded',
                  refunded_at = coalesce(refunded_at, now()),
                  updated_at = now()
            where reference = $1 and status = 'delivered'
            returning *
         ), revoked as (
           update activation_keys
              set revoked_at = coalesce(revoked_at, now())
            where purchase_reference in (select reference from updated)
              and revoked_at is null
            returning id
         ), event as (
           insert into purchase_order_events (reference, actor_user_id, event_type, metadata)
           select reference,
                  $2,
                  'refunded',
                  jsonb_build_object(
                    'note', $3::text,
                    'revokedLicenses', (select count(*) from revoked)
                  )
             from updated
         )
         select updated.*, (select count(*) from revoked)::int as revoked_licenses
           from updated`,
        [data.reference, context.userId, data.note ?? null],
      );
      const next = refunded[0];
      if (next) {
        return {
          purchase: toPurchase(next),
          revokedLicenses: Number(next.revoked_licenses ?? 0),
          licenceExpiresAt: null,
        };
      }

      const latest = await purchaseByReference(sql, data.reference);
      if (!latest) throw new Error("Commande introuvable.");
      if (latest.status === "refunded") {
        const count = await sql.query<{ count: number | string }>(
          `select count(*)::int as count
             from activation_keys
             where purchase_reference = $1 and revoked_at is not null`,
          [data.reference],
        );
        return {
          purchase: toPurchase(latest),
          revokedLicenses: Number(count[0]?.count ?? 0),
          licenceExpiresAt: null,
        };
      }
      throw new Error("L'etat de la commande a change. Actualisez avant de continuer.");
    }

    if (data.decision === "delivered") {
      const licenceExpiresAt = licenseExpiryFor(current.offer);
      const delivered = await sql.query<
        PurchaseRow & { licence_expires_at: string | Date | null; licence_id: string | null }
      >(
        `with updated as (
           update purchase_orders
              set status = 'delivered',
                  delivered_at = coalesce(delivered_at, now()),
                  updated_at = now()
            where reference = $1 and status = $2
            returning *
         ), licence as (
           insert into activation_keys (
             key_hash, optimus_id, product, expires_at, purchase_reference, device_id, activated_at
           )
           select $3, optimus_id, product, $4::timestamptz, reference, device_id, now()
             from updated
            where device_id is not null
              and not exists (
                select 1 from activation_keys existing
                 where existing.purchase_reference = updated.reference
              )
           returning id, expires_at
         ), event as (
           insert into purchase_order_events (reference, actor_user_id, event_type, metadata)
           select reference,
                  $5,
                  'delivered',
                  jsonb_build_object(
                    'note', $6::text,
                    'offer', offer,
                    'licenceId', (select id from licence),
                    'licenceExpiresAt', (select expires_at from licence)
                  )
             from updated
         )
         select updated.*,
                (select id from licence) as licence_id,
                (select expires_at from licence) as licence_expires_at
           from updated`,
        [
          data.reference,
          "payment_verified",
          discardableKeyHash(),
          licenceExpiresAt,
          context.userId,
          data.note ?? null,
        ],
      );
      const next = delivered[0];
      if (next) {
        return {
          purchase: toPurchase(next),
          revokedLicenses: 0,
          licenceExpiresAt: toIsoOrNull(next.licence_expires_at),
        };
      }

      const latest = await purchaseByReference(sql, data.reference);
      if (!latest) throw new Error("Commande introuvable.");
      if (latest.status === "delivered") {
        return { purchase: toPurchase(latest), revokedLicenses: 0, licenceExpiresAt: null };
      }
      throw new Error("L'etat de la commande a change. Actualisez avant de continuer.");
    }

    const expectedStatus = current.status;
    const timestampColumn =
      data.decision === "payment_verified" ? "payment_verified_at" : "rejected_at";

    const updated = await sql.query<PurchaseRow>(
      `with updated as (
         update purchase_orders
            set status = $2,
                ${timestampColumn} = coalesce(${timestampColumn}, now()),
                updated_at = now()
          where reference = $1 and status = $4
          returning *
       ), event as (
         insert into purchase_order_events (reference, actor_user_id, event_type, metadata)
         select reference, $3, status, jsonb_build_object('note', $5::text)
           from updated
       )
       select * from updated`,
      [data.reference, data.decision, context.userId, expectedStatus, data.note ?? null],
    );
    const next = updated[0];
    if (next) return { purchase: toPurchase(next), revokedLicenses: 0, licenceExpiresAt: null };

    const latest = await purchaseByReference(sql, data.reference);
    if (!latest) throw new Error("Commande introuvable.");
    if (latest.status === data.decision) {
      return { purchase: toPurchase(latest), revokedLicenses: 0, licenceExpiresAt: null };
    }
    throw new Error("L'etat de la commande a change. Actualisez avant de continuer.");
  });
