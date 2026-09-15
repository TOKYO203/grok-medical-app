import { randomBytes } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  orderAmount,
  orderLabel,
  orderProduct,
  type PremiumOrder,
  type PremiumPurchase,
  type PurchaseStatus,
} from "@/content/purchase-order";
import { authMiddleware } from "@/lib/auth/middleware";

const specialtySchema = z.enum([
  "neurologie",
  "cardiologie",
  "infectiologie",
  "urgences",
  "dermatologie",
]);

const referenceSchema = z.string().regex(/^CMD-[A-Z0-9]+-[A-F0-9]{8}$/);

const createSchema = z.object({
  clientRequestId: z.string().uuid(),
  offer: z.enum(["deck", "specialty"]),
  specialty: specialtySchema,
  deckNumber: z.number().int().min(1).max(10),
});

const clientStatusSchema = z.enum([
  "instructions_requested",
  "proof_ready",
  "verification_pending",
]);

const advanceSchema = z.object({
  reference: referenceSchema,
  status: clientStatusSchema,
  proofAttached: z.boolean().optional(),
  proofDigest: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
  paymentReference: z.string().trim().min(6).max(120).optional(),
  device: z
    .object({
      deviceId: z.string().regex(/^[a-f0-9]{12}$/i),
      deviceKeyId: z.string().trim().min(8).max(180),
      publicKey: z.string().trim().min(64).max(12_000),
    })
    .optional(),
});

const instructionsSchema = z.object({ reference: referenceSchema });

const adminDecisionSchema = z.object({
  reference: referenceSchema,
  decision: z.enum(["payment_verified", "delivered", "rejected", "refunded"]),
  note: z.string().trim().max(2_000).optional(),
});

type PurchaseRow = {
  reference: string;
  user_id: string;
  optimus_id: string;
  offer: "deck" | "specialty";
  specialty: "neurologie" | "cardiologie" | "infectiologie" | "urgences" | "dermatologie";
  deck_number: number;
  product: string;
  label: string;
  amount: number;
  status: PurchaseStatus;
  proof_attached: boolean;
  created_at: string | Date;
  updated_at: string | Date;
  device_id: string | null;
  device_key_id: string | null;
  device_public_key: string | null;
  payment_provider: string | null;
  payment_reference: string | null;
  proof_digest: string | null;
};

type SqlClient = {
  query: <T = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<T[]>;
};

export type PremiumPaymentInstructions = {
  configured: boolean;
  provider: string | null;
  destination: string | null;
  accountName: string | null;
  note: string | null;
  amount: number;
  orderReference: string;
  product: string;
};

export type AdminPurchaseOrder = {
  purchase: PremiumPurchase;
  userId: string;
  optimusId: string;
  paymentProvider: string | null;
  paymentReference: string | null;
  proofDigest: string | null;
  deviceId: string | null;
};

