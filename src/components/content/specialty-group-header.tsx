import type { CSSProperties } from "react";
import type { ContentItem, ContentKind } from "@/lib/library/content-index";
import { specialtyEmoji, specialtyTint } from "@/lib/library/specialty-helpers";
import { cn } from "@/lib/utils";

/** Libellés de comptage (minuscules, au singulier/pluriel) pour le kicker de groupe. */
const KIND_NOUN: Record<ContentKind, [singular: string, plural: string]> = {
  deck: ["deck", "decks"],
  case: ["cas", "cas"],
  diagnostic: ["démarche", "démarches"],
  tool: ["outil", "outils"],
};

/** Ordre d'affichage stable des types dans le kicker. */
const KIND_SEQUENCE: ContentKind[] = ["deck", "case", "diagnostic", "tool"];

/** Garde-fou de lisibilité : au-delà, le kicker bascule sur un simple total. */
const KICKER_MAX_CHARS = 40;

function countByKind(items: ContentItem[]): Map<ContentKind, number> {
  const counts = new Map<ContentKind, number>();
  for (const item of items) counts.set(item.kind, (counts.get(item.kind) ?? 0) + 1);
  return counts;
}

/**
 * Récapitulatif du groupe sur UNE ligne : « 36 decks · 2 cas ».
 * Si la composition dépasse {@link KICKER_MAX_CHARS}, on retombe sur « 38 éléments »
 * pour ne jamais couper le kicker sur mobile.
 */
export function groupKicker(items: ContentItem[]): string {
  const counts = countByKind(items);
  const parts = KIND_SEQUENCE.filter((kind) => counts.has(kind)).map((kind) => {
    const n = counts.get(kind) ?? 0;
    const [singular, plural] = KIND_NOUN[kind];
    return `${n} ${n > 1 ? plural : singular}`;
  });
  const composed = parts.join(" · ");
  if (composed.length > KICKER_MAX_CHARS) {
    return `${items.length} élément${items.length > 1 ? "s" : ""}`;
  }
  return composed || `${items.length} élément${items.length > 1 ? "s" : ""}`;
}

/**
 * Avancement agrégé du groupe : moyenne des Decks (0 % compté pour les non entamés).
 * Les cas/démarches/outils n'ont pas de progression par Deck et sont donc exclus.
 */
export function groupAggregateProgress(
  items: ContentItem[],
  progressById: Map<string, number>,
): number {
  const decks = items.filter((item) => item.kind === "deck");
  if (decks.length === 0) return 0;
  const total = decks.reduce((sum, deck) => sum + (progressById.get(deck.id) ?? 0), 0);
  return Math.round(total / decks.length);
}

/**
 * En-tête éditorial de groupe de spécialité (pastille emoji teintée, titre, kicker
 * mono-ligne, compteur et barre d'avancement agrégée). Rendu collant par le parent.
 */
export function SpecialtyGroupHeader({
  specialty,
  items,
  progressById,
  className,
}: {
  specialty: string;
  items: ContentItem[];
  progressById: Map<string, number>;
  className?: string;
}) {
  const emoji = specialtyEmoji(specialty);
  const tint = specialtyTint(specialty);
  const kicker = groupKicker(items);
  const progress = groupAggregateProgress(items, progressById);
  const hasDecks = items.some((item) => item.kind === "deck");
  const titleId = `bib-group-${specialtySlugSafe(specialty)}`;

  return (
    <div className={cn("optimus-group-header", className)}>
      <div className="flex items-center gap-3">
        <span
          className="optimus-group-badge"
          style={{ "--group-hue": tint } as CSSProperties}
          aria-hidden
        >
          {emoji}
        </span>
        <div className="min-w-0 flex-1">
          <h3
            id={titleId}
            className="truncate font-display text-[15px] font-medium tracking-tight text-fg md:text-base"
          >
            {specialty}
          </h3>
          <p className="truncate text-[11px] text-subtle">{kicker}</p>
        </div>
        {hasDecks && progress > 0 ? (
          <span className="shrink-0 font-mono text-[11px] tabular-nums text-accent">
            {progress}%
          </span>
        ) : null}
        <span className="shrink-0 font-mono text-sm tabular-nums text-muted">{items.length}</span>
      </div>
      {hasDecks ? (
        <div
          className="optimus-group-progress"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Avancement ${specialty}`}
        >
          <span style={{ inlineSize: `${progress}%` }} />
        </div>
      ) : null}
    </div>
  );
}

/** Petit slug local (sans dépendre du préfixe de page) pour l'id du titre. */
function specialtySlugSafe(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
