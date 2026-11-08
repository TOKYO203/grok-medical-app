import { createFileRoute, Link } from "@tanstack/react-router";
import { listSlides } from "@/content/histologie";

export const Route = createFileRoute("/histologie/")({
  component: HistologieIndexPage,
});

/**
 * Index des lames d'histologie : la liste que le bouton « Retour à la liste »
 * de la visionneuse (`/histologie/$slideId`) promettait sans qu'elle existe.
 */
function HistologieIndexPage() {
  const slides = listSlides();

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-1 font-display text-2xl font-medium">Histologie</h1>
      <p className="mb-5 text-sm text-muted">
        Lames commentées pour réviser l’histologie normale et pathologique.
      </p>

      {slides.length === 0 ? (
        <p className="text-sm text-muted">Aucune lame disponible pour le moment.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {slides.map((slide) => (
            <li key={slide.id}>
              <Link
                to="/histologie/$slideId"
                params={{ slideId: slide.id }}
                className="block rounded-[var(--radius-md)] bg-card p-4 shadow-[var(--shadow-border)] transition-colors hover:bg-secondary"
              >
                <span className="block font-medium">{slide.title}</span>
                <span className="mt-1 block text-xs text-muted">
                  {slide.tissue} · {slide.staining} · {slide.magnification}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
