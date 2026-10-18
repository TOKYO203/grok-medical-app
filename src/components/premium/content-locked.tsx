import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Lock } from "lucide-react";
import { buttonVariants } from "@/components/ui/button-variants";
import { useI18n } from "@/i18n";

/**
 * BANDEAU « Premium requis » — état partagé par les deux surfaces dont le
 * contenu est servi par le garde serveur :
 *   • `/pathologie/$slug` (fiches de nosographie) ;
 *   • `/signes` (cas de raisonnement inversé).
 *
 * ⚠️ Ce panneau n'est PAS le mécanisme de protection : il ne fait qu'expliquer
 * un 401. Le contenu n'est même pas téléchargé — il n'existe aucun octet de la
 * fiche dans la page. C'est toute la différence avec l'ancien verrouillage
 * « cosmétique », qui masquait un contenu déjà livré au navigateur.
 *
 * Il accepte un APERÇU public (titre, objectif) servi par
 * `/content/previews/<id>.json` : assez pour savoir de quelle fiche on parle,
 * jamais assez pour la lire.
 */
export function ContentLocked({
  preview,
  sessionExpired = false,
  children,
}: {
  preview?: { title?: string; subtitle?: string; objective?: string };
  sessionExpired?: boolean;
  children?: ReactNode;
}) {
  const { t } = useI18n();
  const hasPreview = Boolean(preview?.title || preview?.objective);

  return (
    <section
      data-content-locked="premium"
      data-content-locked-reason={sessionExpired ? "session-expired" : "no-license"}
      className="mt-6 overflow-hidden rounded-[var(--radius-xl)] bg-card shadow-[var(--shadow-md)]"
    >
      <div className="premium-hero p-5 text-primary-fg">
        <Lock className="size-6" aria-hidden />
        <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.16em] opacity-70">
          {t("content.lockedKicker")}
        </p>
        <h2 className="mt-1 font-display text-2xl font-medium">
          {hasPreview && preview?.title ? preview.title : t("content.lockedTitle")}
        </h2>
        <p className="mt-2 text-sm leading-relaxed opacity-80">
          {sessionExpired ? t("content.lockedSession") : t("content.lockedBody")}
        </p>
      </div>

      <div className="p-5">
        {hasPreview ? (
          <div className="mb-4" data-content-preview>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-subtle">
              {t("content.preview")}
            </p>
            {preview?.subtitle ? (
              <p className="mt-1 text-sm font-medium text-fg">{preview.subtitle}</p>
            ) : null}
            {preview?.objective ? (
              <p className="mt-2 text-[13px] leading-relaxed text-muted">{preview.objective}</p>
            ) : null}
          </div>
        ) : null}

        <Link to="/pro" className={buttonVariants({ size: "lg", className: "w-full" })}>
          {t("content.unlock")}
          <ArrowRight className="size-4" aria-hidden />
        </Link>

        {children ? <div className="mt-3 text-center text-sm text-muted">{children}</div> : null}
      </div>
    </section>
  );
}
