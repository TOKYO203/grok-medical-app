import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Layers } from "lucide-react";
import type { ImagingCase } from "@/content/imagerie";
import cxr001 from "@/content/data/imagerie/cxr-001.json";
import cxr002 from "@/content/data/imagerie/cxr-002.json";
import cxr003 from "@/content/data/imagerie/cxr-003.json";
import cxr004 from "@/content/data/imagerie/cxr-004.json";
import cxr005 from "@/content/data/imagerie/cxr-005.json";

const CASES: ImagingCase[] = [
  cxr001 as ImagingCase,
  cxr002 as ImagingCase,
  cxr003 as ImagingCase,
  cxr004 as ImagingCase,
  cxr005 as ImagingCase,
];

const MODALITY_LABEL: Record<string, string> = {
  radio: "Radiographie",
  scanner: "Scanner",
  irm: "IRM",
  echo: "Échographie",
  autre: "Autre",
};

export const Route = createFileRoute("/imagerie/")({
  component: ImagerieListPage,
});

function ImagerieListPage() {
  const methods = new Set(CASES.map((c) => c.method));

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      {/* Header carte, cohérent avec la galerie histologie */}
      <div className="mb-6 rounded-[var(--radius-xl)] bg-card p-5 shadow-[var(--shadow-border)]">
        <div className="flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-secondary text-primary">
            <Layers className="size-6" strokeWidth={1.7} />
          </span>
          <div>
            <h1 className="font-display text-3xl font-medium">Imagerie médicale</h1>
            <p className="mt-1 text-xs font-medium uppercase tracking-[0.14em] text-muted">
              {CASES.length} cas · {methods.size} méthode{methods.size > 1 ? "s" : ""} ·
              vraies images annotées
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Apprends à interpréter une image de façon systématique (méthode ABCDE pour le
              thorax). Chaque cas est guidé étape par étape, scoré de A à H.
            </p>
          </div>
        </div>
      </div>

      <ul className="space-y-3">
        {CASES.map((c) => (
          <li key={c.id}>
            <Link
              to="/imagerie/$caseId"
              params={{ caseId: c.id }}
              className="group flex items-stretch gap-4 overflow-hidden rounded-[var(--radius-xl)] bg-card p-3 shadow-[var(--shadow-border)] transition-colors hover:bg-secondary/60"
            >
              {/* Vignette réelle du cas */}
              <span className="relative block h-24 w-32 shrink-0 overflow-hidden rounded-[var(--radius-md)] bg-secondary">
                <img
                  src={c.imageUrl}
                  alt={c.imageAlt}
                  loading="lazy"
                  className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </span>
              <span className="flex min-w-0 flex-1 flex-col justify-center py-1">
                <span className="optimus-kicker text-[10px] font-medium uppercase tracking-[0.14em] text-muted">
                  {MODALITY_LABEL[c.modality] ?? c.modality} · {c.steps.length} étapes ·
                  méthode {c.method}
                </span>
                <span className="mt-1 font-medium">{c.title}</span>
                <span className="mt-0.5 line-clamp-2 text-sm text-muted">{c.clinical}</span>
              </span>
              <span className="flex shrink-0 items-center self-center">
                <ChevronRight className="size-4 text-muted transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {CASES.length === 0 ? (
        <p className="mt-8 text-center text-sm text-muted">
          Aucun cas d'imagerie disponible pour l'instant.
        </p>
      ) : null}

      <p className="mt-6 text-center text-[10px] leading-relaxed text-subtle">
        Images : Wikimedia Commons — licences CC0 / CC BY / domaine public, sources indiquées
        sur chaque cas.
      </p>
    </main>
  );
}
