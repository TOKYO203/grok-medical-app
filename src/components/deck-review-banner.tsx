import { AlertTriangle, CheckCircle2, FileEdit } from "lucide-react";
import type { Deck } from "@/core/types";
import { cn } from "@/lib/utils";

type Props = {
  deck: Deck;
  /** Si true, affiche le bandeau même pour les brouillons (mode admin) */
  isAdmin?: boolean;
};

export function DeckReviewBanner({ deck, isAdmin = false }: Props) {
  const status = deck.status ?? "published";

  // Brouillon
  if (status === "draft" || status === "deprecated") {
    if (!isAdmin) return null;
    return (
      <div className="mb-4 flex items-start gap-3 rounded-[var(--radius-lg)] border-2 border-red-500/50 bg-red-500/10 p-4">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-red-500" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-red-400">
            ⚠️ BROUILLON — Non validé médicalement
          </p>
          <p className="mt-1 text-xs text-red-300/80">
            Ce contenu N'EST PAS visible par les utilisateurs. Il doit être relu et validé par un
            médecin inscrit à l'Ordre avant publication.
          </p>
          {deck.review?.notes ? (
            <p className="mt-2 text-xs text-red-300/60">Note : {deck.review.notes}</p>
          ) : null}
        </div>
      </div>
    );
  }

  // En relecture
  if (status === "in_review") {
    return (
      <div className="mb-4 flex items-start gap-3 rounded-[var(--radius-lg)] border border-amber-500/40 bg-amber-500/10 p-4">
        <FileEdit className="mt-0.5 size-5 shrink-0 text-amber-500" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-amber-400">Contenu en cours de relecture</p>
          <p className="mt-1 text-xs text-amber-300/80">
            Ce deck est en cours de validation médicale. Il sera publié prochainement.
          </p>
        </div>
      </div>
    );
  }

  // Publié avec review
  if (deck.review && deck.review.reviewedBy) {
    return (
      <div
        className={cn(
          "mb-4 flex items-start gap-3 rounded-[var(--radius-lg)] border border-emerald-500/30 bg-emerald-500/5 p-3",
        )}
      >
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-emerald-400">
            Contenu validé par {deck.review.reviewedBy}
          </p>
          <p className="mt-0.5 text-[11px] text-emerald-300/70">
            {deck.review.reviewerLicense ? `${deck.review.reviewerLicense} · ` : ""}
            Version {deck.review.version} · {deck.review.reviewedAt}
          </p>
        </div>
      </div>
    );
  }

  return null;
}
