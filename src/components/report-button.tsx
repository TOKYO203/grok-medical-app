import { useState } from "react";
import { Flag, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type ReportReason = "medical_error" | "outdated_source" | "typo" | "other";

const REASONS: { id: ReportReason; label: string }[] = [
  { id: "medical_error", label: "Erreur médicale" },
  { id: "outdated_source", label: "Source obsolète" },
  { id: "typo", label: "Faute d'orthographe" },
  { id: "other", label: "Autre" },
];

type Props = {
  questionId: string;
  deckId: string;
  deckTitle: string;
};

export function ReportButton({ questionId, deckId, deckTitle }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>("medical_error");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (details.trim().length < 10) {
      toast.error("Merci de détailler un peu plus (min. 10 caractères).");
      return;
    }
    setSubmitting(true);
    try {
      const message = [
        `🚩 SIGNALEMENT OPTIMUS`,
        ``,
        `Deck : ${deckTitle}`,
        `Deck ID : ${deckId}`,
        `Question : ${questionId}`,
        `Type : ${REASONS.find((r) => r.id === reason)?.label ?? reason}`,
        ``,
        `Détails :`,
        details.trim(),
        ``,
        `— Envoyé depuis l'app Optimus`,
      ].join("\n");

      // Ouvre WhatsApp avec le message pré-rempli
      const url = `https://wa.me/261341995741?text=${encodeURIComponent(message)}`;
      window.open(url, "_blank", "noopener,noreferrer");

      toast.success("Merci ! Ton signalement va nous aider à améliorer la qualité.");
      setOpen(false);
      setDetails("");
      setReason("medical_error");
    } catch {
      toast.error("Impossible d'ouvrir WhatsApp. Réessaie.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Signaler une erreur sur cette question"
        className="inline-flex items-center gap-1 text-[11px] text-subtle transition-colors hover:text-amber-400"
      >
        <Flag className="size-3" aria-hidden />
        Signaler
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-t-[var(--radius-xl)] bg-bg p-5 shadow-[var(--shadow-md)] sm:rounded-[var(--radius-xl)]">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-display text-lg font-medium">Signaler une erreur</h3>
                <p className="mt-0.5 text-xs text-muted">
                  Ta contribution améliore la qualité pour tous.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fermer"
                className="flex size-8 items-center justify-center rounded-full text-muted hover:text-fg"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>

            <div className="mt-4">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted">
                Type de problème
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {REASONS.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setReason(r.id)}
                    className={cn(
                      "h-9 rounded-full px-3 text-xs transition-colors",
                      reason === r.id
                        ? "bg-primary text-primary-fg"
                        : "bg-card text-fg shadow-[var(--shadow-border)]",
                    )}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <label
                htmlFor="report-details"
                className="text-[11px] font-medium uppercase tracking-wider text-muted"
              >
                Détails
              </label>
              <textarea
                id="report-details"
                rows={4}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Décris le problème (min. 10 caractères)..."
                className="mt-2 w-full rounded-[var(--radius-md)] bg-card p-3 text-sm shadow-[var(--shadow-border)] outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex-1 rounded-[var(--radius-md)] bg-secondary px-4 py-3 text-sm font-medium transition-colors hover:bg-secondary/80"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={submitting || details.trim().length < 10}
                onClick={submit}
                className={cn(
                  "flex-1 rounded-[var(--radius-md)] bg-primary px-4 py-3 text-sm font-medium text-primary-fg transition-opacity",
                  submitting || details.trim().length < 10
                    ? "cursor-not-allowed opacity-40"
                    : "hover:opacity-90",
                )}
              >
                {submitting ? "Envoi…" : "Envoyer"}
              </button>
            </div>

            <p className="mt-3 text-center text-[10px] text-subtle">
              Signalement envoyé via WhatsApp à la Fondation Optimus
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
