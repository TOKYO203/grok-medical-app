import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Microscope, Sparkles } from "lucide-react";
import { listSlides } from "@/content/histologie";
import type { HistologySlide } from "@/content/histologie";

const SLIDES: HistologySlide[] = listSlides();
const STAININGS = ["Toutes", ...Array.from(new Set(SLIDES.map((s) => s.staining)))];

export const Route = createFileRoute("/histologie/")({
  component: HistologieListPage,
});

function HistologieListPage() {
  const [filter, setFilter] = useState("Toutes");
  const visible = filter === "Toutes" ? SLIDES : SLIDES.filter((s) => s.staining === filter);

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-6 overflow-hidden rounded-[var(--radius-xl)] bg-card p-5 shadow-[var(--shadow-border)]">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Microscope className="size-5" strokeWidth={1.7} />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-3xl font-medium">Histologie</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Apprends à lire une lame : repérer les structures, reconnaître la
              coloration, raisonner du patron vers le diagnostic. Mode
              auto-évaluation disponible sur chaque lame.
            </p>
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-medium text-muted">
              <Sparkles className="size-3" aria-hidden />
              {SLIDES.length} lames · {STAININGS.length - 1} colorations · vraies photographies microscopiques
            </p>
          </div>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filtrer par coloration">
        {STAININGS.map((st) => (
          <button
            key={st}
            type="button"
            onClick={() => setFilter(st)}
            className={
              "rounded-full px-3 py-1.5 text-xs font-medium transition-colors " +
              (filter === st
                ? "bg-primary text-primary-fg"
                : "bg-secondary text-muted hover:text-primary")
            }
          >
            {st}
          </button>
        ))}
      </div>

      <ul className="space-y-3">
        {visible.map((s) => (
          <li key={s.id}>
            <Link
              to="/histologie/$slideId"
              params={{ slideId: s.id }}
              className="flex items-center gap-4 overflow-hidden rounded-[var(--radius-xl)] bg-card p-3 shadow-[var(--shadow-border)] transition-colors hover:bg-secondary"
            >
              <span className="relative block h-20 w-24 shrink-0 overflow-hidden rounded-[var(--radius-md)] bg-black">
                <img
                  src={s.imageUrl}
                  alt={s.imageAlt}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="font-medium">{s.title}</h2>
                <p className="mt-1 truncate text-sm text-muted">
                  {s.pathology} · {s.tissue}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted">
                    {s.staining}
                  </span>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted">
                    {s.magnification}
                  </span>
                </div>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted" />
            </Link>
          </li>
        ))}
      </ul>

      {visible.length === 0 ? (
        <p className="mt-8 text-center text-sm text-muted">Aucune lame pour cette coloration.</p>
      ) : null}
    </main>
  );
}
