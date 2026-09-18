import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  AlertTriangle,
  BookOpenCheck,
  Check,
  ExternalLink,
  Flag,
  ShieldCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import type { Source } from "@/core/types";
import { formatReviewDate, latestSourceReview, sourceHref } from "@/content/source-registry";
import {
  formatContentReport,
  REPORT_ISSUE_LABEL,
  REPORT_ISSUES,
  submitContentReport,
  type ContentReportInput,
  type ReportIssue,
} from "@/lib/content-reports";
import { cn } from "@/lib/utils";
import { useOptimus } from "@/state/store";

export type ReportTarget = Pick<
  ContentReportInput,
  "contentType" | "contentId" | "deckId" | "deckVersion" | "label"
>;

export function MedicalSources({
  sources,
  compact = false,
}: {
  sources: Source[];
  compact?: boolean;
}) {
  if (!sources.length) {
    return (
      <div className="mt-3 flex items-start gap-2 rounded-[var(--radius-md)] bg-warn/10 p-3 text-xs text-warn">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        Références éditoriales en cours de vérification.
      </div>
    );
  }

  const linked = sources.filter((source) => sourceHref(source)).length;
  const latestReview = latestSourceReview(sources);

  return (
    <details
      className={cn(
        "group overflow-hidden rounded-[var(--radius-lg)] bg-secondary shadow-[var(--shadow-border)]",
        compact ? "mt-4" : "mt-6",
      )}
    >
      <summary className="flex min-h-14 list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
          <BookOpenCheck className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">Références médicales</span>
          <span className="mt-0.5 block text-xs text-muted">
            {sources.length} référence{sources.length > 1 ? "s" : ""}
            {linked ? ` · ${linked} consultable${linked > 1 ? "s" : ""}` : ""}
          </span>
        </span>
        <span className="rounded-full bg-card px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-primary">
          Sourcé
        </span>
      </summary>

      <div className="border-t border-border px-4 pb-4 pt-3">
        {latestReview ? (
          <div className="mb-3 flex items-center gap-2 text-xs text-primary">
            <ShieldCheck className="size-4" />
            Liens officiels contrôlés le {formatReviewDate(latestReview)}
          </div>
        ) : null}
        <ol className="space-y-2">
          {sources.map((source, index) => {
            const href = sourceHref(source);
            const content = (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold text-fg">
                    {source.organization ?? source.title}
                    {source.year ? ` · ${source.year}` : ""}
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-muted">
                    {source.citation}
                  </span>
                  {source.doi ? (
                    <span className="mt-1 block font-mono text-[10px] text-subtle">
                      DOI {source.doi}
                    </span>
                  ) : null}
                </span>
                {href ? <ExternalLink className="mt-0.5 size-4 shrink-0 text-primary" /> : null}
              </>
            );
            return (
              <li key={`${source.title}-${source.citation}-${index}`}>
                {href ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="flex gap-3 rounded-[var(--radius-md)] bg-card p-3 transition-colors hover:bg-surface"
                  >
                    {content}
                  </a>
                ) : (
                  <div className="flex gap-3 rounded-[var(--radius-md)] bg-card p-3">{content}</div>
                )}
              </li>
            );
          })}
        </ol>
        <p className="mt-3 text-[11px] leading-relaxed text-subtle">
          Support pédagogique : confrontez toujours la conduite pratique au protocole local et au
          contexte du patient.
        </p>
      </div>
    </details>
  );
}

