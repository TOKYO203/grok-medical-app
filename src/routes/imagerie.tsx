import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/imagerie")({
  component: ImagerieLayout,
});

/**
 * Route parente des cas d'imagerie : rend l'index (`/imagerie/`) ou le cas
 * demandé (`/imagerie/$caseId`). Sans ce parent, la cible `/imagerie` de la
 * navigation (`src/lib/navigation.ts`) pointait vers une route non déclarée
 * (scripts/navigation-system.test.mjs, scripts/navigation-integrity.test.mjs).
 */
function ImagerieLayout() {
  return <Outlet />;
}
