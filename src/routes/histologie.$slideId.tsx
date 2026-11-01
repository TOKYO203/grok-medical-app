import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, Eye, EyeOff, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { findSlideBySlug, listSlides } from "@/content/histologie";
import type { HistologyAnnotation } from "@/content/histologie";

export const Route = createFileRoute("/histologie/$slideId")({
  component: HistologieSlidePage,
});

function SlideViewer({
  src,
  alt,
  annotations,
  show,
  focus,
}: {
  src: string;
  alt: string;
  annotations: HistologyAnnotation[];
  show: boolean;
  focus: string | null;
}) {
  return (
    <div className="relative w-full overflow-hidden rounded-[var(--radius-xl)] bg-black shadow-[var(--shadow-border)]">
      <img src={src} alt={alt} className="block w-full" loading="lazy" decoding="async" />
      {show ? (
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          {annotations.map((a) => {
            const dim = focus !== null && a.label !== focus;
            return (
              <g key={a.label ?? a.x} opacity={dim ? 0.25 : 1}>
                <rect
                  x={a.x}
                  y={a.y}
                  width={a.w}
                  height={a.h}
                  fill="none"
                  stroke="#d4a648"
                  strokeWidth="0.6"
                  strokeDasharray="2 1.5"
                />
                {a.label ? (
                  <g>
                    <rect
                      x={Math.max(0, a.x - 0.5)}
                      y={Math.max(0, a.y - 4)}
                      width={Math.min(100, a.label.length * 1.6)}
                      height="3"
                      fill="#d4a648"
                      rx="0.5"
                    />
                    <text
                      x={Math.max(0, a.x) + 0.3}
                      y={Math.max(0, a.y - 1.7)}
                      fill="#14180f"
                      fontSize="2"
                      fontWeight="600"
                      fontFamily="system-ui, sans-serif"
                    >
                      {a.label}
                    </text>
                  </g>
                ) : null}
              </g>
            );
          })}
        </svg>
      ) : null}
    </div>
  );
}

function HistologieSlidePage() {
  const { slideId } = Route.useParams();
  const s = findSlideBySlug(slideId);
  const [show, setShow] = useState(true);
  const [focus, setFocus] = useState<string | null>(null);
  const [quizMode, setQuizMode] = useState(false);
  const [revealed, setRevealed] = useState(false);

  if (!s) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-6">
        <p className="text-sm text-muted">Lame introuvable.</p>
        <Link to="/histologie" className="mt-4 inline-block text-primary underline">
          Retour à la liste
        </Link>
      </main>
    );
  }

  const all = listSlides();
  const idx = all.findIndex((x) => x.id === s.id);
  const prev = idx > 0 ? all[idx - 1] : null;
  const next = idx < all.length - 1 ? all[idx + 1] : null;
  const hideAnswer = quizMode && !revealed;

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between gap-2 text-sm text-muted">
        <Link to="/histologie" className="inline-flex items-center gap-1 hover:text-primary">
          <ArrowLeft className="size-4" /> Toutes les lames
        </Link>
        <span className="text-xs">
          {idx + 1} / {all.length}
        </span>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted">{s.tissue}</span>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted">{s.staining}</span>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted">{s.magnification}</span>
        <button
          type="button"
          onClick={() => { setQuizMode((v) => !v); setRevealed(false); }}
          className={
            "ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors " +
            (quizMode ? "bg-primary text-primary-fg" : "bg-secondary text-muted hover:text-primary")
          }
          aria-pressed={quizMode}
        >
          <GraduationCap className="size-3.5" aria-hidden />
          {quizMode ? "Mode auto-évaluation activé" : "Mode auto-évaluation"}
        </button>
      </div>

      <h1 className="mb-3 font-display text-2xl font-medium">{s.title}</h1>

      <SlideViewer src={s.imageUrl} alt={s.imageAlt} annotations={s.annotations} show={show} focus={focus} />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={() => setShow((v) => !v)}>
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          {show ? "Masquer les annotations" : "Afficher les annotations"}
        </Button>
        {show && s.annotations.some((a) => a.label) ? (
          <div className="flex flex-wrap gap-1.5">
            {s.annotations
              .filter((a) => a.label)
              .map((a) => (
                <button
                  key={a.label}
                  type="button"
                  onMouseEnter={() => setFocus(a.label ?? null)}
                  onMouseLeave={() => setFocus(null)}
                  onFocus={() => setFocus(a.label ?? null)}
                  onBlur={() => setFocus(null)}
                  className={
                    "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors " +
                    (focus === a.label ? "bg-[#d4a648] text-[#14180f]" : "bg-secondary text-muted hover:text-primary")
                  }
                >
                  {a.label}
                </button>
              ))}
          </div>
        ) : null}
      </div>

      <div className="mt-4 rounded-[var(--radius-md)] bg-card p-4 shadow-[var(--shadow-border)]">
        <p className="text-sm leading-relaxed text-muted">{s.description}</p>
      </div>

      <div className="mt-5 overflow-hidden rounded-[var(--radius-md)] border border-dashed">
        {hideAnswer ? (
          <div className="p-5 text-center">
            <p className="text-sm text-muted">
              Observationne la lame, formule ton hypothèse diagnostique… puis révèle.
            </p>
            <Button className="mt-3" onClick={() => setRevealed(true)}>
              <CheckCircle2 className="size-4" /> Révéler le diagnostic
            </Button>
          </div>
        ) : (
          <div className="p-5">
            <h2 className="font-medium">Signes clés à retenir</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
              {s.keyFeatures.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>

            <h2 className="mt-6 font-medium">Diagnostic</h2>
            <p className="mt-1 text-sm">{s.diagnosis}</p>

            {s.differential?.length ? (
              <>
                <h2 className="mt-6 font-medium">Diagnostics différentiels</h2>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
                  {s.differential.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
        )}
      </div>

      <p className="mt-6 text-xs text-muted">
        Source :{" "}
        <a href={s.sourceUrl} target="_blank" rel="noreferrer" className="underline hover:text-primary">
          {s.source}
        </a>{" "}
        · Licence {s.license}
      </p>

      {s.linkedPathology ? (
        <Link
          to="/pathologie/$slug"
          params={{ slug: s.linkedPathology }}
          className="mt-4 inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-primary px-4 py-2.5 text-sm font-medium text-primary-fg transition-opacity hover:opacity-90"
        >
          <BookOpen className="size-4" aria-hidden />
          Voir la fiche : {s.pathology}
        </Link>
      ) : null}

      <div className="mt-8 flex items-center justify-between gap-2 border-t pt-4">
        {prev ? (
          <Link
            to="/histologie/$slideId"
            params={{ slideId: prev.id }}
            className="inline-flex min-w-0 items-center gap-1.5 rounded-[var(--radius-md)] bg-secondary px-3 py-2 text-sm font-medium transition-colors hover:text-primary"
          >
            <ArrowLeft className="size-4 shrink-0" />
            <span className="truncate">{prev.title}</span>
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link
            to="/histologie/$slideId"
            params={{ slideId: next.id }}
            className="inline-flex min-w-0 items-center gap-1.5 rounded-[var(--radius-md)] bg-secondary px-3 py-2 text-sm font-medium transition-colors hover:text-primary"
          >
            <span className="truncate">{next.title}</span>
            <ArrowRight className="size-4 shrink-0" />
          </Link>
        ) : (
          <span />
        )}
      </div>
    </main>
  );
}
