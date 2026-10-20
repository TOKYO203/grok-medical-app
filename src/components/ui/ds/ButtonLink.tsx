import type { ComponentProps } from "react";
import { Link } from "@tanstack/react-router";
import { buttonClasses, type ButtonSize, type ButtonVariant } from "./Button";

/* ============================================================================
   ButtonLink — un LIEN qui a exactement l'apparence du bouton du Design System.
   ----------------------------------------------------------------------------
   Pourquoi ce composant : la navigation interne doit rester un `<Link>` (préchargement,
   historique, accessibilité, clic-milieu), mais une page ne doit pas recopier des
   classes Tailwind brutes pour imiter un bouton. `buttonClasses()` étant la source
   unique des classes, les deux composants ne peuvent pas diverger.

   ⚠️ Aucune couleur, aucun rayon, aucune ombre codés en dur ici : tout vient des
   variantes de `Button` (elles-mêmes construites sur `src/styles/tokens.css`).
   ============================================================================ */

export type ButtonLinkProps = ComponentProps<typeof Link> & {
  /** Apparence, identique à `Button`. */
  variant?: ButtonVariant;
  /** Hauteur / densité, identique à `Button`. */
  size?: ButtonSize;
  /** Occupe toute la largeur disponible. */
  fullWidth?: boolean;
};

export function ButtonLink({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      {...props}
      data-variant={variant}
      data-size={size}
      className={buttonClasses({ variant, size, fullWidth, className })}
    />
  );
}
