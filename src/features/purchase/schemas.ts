/**
 * Schemas zod partages entre les server fns de la feature purchase.
 * Extraits de purchase-orders.ts (PR 2/3).
 */
import { z } from "zod";
import { PURCHASE_REFERENCE_PATTERN } from "@/content/purchase-order";

export const specialtySchema = z.enum([
  "neurologie",
  "cardiologie",
  "infectiologie",
  "urgences",
  "dermatologie",
]);

export const referenceSchema = z.string().regex(PURCHASE_REFERENCE_PATTERN);

export const createSchema = z.object({
  clientRequestId: z.string().uuid(),
  offer: z.enum(["deck", "specialty", "subscription"]),
  specialty: specialtySchema.optional(),
  deckNumber: z.number().int().min(1).max(10).optional(),
});

export const clientStatusSchema = z.enum([
  "instructions_requested",
  "proof_ready",
  "verification_pending",
]);

export const advanceSchema = z.object({
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

export const instructionsSchema = z.object({ reference: referenceSchema });

export const adminDecisionSchema = z.object({
  reference: referenceSchema,
  decision: z.enum(["payment_verified", "delivered", "rejected", "refunded"]),
  note: z.string().trim().max(2_000).optional(),
});
