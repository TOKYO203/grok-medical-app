import { Link } from "@tanstack/react-router";
import { ChevronRight, Clock3, Lock } from "lucide-react";
import { DeckIcon } from "@/components/deck-icon";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { KIND_META, LEVEL_LABEL, type ContentItem, type ContentLink } from "@/lib/library/content-index";

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
}: {
  item: ContentItem;
  progress?: number;
  className?: string;
}) {
  const meta = KIND_META[item.kind];
  const showProgress = typeof progress === "number" && progress > 0;

  return (
    <ContentLinkWrap
      link={item.link}
      ariaLabel={`${meta.label} — ${item.title}`}
      className={cn(
        "optimus-card optimus-interactive-card group flex h-full flex-col p-4 text-left active:scale-[0.99]",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] shadow-[var(--shadow-border)]",
            item.locked ? "bg-secondary text-muted" : TONE[meta.tone],
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
                Premium
              </span>
            ) : null}
          </div>
          <h3 className="mt-2 truncate font-display text-lg font-medium tracking-tight text-fg">
            {item.title}
          </h3>
          <p className="mt-0.5 line-clamp-2 text-sm leading-relaxed text-muted">{item.subtitle}</p>
        </div>

        <ChevronRight
          className="mt-1 size-5 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </div>

      <div className="mt-auto flex items-center gap-3 pt-3 text-xs text-muted">
        <span className="truncate">{item.specialty}</span>
        <span className="text-border-strong" aria-hidden>
          ·
        </span>
        <span className="shrink-0">{item.metric}</span>
        <span className="ml-auto flex shrink-0 items-center gap-1">
          <Clock3 className="size-3.5" aria-hidden />
          {item.minutes} min
        </span>
      </div>

      {showProgress ? (
        <span className="mt-3 flex items-center gap-2">
          <Progress className="h-1.5 flex-1" value={progress} barClassName="optimus-progress-fill" />
          <span className="font-mono text-[11px] tabular-nums text-muted">{progress}%</span>
        </span>
      ) : null}
    </ContentLinkWrap>
  );
}
