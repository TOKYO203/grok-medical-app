import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, BookOpen, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { findSlideBySlug } from "@/content/histologie";
import type { HistologyAnnotation } from "@/content/histologie";

export const Route = createFileRoute("/histologie/$slideId")({
  component: HistologieSlidePage,
});

function SlideViewer({
  src,
  alt,
  annotations,
  show,
}: {
  src: string;
  alt: string;
  annotations: HistologyAnnotation[];
  show: boolean;
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
          {annotations.map((a) => (
            <g key={a.label ?? a.x}>
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
          ))}
        </svg>
      ) : null}
    </div>
  );
}

function HistologieSlidePage() {
  const { slideId } = Route.useParams();
  const s = findSlideBySlug(slideId);
  const [show, setShow] = useState(true);

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

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-4 flex items-center gap-2 text-sm text-muted">
        <Link to="/histologie" className="inline-flex items-center gap-1 hover:text-primary">
          <ArrowLeft className="size-4" /> Toutes les lames
        </Link>
        <span>·</span>
        <span>{s.title}</span>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted">{s.tissue}</span>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted">{s.staining}</span>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted">{s.magnification}</span>
      </div>

      <SlideViewer src={s.imageUrl} alt={s.imageAlt} annotations={s.annotations} show={show} />

      <Button
        variant="secondary"
        className="mt-3"
        onClick={() => setShow((v) => !v)}
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        {show ? "Masquer les annotations" : "Afficher les annotations"}
      </Button>

      <p className="mt-4 text-sm leading-relaxed text-muted">{s.description}</p>

      <h2 className="mt-6 font-medium">Signes clés à retenir</h2>
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

      <div className="mt-8">
        <Link to="/histologie" className="inline-flex items-center rounded-[var(--radius-md)] bg-secondary px-4 py-2 text-sm font-medium">
          Retour à la liste
        </Link>
      </div>
    </main>
  );
}
