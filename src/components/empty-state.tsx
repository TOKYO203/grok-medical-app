import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * Empty state engageant (D37 — Session 16) : icône, titre, description
 * et action unique — pour les vides réels (révisions à jour) comme pour
 * les vides de filtrage (aucun résultat). Le contenu reste français
 * (précédent Session 11 : libellés éditoriaux non i18n-és).
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("optimus-card p-8 text-center", className)}>
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary shadow-[var(--shadow-border)]">
        <Icon className="size-6" strokeWidth={1.7} aria-hidden />
      </span>
      <h2 className="mt-4 font-display text-xl font-medium tracking-tight text-fg">{title}</h2>
      <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-muted">{description}</p>
      {action ? <div className="mt-5 flex justify-center gap-2">{action}</div> : null}
    </div>
  );
}
