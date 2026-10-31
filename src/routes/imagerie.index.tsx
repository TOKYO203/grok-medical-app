import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Image as ImageIcon } from "lucide-react";
import type { ImagingCase } from "@/content/imagerie";
import cxr001 from "@/content/data/imagerie/cxr-001.json";

const CASES: ImagingCase[] = [cxr001 as ImagingCase];

export const Route = createFileRoute("/imagerie/")({
  component: ImagerieListPage,
});

function ImagerieListPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-medium">Imagerie médicale</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Apprends à interpréter une image de façon systématique (méthode ABCDE pour le thorax).
          Chaque cas est guidé étape par étape avec une image annotée.
        </p>
      </div>

      <ul className="space-y-3">
        {CASES.map((c) => (
          <li key={c.id}>
            <Link
              to="/imagerie/$caseId"
              params={{ caseId: c.id }}
              className="flex items-center gap-3 rounded-[var(--radius-xl)] bg-card p-4 shadow-[var(--shadow-border)] transition-colors hover:bg-secondary"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
                <ImageIcon className="size-5" strokeWidth={1.7} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="font-medium">{c.title}</h2>
                <p className="mt-1 truncate text-sm text-muted">{c.clinical}</p>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted" />
            </Link>
          </li>
        ))}
      </ul>

      {CASES.length === 0 ? (
        <p className="mt-8 text-center text-sm text-muted">Aucun cas d'imagerie disponible pour l'instant.</p>
      ) : null}
    </main>
  );
}
