import { Link } from "@tanstack/react-router";
import { ChevronRight, Clock3, Lock } from "lucide-react";
import { DeckIcon } from "@/components/deck-icon";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { KIND_META, LEVEL_LABEL, type ContentItem, type ContentLink } from "@/lib/library/content-index";
import { detectPreferredCurrency, formatPrice, PRICES_MGA } from "@/content/pricing";

const TONE: Record<string, string> = {
  primary: "bg-primary-soft text-primary",
  accent: "bg-accent/15 text-accent",
  info: "bg-primary-soft text-primary",
  neutral: "bg-secondary text-muted",
};

export function TypeBadge({ kind, className }: { kind: ContentItem["kind"]; className?: string }) {
  const meta = KIND_META[kind];
  return (
    <span className={cn("optimus-type-badge", TONE[meta.tone], className)}>
      <span aria-hidden>{meta.emoji}</span>
      {meta.short}
    </span>
  );
}

function ContentLinkWrap({
  link,
  className,
  children,
  ariaLabel,
}: {
  link: ContentLink;
  className?: string;
  children: React.ReactNode;
  ariaLabel?: string;
}) {
  if (link.to === "/parcours/$deckId") {
    return (
      <Link to={link.to} params={link.params} className={className} aria-label={ariaLabel}>
        {children}
      </Link>
    );
  }
  if (link.to === "/cas/$caseId") {
    return (
      <Link to={link.to} params={link.params} className={className} aria-label={ariaLabel}>
        {children}
      </Link>
    );
  }
  if (link.to === "/demarche/$id") {
    return (
      <Link to={link.to} params={link.params} className={className} aria-label={ariaLabel}>
        {children}
      </Link>
    );
  }
  return (
    <Link to={link.to} className={className} aria-label={ariaLabel}>
      {children}
    </Link>
  );
}

export function ContentCard({
  item,
  progress,
  className,
  /** Masque la spécialité dans le footer (utile quand elle est déjà dans l'en-tête de groupe). */
  showSpecialty = true,
  /** Habillage « bibliothèque » : filet doré + halo accent au survol. */
  premium = false,
  /** Badge « Nouveau » : contenu débloqué jamais exploré par ce profil (D38). */
  isNew = false,
}: {
  item: ContentItem;
  progress?: number;
  className?: string;
  showSpecialty?: boolean;
  premium?: boolean;
  isNew?: boolean;
}) {
  const meta = KIND_META[item.kind];
  const showProgress = typeof progress === "number" && progress > 0;

  return (
    <ContentLinkWrap
      link={item.link}
      ariaLabel={`${meta.label} — ${item.title}`}
      className={cn(
        "optimus-card optimus-interactive-card group flex h-full flex-col p-4 text-left active:scale-[0.99]",
        premium && !item.locked && "optimus-interactive-card--premium",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "optimus-card-icon flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] shadow-[var(--shadow-border)]",
            item.locked ? "bg-secondary text-muted" : TONE[meta.tone],
            /* Habillage Bibliothèque : tuile d'icône or (cohérence avec la pastille
               de groupe monochrome). N'affecte que les cartes `premium`. */
            premium && !item.locked && "optimus-card-icon--gold",
          )}
        >
          {item.emoji ? (
            <span className="text-lg" aria-hidden>
              {item.emoji}
            </span>
          ) : (
            <DeckIcon name={item.icon} />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <TypeBadge kind={item.kind} />
            {item.level ? (
              <span className="optimus-type-badge bg-secondary text-muted">
                {LEVEL_LABEL[item.level]}
              </span>
            ) : null}
            {item.locked ? (
              <span className="optimus-type-badge bg-secondary text-muted">
                <Lock className="size-3" aria-hidden />
                Débloquer
              </span>
            ) : null}
            {item.locked && item.kind === "deck" ? (
              <span className="optimus-type-badge bg-primary-soft text-primary">
                {formatPrice(PRICES_MGA.deck, detectPreferredCurrency())}
              </span>
            ) : null}
            {isNew && !item.locked ? (
              <span className="optimus-type-badge bg-warn/15 text-warn">Nouveau</span>
            ) : null}
          </div>
          <h3 className="mt-2 truncate font-display text-lg font-medium tracking-tight text-fg">
            {item.title}
          </h3>
          <p className="mt-0.5 line-clamp-2 text-sm leading-relaxed text-muted">{item.subtitle}</p>
        </div>

        <ChevronRight className="optimus-chevron mt-1 size-5 shrink-0 text-subtle" aria-hidden />
      </div>

      <div className="mt-auto flex items-center gap-3 pt-3 text-xs text-muted">
        {showSpecialty ? (
          <>
            <span className="truncate">{item.specialty}</span>
            <span className="text-border-strong" aria-hidden>
              ·
            </span>
          </>
        ) : null}
        <span className="shrink-0">{item.metric}</span>
        <span className="ml-auto flex shrink-0 items-center gap-1">
          <Clock3 className="size-3.5" aria-hidden />
          {item.minutes} min
        </span>
      </div>

      {showProgress ? (
        <span className="mt-3 flex items-center gap-2">
          <Progress className="h-1.5 flex-1" value={progress} barClassName="optimus-progress-fill" />
          <span className="optimus-kpi font-mono text-[11px] tabular-nums">{progress}%</span>
        </span>
      ) : null}
    </ContentLinkWrap>
  );
}