function toPurchase(row: PurchaseRow): PremiumPurchase {
  return {
    reference: row.reference,
    offer: row.offer,
    specialty: row.specialty,
    deckNumber: Number(row.deck_number),
    product: row.product,
    label: row.label,
    amount: Number(row.amount),
    status: row.status,
    proofAttached: Boolean(row.proof_attached),
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

function makeReference(): string {
  const suffix = randomBytes(4).toString("hex").toUpperCase();
  return `CMD-${Date.now().toString(36).toUpperCase()}-${suffix}`;
}

function purchaseAdmins(): Set<string> {
  return new Set(
    (process.env.PURCHASE_ADMIN_USER_IDS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

function requirePurchaseAdmin(userId: string): void {
  if (!purchaseAdmins().has(userId)) throw new Error("Forbidden");
}

function paymentConfiguration(): Omit<
  PremiumPaymentInstructions,
  "amount" | "orderReference" | "product"
> {
  const provider = process.env.MOBILE_MONEY_PROVIDER?.trim() || null;
  const destination = process.env.MOBILE_MONEY_NUMBER?.trim() || null;
  const accountName = process.env.MOBILE_MONEY_ACCOUNT_NAME?.trim() || null;
  const note = process.env.MOBILE_MONEY_INSTRUCTIONS?.trim() || null;
  return {
    configured: Boolean(provider && destination),
    provider,
    destination,
    accountName,
    note,
  };
}

function normalizePaymentReference(value: string): string {
  const normalized = value.trim().toUpperCase().replace(/\s+/g, "");
  if (!/^[A-Z0-9._-]{6,120}$/.test(normalized)) {
    throw new Error("La référence de transaction Mobile Money est invalide.");
  }
  return normalized;
}

function duplicatePaymentEvidence(error: unknown): boolean {
  const text = error instanceof Error ? error.message : String(error);
  return /purchase_orders_payment_reference_unique_idx|purchase_orders_proof_digest_unique_idx|duplicate key/i.test(
    text,
  );
}

async function ownedPurchase(sql: SqlClient, reference: string, userId: string) {
  const rows = await sql.query<PurchaseRow>(
    `select * from purchase_orders
     where reference = $1 and user_id = $2
     limit 1`,
    [reference, userId],
  );
  return rows[0];
}

async function purchaseByReference(sql: SqlClient, reference: string) {
  const rows = await sql.query<PurchaseRow>(
    "select * from purchase_orders where reference = $1 limit 1",
    [reference],
  );
  return rows[0];
}

async function auditEvent(
  sql: SqlClient,
  reference: string,
  actorUserId: string,
  eventType: PurchaseStatus,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  await sql.query(
    `insert into purchase_order_events (reference, actor_user_id, event_type, metadata)
     values ($1, $2, $3, $4::jsonb)`,
    [reference, actorUserId, eventType, JSON.stringify(metadata)],
  );
}

export const createPremiumPurchaseOrder = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(createSchema)
  .handler(async ({ data, context }) => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();

    const stateRows = await sql.query<{ optimus_id: string }>(
      "select optimus_id from optimus_user_state where user_id = $1 limit 1",
      [context.userId],
    );
    const optimusId = stateRows[0]?.optimus_id;
    if (!optimusId) {
      throw new Error("Connectez et synchronisez votre compte Optimus avant de créer une commande.");
    }

    const existing = await sql.query<PurchaseRow & { client_request_id: string }>(
      `select * from purchase_orders
       where user_id = $1 and client_request_id = $2
       limit 1`,
      [context.userId, data.clientRequestId],
    );
    if (existing[0]) {
      const expectedOrder: PremiumOrder = {
        reference: existing[0].reference,
        offer: data.offer,
        specialty: data.specialty,
        deckNumber: data.deckNumber,
      };
      if (existing[0].product !== orderProduct(expectedOrder)) {
        throw new Error("Cette demande idempotente correspond déjà à une autre offre.");
      }
      return toPurchase(existing[0]);
    }

    const reference = makeReference();
    const order: PremiumOrder = {
      reference,
      offer: data.offer,
      specialty: data.specialty,
      deckNumber: data.deckNumber,
    };
    const product = orderProduct(order);
    const label = orderLabel(order);
    const amount = orderAmount(order);

    const rows = await sql.query<PurchaseRow>(
      `insert into purchase_orders (
         reference, user_id, client_request_id, optimus_id, offer, specialty,
         deck_number, product, label, amount, status, created_at, updated_at
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'created',now(),now())
       on conflict (user_id, client_request_id)
       do update set client_request_id = excluded.client_request_id
       returning *`,
      [
        reference,
        context.userId,
        data.clientRequestId,
        optimusId,
        data.offer,
        data.specialty,
        data.deckNumber,
        product,
        label,
        amount,
      ],
    );
    const row = rows[0];
    if (!row) throw new Error("La commande n'a pas pu être créée.");

    const canonicalOrder: PremiumOrder = {
      reference: row.reference,
      offer: data.offer,
      specialty: data.specialty,
      deckNumber: data.deckNumber,
    };
    if (row.product !== orderProduct(canonicalOrder)) {
      throw new Error("Cette demande idempotente correspond déjà à une autre offre.");
    }

    if (row.reference === reference) {
      await auditEvent(sql, row.reference, context.userId, "created", {
        product: row.product,
        amount: Number(row.amount),
      });
    }
    return toPurchase(row);
  });

export const listPremiumPurchaseOrders = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const rows = await sql.query<PurchaseRow>(
      `select * from purchase_orders
       where user_id = $1
       order by updated_at desc
       limit 500`,
      [context.userId],
    );
    return rows.map(toPurchase);
  });

export const getPremiumPaymentInstructions = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(instructionsSchema)
  .handler(async ({ data, context }) => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    let current = await ownedPurchase(sql, data.reference, context.userId);
    if (!current) throw new Error("Commande introuvable.");
    if (["delivered", "rejected", "refunded"].includes(current.status)) {
      throw new Error("Cette commande est déjà clôturée.");
    }

    const config = paymentConfiguration();
    const instructions: PremiumPaymentInstructions = {
      ...config,
      amount: Number(current.amount),
      orderReference: current.reference,
      product: current.product,
    };
    if (!config.configured) return { purchase: toPurchase(current), instructions };

    if (current.status === "created") {
      const updated = await sql.query<PurchaseRow>(
        `with updated as (
           update purchase_orders
              set status = 'instructions_requested',
                  payment_provider = $3,
                  updated_at = now()
            where reference = $1 and user_id = $2 and status = 'created'
            returning *
         ), event as (
           insert into purchase_order_events (reference, actor_user_id, event_type, metadata)
           select reference, $2, 'instructions_requested', jsonb_build_object('provider', $3::text)
             from updated
         )
         select * from updated`,
        [current.reference, context.userId, config.provider],
      );
      current = updated[0] ?? (await ownedPurchase(sql, data.reference, context.userId));
      if (!current) throw new Error("Commande introuvable.");
    }

    return { purchase: toPurchase(current), instructions };
  });

export const advancePremiumPurchaseOrder = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(advanceSchema)
  .handler(async ({ data, context }) => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const current = await ownedPurchase(sql, data.reference, context.userId);
    if (!current) throw new Error("Commande introuvable.");
    if (["payment_verified", "delivered", "rejected", "refunded"].includes(current.status)) {
      return toPurchase(current);
    }
    if (current.status === data.status) return toPurchase(current);

    const expectedStatus: Record<string, PurchaseStatus> = {
      instructions_requested: "created",
      proof_ready: "instructions_requested",
      verification_pending: "proof_ready",
    };
    if (current.status !== expectedStatus[data.status]) {
      throw new Error("Transition de commande invalide.");
    }

    if (data.status === "verification_pending") {
      if (!data.device) {
        throw new Error("La demande appareil sécurisée est requise avant vérification.");
      }
      if (!data.proofAttached || !data.proofDigest) {
        throw new Error("Une empreinte de preuve est requise avant vérification.");
      }
      if (!data.paymentReference) {
        throw new Error("La référence de transaction Mobile Money est requise.");
      }
    }

    const paymentReference = data.paymentReference
      ? normalizePaymentReference(data.paymentReference)
      : current.payment_reference;
    const proofDigest = data.proofDigest?.toLowerCase() ?? current.proof_digest;
    if (current.payment_reference && paymentReference !== current.payment_reference) {
      throw new Error("La référence de paiement ne peut plus être modifiée après soumission.");
    }
    if (current.proof_digest && proofDigest !== current.proof_digest) {
      throw new Error("La preuve de paiement ne peut plus être remplacée après soumission.");
    }

    const provider = current.payment_provider ?? paymentConfiguration().provider;
    if (data.status === "verification_pending" && !provider) {
      throw new Error("Le canal Mobile Money officiel n'est pas configuré côté serveur.");
    }

    try {
      const updated = await sql.query<PurchaseRow>(
        `with updated as (
           update purchase_orders
              set status = $3,
                  proof_attached = proof_attached or $4,
                  device_id = coalesce($5, device_id),
                  device_key_id = coalesce($6, device_key_id),
                  device_public_key = coalesce($7, device_public_key),
                  payment_provider = coalesce(payment_provider, $8),
                  payment_reference = coalesce(payment_reference, $9),
                  proof_digest = coalesce(proof_digest, $10),
                  payment_submitted_at = case
                    when $3 = 'verification_pending' then coalesce(payment_submitted_at, now())
                    else payment_submitted_at
                  end,
                  updated_at = now()
            where reference = $1
              and user_id = $2
              and status = $11
            returning *
         ), event as (
           insert into purchase_order_events (reference, actor_user_id, event_type, metadata)
           select reference,
                  $2,
                  status,
                  jsonb_build_object(
                    'proofAttached', proof_attached,
                    'proofDigest', proof_digest,
                    'paymentProvider', payment_provider,
                    'paymentReference', payment_reference,
                    'deviceBound', (device_id is not null and device_key_id is not null and device_public_key is not null)
                  )
             from updated
         )
         select * from updated`,
        [
          data.reference,
          context.userId,
          data.status,
          Boolean(data.proofAttached),
          data.device?.deviceId.toLowerCase() ?? null,
          data.device?.deviceKeyId ?? null,
          data.device?.publicKey ?? null,
          provider,
          paymentReference,
          proofDigest,
          expectedStatus[data.status],
        ],
      );
      const next = updated[0];
      if (next) return toPurchase(next);

      const latest = await ownedPurchase(sql, data.reference, context.userId);
      if (!latest) throw new Error("Commande introuvable.");
      if (latest.status === data.status) return toPurchase(latest);
      throw new Error("L'état de la commande a changé. Actualisez avant de continuer.");
    } catch (error) {
      if (duplicatePaymentEvidence(error)) {
        throw new Error("Cette référence ou cette preuve de paiement est déjà liée à une autre commande.");
      }
      throw error;
    }
  });

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
      return { purchase: toPurchase(current), revokedLicenses };
    }

    if (data.decision === "payment_verified") {
      if (current.status !== "verification_pending") {
        throw new Error("La commande doit être en vérification avant validation du paiement.");
      }
      if (!current.payment_reference || !current.proof_digest || !current.proof_attached) {
        throw new Error("La référence et la preuve de paiement doivent être présentes.");
      }
    }
    if (data.decision === "delivered") {
      if (current.status !== "payment_verified") {
        throw new Error("Le paiement doit être validé avant livraison.");
      }
      if (!current.device_id || !current.device_key_id || !current.device_public_key) {
        throw new Error("Aucune demande appareil sécurisée n'est liée à cette commande.");
      }
    }
    if (data.decision === "refunded" && current.status !== "delivered") {
      throw new Error("Seule une commande livrée peut être marquée remboursée.");
    }
    if (data.decision === "rejected" && ["delivered", "refunded"].includes(current.status)) {
      throw new Error("Une commande déjà livrée ou remboursée ne peut pas être rejetée.");
    }

    if (data.decision === "refunded") {
      const refunded = await sql.query<PurchaseRow & { revoked_licenses: number | string }>(
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
        return { purchase: toPurchase(latest), revokedLicenses: Number(count[0]?.count ?? 0) };
      }
      throw new Error("L'état de la commande a changé. Actualisez avant de continuer.");
    }

    const expectedStatus = current.status;
    const timestampColumn =
      data.decision === "payment_verified"
        ? "payment_verified_at"
        : data.decision === "delivered"
          ? "delivered_at"
          : "rejected_at";

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
    if (next) return { purchase: toPurchase(next), revokedLicenses: 0 };

    const latest = await purchaseByReference(sql, data.reference);
    if (!latest) throw new Error("Commande introuvable.");
    if (latest.status === data.decision) return { purchase: toPurchase(latest), revokedLicenses: 0 };
    throw new Error("L'état de la commande a changé. Actualisez avant de continuer.");
  });
