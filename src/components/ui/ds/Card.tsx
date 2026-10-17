import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/* ============================================================================
   Card — composant pilote du Design System (Session A)
   ----------------------------------------------------------------------------
   Surface de contenu neutre : rayon, ombre et padding viennent exclusivement des
   tokens (`--r-*`, `--sh-*`, `--sp-*`). Aucune couleur codée en dur.

   · `padding`   : none | sm | md | lg
   · `interactive` : affordance de survol (élévation + fond) ; le consommateur
                     reste responsable de la sémantique (lien, bouton, tabIndex).
   · `selected`  : état sélectionné (bordure + anneau `ring-primary`).
   ============================================================================ */

export type CardPadding = "none" | "sm" | "md" | "lg";

const PADDING_CLASSES: Record<CardPadding, string> = {
  none: "",
  sm: "p-[var(--sp-3)]",
  md: "p-[var(--sp-5)]",
  lg: "p-[var(--sp-8)]",
};

export type CardProps = ComponentProps<"div"> & {
  /** Padding interne. `md` par défaut (20 px). */
  padding?: CardPadding;
  /** Affordance de carte cliquable (survol) — purement visuelle. */
  interactive?: boolean;
  /** État sélectionné. */
  selected?: boolean;
};

export function Card({
  padding = "md",
  interactive = false,
  selected = false,
  className,
  ...props
}: CardProps) {
  return (
    <div
      {...props}
      data-interactive={interactive ? "true" : undefined}
      data-selected={selected ? "true" : undefined}
      className={cn(
        "relative rounded-[var(--r-lg)] border border-border bg-card text-fg shadow-[var(--sh-subtle)]",
        PADDING_CLASSES[padding],
        interactive &&
          "transition-[transform,box-shadow,background-color,border-color] duration-[var(--motion-quick)] ease-[var(--ease-out)] " +
            "hover:-translate-y-0.5 hover:bg-surface hover:shadow-[var(--sh-medium)] " +
            "motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        selected && "border-primary ring-2 ring-primary/40",
        className,
      )}
    />
  );
}
