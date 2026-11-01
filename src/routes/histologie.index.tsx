import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Microscope } from "lucide-react";
import { listSlides } from "@/content/histologie";
import type { HistologySlide } from "@/content/histologie";

const SLIDES: HistologySlide[] = listSlides();

export const Route = createFileRoute("/histologie/")({
  component: HistologieListPage,
});

function HistologieListPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-medium">Histologie</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Apprends à lire une lame : repérer les structures, reconnaître la
          coloration, raisonner du patron vers le diagnostic. Active les
          annotations sur chaque lame pour te guider.
        </p>
      </div>

      <ul className="space-y-3">
        {SLIDES.map((s) => (
          <li key={s.id}>
            <Link
              to="/histologie/$slideId"
              params={{ slideId: s.id }}
              className="flex items-center gap-3 rounded-[var(--radius-xl)] bg-card p-4 shadow-[var(--shadow-border)] transition-colors hover:bg-secondary"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
                <Microscope className="size-5" strokeWidth={1.7} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="font-medium">{s.title}</h2>
                <p className="mt-1 truncate text-sm text-muted">
                  {s.pathology} · {s.tissue}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted">
                {s.staining}
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted" />
            </Link>
          </li>
        ))}
      </ul>

      {SLIDES.length === 0 ? (
        <p className="mt-8 text-center text-sm text-muted">Aucune lame disponible pour l'instant.</p>
      ) : null}
    </main>
  );
}
