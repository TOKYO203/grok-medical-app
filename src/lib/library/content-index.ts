import type { ClinicalCase, Competency, Deck, DiagnosticCase, Entitlement } from "@/core/types";
import { CLINICAL_CASES, DIAGNOSTIC_CASES } from "@/content/catalog";
import { hasEntitlement } from "@/state/store";

export type ContentKind = "deck" | "case" | "diagnostic" | "tool";
export type ContentLevel = "intro" | "intermediate" | "advanced";

/** Lien typé vers une route de contenu. */
export type ContentLink =
  | { to: "/parcours/$deckId"; params: { deckId: string } }
  | { to: "/cas/$caseId"; params: { caseId: string } }
  | { to: "/calculateurs" }
  | { to: "/examen" }
  | { to: "/import" }
  | { to: "/parcours" };

export type ContentItem = {
  id: string;
  kind: ContentKind;
  title: string;
  subtitle: string;
  specialty: string;
  year: number | null;
  level: ContentLevel | null;
  competencies: Competency[];
  icon: string;
  emoji?: string;
  metric: string;
  minutes: number;
  link: ContentLink;
  locked: boolean;
};

export const KIND_META: Record<
  ContentKind,
  { label: string; short: string; emoji: string; tone: string }
> = {
  deck: { label: "Deck", short: "Deck", emoji: "📚", tone: "primary" },
  case: { label: "Cas clinique", short: "Cas", emoji: "🩺", tone: "accent" },
  diagnostic: { label: "Démarche", short: "Démarche", emoji: "🧭", tone: "info" },
  tool: { label: "Outil clinique", short: "Outil", emoji: "🧮", tone: "neutral" },
};

export const LEVEL_LABEL: Record<ContentLevel, string> = {
  intro: "Découverte",
  intermediate: "Consolidation",
  advanced: "Approfondissement",
};

export function specialtyCode(specialty: string): string {
  const normalized = specialty.toLowerCase();
  if (normalized.includes("cardio")) return "CARDIO";
  if (normalized.includes("neuro")) return "NEURO";
  if (normalized.includes("infectio")) return "INFECTIO";
  if (normalized.includes("urgence")) return "URGENCES";
  if (normalized.includes("dermato")) return "DERMATO";
  return specialty.toUpperCase();
}

/**
 * Produit « pack spécialité complète » (ex. `CARDIO_PACK_15`).
 *
 * Source unique de vérité alignée sur `orderProduct()` (src/content/purchase-order.ts)
 * qui émet `{CODE}_PACK_15` depuis la migration « 15 decks/spécialité » (commit 432e196).
 * Les anciens contrôles `_PACK_10` ne pouvaient jamais correspondre à une commande :
 * un acheteur d'un pack ne débloquait donc ni les cas cliniques ni les démarches.
 */
export function specialtyPackProduct(specialty: string): string {
  return `${specialtyCode(specialty)}_PACK_15`;
}

export function caseAccessible(clinical: ClinicalCase, entitlements: Entitlement[]): boolean {
  return (
    clinical.access === "free" ||
    hasEntitlement("OPTIMUS_PRO", entitlements) ||
    hasEntitlement(specialtyPackProduct(clinical.specialty), entitlements)
  );
}

function deckToItem(deck: Deck, entitlements: Entitlement[], tier: string): ContentItem {
  const count = deck.questions.length;
  return {
    id: `deck:${deck.id}`,
    kind: "deck",
    title: deck.title,
    subtitle: deck.subtitle || deck.subject,
    specialty: deck.specialty,
    year: deck.studyYear || null,
    level: deck.difficulty,
    competencies: deck.competencies,
    icon: deck.icon,
    metric: `${count} question${count > 1 ? "s" : ""}`,
    minutes: Math.max(3, Math.round(count * 0.7)),
    link: { to: "/parcours/$deckId", params: { deckId: deck.id } },
    locked: !isDeckAccessible(deck, entitlements, tier),
  };
}

