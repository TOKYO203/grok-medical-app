import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/* ============================================================================
   Button — composant pilote du Design System (Session A)
   ----------------------------------------------------------------------------
   Construit UNIQUEMENT sur les tokens de `src/styles/tokens.css` : aucun
   espacement, rayon, ombre ou couleur codés en dur.

   ⚠️ Le bouton historique de l'application reste `src/components/ui/button.tsx`
   (minuscule, API `variant/size` issue de `button-variants.ts`) : il n'est pas
   modifié ici pour ne pas entrer en conflit avec les chantiers parallèles.
   Les pilotes vivent donc dans `src/components/ui/ds/` : deux fichiers nommés
   `Button.tsx` et `button.tsx` dans le MÊME dossier sont refusés par TypeScript
   (TS1149, « differs only in casing »). Ce pilote ajoute l'état `loading`, les
   variantes sémantiques et les jetons ; la bascule des 25 appelants existants
   se fera dans une session dédiée.
   ============================================================================ */

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-fg hover:bg-[var(--button-primary-hover)]",
  secondary:
    "border-border bg-card text-fg shadow-[var(--sh-subtle)] hover:bg-secondary hover:shadow-[var(--sh-medium)]",
  ghost: "border-transparent bg-transparent text-fg hover:bg-secondary",
  danger:
    "border-transparent bg-[var(--tone-danger)] text-[var(--tone-danger-fg)] shadow-[var(--sh-subtle)] hover:bg-[var(--button-danger-hover)]",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "h-9 gap-[var(--sp-2)] rounded-[var(--r-sm)] px-[var(--sp-3)] text-sm",
  md: "h-11 gap-[var(--sp-2)] rounded-[var(--r-md)] px-[var(--sp-4)] text-sm",
  lg: "h-12 gap-[var(--sp-3)] rounded-[var(--r-lg)] px-[var(--sp-6)] text-base",
};

const BASE_CLASSES =
  "inline-flex select-none items-center justify-center whitespace-nowrap border font-medium " +
  "transition-[background-color,color,box-shadow,transform] duration-[var(--motion-quick)] ease-[var(--ease-out)] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg " +
  "active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100 " +
  "disabled:pointer-events-none disabled:opacity-45";

/**
 * Classes publiques du bouton — SOURCE UNIQUE.
 *
 * Exporté pour que les liens qui doivent avoir l'apparence d'un bouton
 * (`ButtonLink`, CTA de navigation) consomment exactement les mêmes jetons,
 * plutôt que de recopier des classes Tailwind brutes dans les pages. Toute
 * évolution visuelle du bouton se propage ainsi aux liens.
 */
export function buttonClasses({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
} = {}): string {
  return cn(
    BASE_CLASSES,
    VARIANT_CLASSES[variant],
    SIZE_CLASSES[size],
    fullWidth && "w-full",
    className,
  );
}

export type ButtonProps = ComponentProps<"button"> & {
  /** Apparence du bouton. `primary` par défaut. */
  variant?: ButtonVariant;
  /** Hauteur / densité. `md` par défaut (44 px, cible tactile). */
  size?: ButtonSize;
  /** Affiche le spinner, désactive le bouton et l'annonce aux lecteurs d'écran. */
  loading?: boolean;
  /** Texte annoncé pendant le chargement (visuellement masqué). */
  loadingLabel?: string;
  /** Occupe toute la largeur disponible. */
  fullWidth?: boolean;
};

function Spinner() {
  return (
    <svg
      className="size-4 shrink-0 animate-spin motion-reduce:animate-none"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  loadingLabel,
  fullWidth = false,
  disabled,
  className,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  const isDisabled = disabled === true || loading;

  return (
    <button
      {...props}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      data-variant={variant}
      data-size={size}
      data-loading={loading ? "true" : "false"}
      className={buttonClasses({ variant, size, fullWidth, className })}
    >
      {loading ? <Spinner /> : null}
      <span className={cn(loading && "opacity-80")}>{children}</span>
      {loading && loadingLabel ? <span className="sr-only">{loadingLabel}</span> : null}
    </button>
  );
}
