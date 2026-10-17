import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/* ============================================================================
   Badge — composant pilote du Design System (Session A)
   ----------------------------------------------------------------------------
   Étiquette courte, non interactive. Les 5 tones sémantiques (danger, warn,
   info, success, accent) + `neutral` consomment les tokens `--tone-*`
   (`soft` en fond, `border` en liseré, le ton lui-même en texte) : le rendu
   suit donc le thème clair / sombre sans variante conditionnelle.
   ============================================================================ */

export type BadgeTone = "neutral" | "accent" | "success" | "warn" | "danger" | "info";
export type BadgeSize = "sm" | "md";

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: "border-border bg-secondary text-muted",
  accent:
    "border-[var(--tone-accent-border)] bg-[var(--tone-accent-soft)] text-[var(--tone-accent)]",
  success:
    "border-[var(--tone-success-border)] bg-[var(--tone-success-soft)] text-[var(--tone-success)]",
  warn: "border-[var(--tone-warn-border)] bg-[var(--tone-warn-soft)] text-[var(--tone-warn)]",
  danger:
    "border-[var(--tone-danger-border)] bg-[var(--tone-danger-soft)] text-[var(--tone-danger)]",
  info: "border-[var(--tone-info-border)] bg-[var(--tone-info-soft)] text-[var(--tone-info)]",
};

const SIZE_CLASSES: Record<BadgeSize, string> = {
  sm: "h-5 gap-[var(--sp-1)] px-[var(--sp-2)] text-[10px]",
  md: "h-6 gap-[var(--sp-1)] px-[var(--sp-2)] text-[11px]",
};

export type BadgeProps = ComponentProps<"span"> & {
  /** Ton sémantique. `neutral` par défaut. */
  tone?: BadgeTone;
  /** Densité. `sm` par défaut. */
  size?: BadgeSize;
  /** Pastille de rappel colorée avant le libellé. */
  dot?: boolean;
};

export function Badge({
  tone = "neutral",
  size = "sm",
  dot = false,
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      {...props}
      data-tone={tone}
      data-size={size}
      className={cn(
        "inline-flex shrink-0 items-center rounded-[var(--r-pill)] border font-semibold uppercase leading-none tracking-[0.08em]",
        TONE_CLASSES[tone],
        SIZE_CLASSES[size],
        className,
      )}
    >
      {dot ? (
        <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current opacity-80" />
      ) : null}
      {children}
    </span>
  );
}