function isDeckAccessible(deck: Deck, entitlements: Entitlement[], tier: string): boolean {
  if (deck.access_policy.tier === "free") return true;
  if (tier === "pro") return true;
  return (
    hasEntitlement("OPTIMUS_PRO", entitlements) ||
    hasEntitlement(deck.access_policy.entitlement, entitlements)
  );
}

function caseToItem(clinical: ClinicalCase, entitlements: Entitlement[]): ContentItem {
  const steps = clinical.steps.length;
  return {
    id: `case:${clinical.id}`,
    kind: "case",
    title: clinical.title,
    subtitle: clinical.summary,
    specialty: clinical.specialty,
    year: clinical.studyYear || null,
    level:
      clinical.difficulty === "advanced"
        ? "advanced"
        : clinical.difficulty === "intro"
          ? "intro"
          : "intermediate",
    competencies: ["clinical_reasoning", "diagnosis"],
    icon: "stethoscope",
    metric: `${steps} étape${steps > 1 ? "s" : ""}`,
    minutes: Math.max(4, steps * 2),
    link: { to: "/cas/$caseId", params: { caseId: clinical.id } },
    locked: !caseAccessible(clinical, entitlements),
  };
}

function diagnosticToItem(diagnostic: DiagnosticCase): ContentItem {
  const steps = diagnostic.steps.length;
  return {
    id: `diagnostic:${diagnostic.id}`,
    kind: "diagnostic",
    title: diagnostic.title,
    subtitle: diagnostic.vignette,
    specialty: diagnostic.specialty,
    year: null,
    level: "intermediate",
    competencies: ["diagnostic_orientation", "clinical_reasoning"],
    icon: "scan",
    metric: `${steps} étape${steps > 1 ? "s" : ""}`,
    minutes: Math.max(4, steps * 2),
    link: { to: "/calculateurs" },
    locked: false,
  };
}

const TOOLS: ContentItem[] = [
  {
    id: "tool:calculateurs",
    kind: "tool",
    title: "Calculateurs cliniques",
    subtitle: "DFG, clairance, scores et règles de décision",
    specialty: "Outils",
    year: null,
    level: null,
    competencies: ["management"],
    icon: "activity",
    emoji: "🧮",
    metric: "Outils",
    minutes: 3,
    link: { to: "/calculateurs" },
    locked: false,
  },
  {
    id: "tool:examen",
    kind: "tool",
    title: "Examen blanc",
    subtitle: "Épreuve chronométrée tous decks confondus",
    specialty: "Outils",
    year: null,
    level: null,
    competencies: ["clinical_reasoning"],
    icon: "clipboard",
    emoji: "📝",
    metric: "Épreuve",
    minutes: 15,
    link: { to: "/examen" },
    locked: false,
  },
  {
    id: "tool:import",
    kind: "tool",
    title: "Importer un deck",
    subtitle: "Ajouter un deck premium signé ou lisible",
    specialty: "Outils",
    year: null,
    level: null,
    competencies: ["management"],
    icon: "globe",
    emoji: "📥",
    metric: "Gestion",
    minutes: 2,
    link: { to: "/import" },
    locked: false,
  },
];

export function buildContentIndex({
  decks,
  entitlements,
  tier,
  includeTools = true,
}: {
  decks: Deck[];
  entitlements: Entitlement[];
  tier: string;
  includeTools?: boolean;
}): ContentItem[] {
  const items: ContentItem[] = [
    ...decks.map((deck) => deckToItem(deck, entitlements, tier)),
    ...CLINICAL_CASES.map((clinical) => caseToItem(clinical, entitlements)),
    ...DIAGNOSTIC_CASES.map(diagnosticToItem),
    ...(includeTools ? TOOLS : []),
  ];
  return items;
}

export function uniqueSorted(values: (string | number | null)[]): string[] {
  return [...new Set(values.filter((v): v is string | number => v !== null && v !== ""))]
    .map((v) => String(v))
    .sort((a, b) => a.localeCompare(b, "fr"));
}
