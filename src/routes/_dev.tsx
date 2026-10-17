import { createFileRoute, Link, notFound, Outlet } from "@tanstack/react-router";

/* ============================================================================
   Layout « pathless » des outils de développement (`/_dev`)
   ----------------------------------------------------------------------------
   Le préfixe `_` rend la route invisible dans l'URL : `_dev.kitchen-sink.tsx`
   répond sur `/kitchen-sink`.

   GARDE PRODUCTION : `import.meta.env.DEV` est remplacé STATIQUEMENT par Vite
   (`true` en dev, `false` au build) ; en production `beforeLoad` lève donc
   toujours un `notFound()` → la route et son enfant répondent 404 et ne sont
   jamais rendus. Aucune route existante n'est touchée.
   ============================================================================ */

export const Route = createFileRoute("/_dev")({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound();
  },
  component: DevLayout,
  notFoundComponent: DevNotFound,
});

function DevLayout() {
  return <Outlet />;
}

/** 404 sobre de la vitrine, affichée uniquement hors développement. */
function DevNotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <div className="max-w-md text-center">
        <p className="type-micro text-[var(--tone-accent)]">404</p>
        <h1 className="type-title-lg mt-2">Page introuvable</h1>
        <p className="type-body-sm mt-2 text-muted">
          Cette page n’existe pas ou n’est pas disponible en production.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex h-11 items-center justify-center rounded-[var(--r-md)] bg-primary px-4 text-sm font-medium text-primary-fg"
        >
          Retour à l’accueil
        </Link>
      </div>
    </main>
  );
}
