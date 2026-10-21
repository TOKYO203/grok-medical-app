/**
 * Statut de revue médicale par deck (B13).
 *
 * Miroir compact du champ medical_review de
 * src/content/data/editorial-registry.json, destiné à l'affichage côté UI.
 * La synchronisation est verrouillée par scripts/deck-review-status.test.mjs :
 * ne jamais éditer l'un sans l'autre.
 */
export type MedicalReviewStatus =
  | "structural_only"
  | "priority_items_reviewed"
  | "fully_reviewed";

export type DeckMedicalReview = {
  status: MedicalReviewStatus;
  /** Date du dernier point de relecture (ISO) — null tant que la relecture n'a pas commencé. */
  verifiedAt: string | null;
};

export const DECK_MEDICAL_REVIEW: Record<string, DeckMedicalReview> = {
  "anatomie": { status: "structural_only", verifiedAt: null },
  "cardio": { status: "priority_items_reviewed", verifiedAt: "2026-09-14" },
  "cardio-sca-l5": { status: "structural_only", verifiedAt: null },
  "cardio-sca-l2": { status: "structural_only", verifiedAt: null },
  "cardio-sca-l3": { status: "structural_only", verifiedAt: null },
  "cardio-sca-l4": { status: "structural_only", verifiedAt: null },
  "cardio-sca-int": { status: "structural_only", verifiedAt: null },
  "cardio-ic-l2": { status: "structural_only", verifiedAt: null },
  "cardio-ic-l3": { status: "structural_only", verifiedAt: null },
  "cardio-ic-l4": { status: "structural_only", verifiedAt: null },
  "cardio-ic-l5": { status: "structural_only", verifiedAt: null },
  "cardio-ic-int": { status: "structural_only", verifiedAt: null },
  "cardio-hta-l2": { status: "structural_only", verifiedAt: null },
  "cardio-hta-l3": { status: "structural_only", verifiedAt: null },
  "cardio-hta-l4": { status: "structural_only", verifiedAt: null },
  "cardio-hta-l5": { status: "structural_only", verifiedAt: null },
  "cardio-hta-int": { status: "structural_only", verifiedAt: null },
  "cardio-fa-l2": { status: "structural_only", verifiedAt: null },
  "cardio-fa-l3": { status: "structural_only", verifiedAt: null },
  "cardio-fa-l4": { status: "structural_only", verifiedAt: null },
  "cardio-fa-l5": { status: "structural_only", verifiedAt: null },
  "cardio-fa-int": { status: "structural_only", verifiedAt: null },
  "cardio-valv-l2": { status: "structural_only", verifiedAt: null },
  "cardio-valv-l3": { status: "structural_only", verifiedAt: null },
  "cardio-valv-l4": { status: "structural_only", verifiedAt: null },
  "cardio-valv-l5": { status: "structural_only", verifiedAt: null },
  "cardio-valv-int": { status: "structural_only", verifiedAt: null },
  "cardio-arret-l2": { status: "structural_only", verifiedAt: null },
  "cardio-arret-l3": { status: "structural_only", verifiedAt: null },
  "cardio-arret-l4": { status: "structural_only", verifiedAt: null },
  "cardio-arret-l5": { status: "structural_only", verifiedAt: null },
  "cardio-arret-int": { status: "structural_only", verifiedAt: null },
  "cardio-oap-l2": { status: "structural_only", verifiedAt: null },
  "cardio-oap-l3": { status: "structural_only", verifiedAt: null },
  "cardio-oap-l4": { status: "structural_only", verifiedAt: null },
  "cardio-oap-l5": { status: "structural_only", verifiedAt: null },
  "cardio-oap-int": { status: "structural_only", verifiedAt: null },
  "dermato": { status: "priority_items_reviewed", verifiedAt: "2026-09-14" },
  "infectio": { status: "priority_items_reviewed", verifiedAt: "2026-09-14" },
  "neuro": { status: "priority_items_reviewed", verifiedAt: "2026-09-14" },
  "pharmaco": { status: "priority_items_reviewed", verifiedAt: "2026-09-14" },
  "physio": { status: "structural_only", verifiedAt: null },
  "semio": { status: "priority_items_reviewed", verifiedAt: "2026-09-14" },
  "tropical": { status: "priority_items_reviewed", verifiedAt: "2026-09-14" },
  "urgences": { status: "priority_items_reviewed", verifiedAt: "2026-09-14" },
  "neuro-avc-l2": { status: "structural_only", verifiedAt: null },
  "neuro-epi-l3": { status: "structural_only", verifiedAt: null },
  "neuro-avc-l3": { status: "structural_only", verifiedAt: null },
  "neuro-avc-l4": { status: "structural_only", verifiedAt: null },
  "neuro-avc-l5": { status: "structural_only", verifiedAt: null },
  "neuro-avc-int": { status: "structural_only", verifiedAt: null },
  "neuro-epi-l4": { status: "structural_only", verifiedAt: null },
  "neuro-epi-l5": { status: "structural_only", verifiedAt: null },
  "neuro-epi-int": { status: "structural_only", verifiedAt: null },
};

export const REVIEW_STATUS_LABEL: Record<MedicalReviewStatus, string> = {
  structural_only: "structure vérifiée, relecture médicale prioritaire en cours",
  priority_items_reviewed: "items prioritaires relus par un médecin",
  fully_reviewed: "revue médicale complète",
};
