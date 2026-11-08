import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/histologie")({
  component: HistologieLayout,
});

/**
 * Route parente des lames d'histologie : rend l'index (`/histologie/`) ou
 * la lame demandée (`/histologie/$slideId`). Sans ce parent, les liens
 * `to="/histologie"` pointaient vers une route non déclarée
 * (scripts/navigation-integrity.test.mjs).
 */
function HistologieLayout() {
  return <Outlet />;
}
