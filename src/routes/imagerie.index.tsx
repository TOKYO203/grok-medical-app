import { createFileRoute, Link } from "@tanstack/react-router";
import { listImagingCases } from "@/content/imagerie";

export const Route = createFileRoute("/imagerie/")({
  component: ImagerieIndexPage,
});

/**
 * Index des cas d'imagerie : la liste que le lien « Tous les cas » de la
 * visionneuse (`/imagerie/$caseId`) promettait sans qu'elle existe.
 */
function ImagerieIndexPage() {
  const cases = listImagingCases();

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-1 font-display text-2xl font-medium">Imagerie</h1>
      <p className="mb-5 text-sm text-muted">
        Cas commentés pour apprendre à lire une image pas à pas, avec une
        méthode systématique.
      </p>

      {cases.length === 0 ? (
        <p className="text-sm text-muted">Aucun cas disponible pour le moment.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {cases.map((c) => (
            <li key={c.id}>
              <Link
                to="/imagerie/$caseId"
                params={{ caseId: c.id }}
                className="block rounded-[var(--radius-md)] bg-card p-4 shadow-[var(--shadow-border)] transition-colors hover:bg-secondary"
              >
                <span className="block font-medium">{c.title}</span>
                <span className="mt-1 block text-xs text-muted">
                  {c.modality} · {c.steps.length} étapes · {c.finalDiagnosis}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