export function ContentTrustCard({ sources, report }: { sources: Source[]; report: ReportTarget }) {
  const linked = sources.filter((source) => sourceHref(source)).length;
  const latestReview = latestSourceReview(sources);

  return (
    <section className="mt-8 overflow-hidden rounded-[var(--radius-xl)] bg-card shadow-[var(--shadow-border)]">
      <div className="bg-[linear-gradient(135deg,var(--color-primary-soft),transparent_70%)] p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-primary text-primary-fg">
            <ShieldCheck className="size-5" />
          </span>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-primary">
              Qualité éditoriale
            </p>
            <h2 className="mt-1 font-display text-xl font-medium">
              Comprendre d’où vient l’information
            </h2>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-[var(--radius-md)] bg-bg/40 p-3">
            <p className="font-mono text-lg font-medium tabular-nums">{sources.length}</p>
            <p className="mt-0.5 text-xs text-muted">références citées</p>
          </div>
          <div className="rounded-[var(--radius-md)] bg-bg/40 p-3">
            <p className="font-mono text-lg font-medium tabular-nums">{linked}</p>
            <p className="mt-0.5 text-xs text-muted">liens consultables</p>
          </div>
        </div>
        {latestReview ? (
          <p className="mt-3 flex items-center gap-2 text-xs text-primary">
            <Check className="size-4" /> Liens contrôlés le {formatReviewDate(latestReview)}
          </p>
        ) : (
          <p className="mt-3 text-xs text-muted">Révision documentaire à compléter.</p>
        )}
      </div>
      <div className="p-4 pt-0">
        <MedicalSources sources={sources} compact />
        <ReportContentError target={report} className="mt-3 w-full" />
      </div>
    </section>
  );
}

export function ReportContentError({
  target,
  className,
}: {
  target: ReportTarget;
  className?: string;
}) {
  const addContact = useOptimus((state) => state.addContact);
  const [open, setOpen] = useState(false);
  const [issue, setIssue] = useState<ReportIssue | null>(null);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!issue || submitting) return;
    setSubmitting(true);
    const input: ContentReportInput = {
      ...target,
      issue,
      details: details.trim(),
      location: typeof window === "undefined" ? "" : window.location.pathname,
    };
    try {
      const result = await submitContentReport({ data: input });
      toast.success(`Signalement envoyé · ${result.reference}`);
    } catch {
      addContact("correction", formatContentReport(input));
      toast.success("Signalement conservé hors ligne");
    } finally {
      setSubmitting(false);
      setIssue(null);
      setDetails("");
      setOpen(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button variant="ghost" size="sm" className={cn("text-muted", className)}>
          <Flag className="size-4" />
          Signaler une erreur
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[88dvh] overflow-y-auto rounded-t-[28px] bg-bg-elevated p-5 shadow-2xl sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[var(--radius-xl)]">
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border-strong sm:hidden" />
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="font-display text-2xl font-medium">
                Signaler une erreur
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm leading-relaxed text-muted">
                Votre signalement aide à garder le contenu médical fiable.
              </Dialog.Description>
            </div>
            <Dialog.Close className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-muted hover:text-fg">
              <X className="size-4" />
              <span className="sr-only">Fermer</span>
            </Dialog.Close>
          </div>

          <p className="mt-5 line-clamp-2 rounded-[var(--radius-md)] bg-secondary p-3 text-xs leading-relaxed text-muted">
            {target.label}
          </p>

          <fieldset className="mt-5">
            <legend className="text-sm font-medium">Quel est le problème ?</legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {REPORT_ISSUES.map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-pressed={issue === item}
                  onClick={() => setIssue(item)}
                  className={cn(
                    "min-h-12 rounded-[var(--radius-md)] px-3 py-2.5 text-left text-sm shadow-[var(--shadow-border)] transition-colors",
                    issue === item
                      ? "bg-primary-soft text-fg"
                      : "bg-card text-muted hover:bg-surface",
                  )}
                >
                  {REPORT_ISSUE_LABEL[item]}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="mt-5 block text-sm font-medium" htmlFor="report-details">
            Précision <span className="font-normal text-subtle">(facultatif)</span>
          </label>
          <Textarea
            id="report-details"
            className="mt-2 min-h-24"
            value={details}
            maxLength={2_000}
            onChange={(event) => setDetails(event.target.value)}
            placeholder="Expliquez ce qui devrait être corrigé ou ajoutez une source…"
          />
          <p className="mt-2 text-xs text-subtle">
            Votre progression et vos réponses ne sont pas envoyées.
          </p>
          <Button
            className="mt-5 w-full"
            size="lg"
            disabled={!issue || submitting}
            onClick={() => void submit()}
          >
            {submitting ? "Envoi…" : "Envoyer le signalement"}
          </Button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
