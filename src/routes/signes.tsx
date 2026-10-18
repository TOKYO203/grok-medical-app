import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Shell } from "@/components/shell";
import { SigneView } from "@/components/signes/signe-view";
import { loadSignesCatalog } from "@/lib/signes/catalog";

/**
 * Raisonnement inversé : cas clinique → déduction → révélation de la triade.
 *
 * Le contenu n'est PAS importé (il ne doit pas peser dans le bundle) : il est
 * chargé par le `loader` depuis les actifs statiques `public/content/signes/`
 * — résolu AVANT le rendu, donc présent dans le HTML servi (pas d'écran vide
 * à l'hydratation).
 */
export const Route = createFileRoute("/signes")({
  component: SignesPage,
  loader: () => loadSignesCatalog(),
  pendingComponent: SignesPending,
});

function SignesPage() {
  const catalog = Route.useLoaderData();
  const items = catalog?.items ?? [];
  const [index, setIndex] = useState(0);

  if (items.length === 0) {
    return (
      <Shell title="Signes & Syndromes">
        <SignesEmpty />
      </Shell>
    );
  }

  // Le catalogue peut changer (nouveau lot de contenu) sans remonter la page :
  // on borne l'index plutôt que de le laisser pointer hors du tableau.
  const safeIndex = Math.min(index, items.length - 1);
  const currentItem = items[safeIndex];

  return (
    <Shell title="Signes & Syndromes">
      <div className="mx-auto max-w-2xl" data-signes-catalog="ready">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-muted">Raisonnement inversé — du cas au syndrome</p>
          <span className="rounded-full bg-secondary px-2 py-1 text-xs" data-signes-count={items.length}>
            {safeIndex + 1} / {items.length}
          </span>
        </div>

        <SigneView
          key={currentItem.id}
          item={currentItem}
          onNext={safeIndex < items.length - 1 ? () => setIndex(safeIndex + 1) : undefined}
        />

        <div className="mt-4 flex justify-between">
          <button
            type="button"
            disabled={safeIndex === 0}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            className="px-4 py-2 text-sm text-muted disabled:opacity-30"
          >
            Précédent
          </button>
          <button
            type="button"
            disabled={safeIndex === items.length - 1}
            onClick={() => setIndex((i) => Math.min(items.length - 1, i + 1))}
            className="px-4 py-2 text-sm text-muted disabled:opacity-30"
          >
            Suivant
          </button>
        </div>
      </div>
    </Shell>
  );
}

function SignesPending() {
  return (
    <Shell title="Signes & Syndromes">
      <div className="mx-auto max-w-2xl" aria-busy="true" data-signes-catalog="loading">
        <div className="optimus-card h-40 animate-pulse p-5" />
      </div>
    </Shell>
  );
}

/** Aucun actif publié : on l'annonce, on ne casse pas la page. */
function SignesEmpty() {
  return (
    <div className="mx-auto max-w-2xl" data-signes-catalog="empty">
      <div className="optimus-card p-6 text-center">
        <p className="font-display text-lg">Contenu en préparation</p>
        <p className="mt-2 text-sm text-muted">
          Les cas de raisonnement inversé (cas clinique → déduction → triade) arrivent
          prochainement. La mécanique d’entraînement est déjà en place.
        </p>
      </div>
    </div>
  );
}
