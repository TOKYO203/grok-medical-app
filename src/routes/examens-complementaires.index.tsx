import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, ClipboardPlus } from "lucide-react";
import { listIndications } from "@/content/examens-complementaires";
import type { Indication } from "@/content/examens-complementaires";

const INDICATIONS: Indication[] = listIndications();

export const Route = createFileRoute("/examens-complementaires/")({
  component: ExamensListPage,
});

function ExamensListPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-medium">Examens complémentaires</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Ce qu'on CHERCHE, pas ce qu'on commande : chaque examen répond à une
          question clinique précise. Red flags d'abord, 1ʳᵉ intention ensuite,
          et ce qu'on ne fait PAS.
        </p>
      </div>

      <ul className="space-y-3">
        {INDICATIONS.map((i) => (
          <li key={i.id}>
            <Link
              to="/examens-complementaires/$id"
              params={{ id: i.id }}
              className="flex items-center gap-3 rounded-[var(--radius-xl)] bg-card p-4 shadow-[var(--shadow-border)] transition-colors hover:bg-secondary"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
                <ClipboardPlus className="size-5" strokeWidth={1.7} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="font-medium">{i.symptom}</h2>
                <p className="mt-1 truncate text-sm text-muted">{i.context}</p>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted" />
            </Link>
          </li>
        ))}
      </ul>

      {INDICATIONS.length === 0 ? (
        <p className="mt-8 text-center text-sm text-muted">Aucune indication disponible pour l'instant.</p>
      ) : null}
    </main>
  );
}
