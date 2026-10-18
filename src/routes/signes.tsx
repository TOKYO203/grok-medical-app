import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Shell } from "@/components/shell";
import { ContentLocked } from "@/components/premium/content-locked";
import { SigneView } from "@/components/signes/signe-view";
import type { SignesCatalog } from "@/core/signes/types";
import { loadSignesCatalog, type SignesLoad } from "@/lib/signes/catalog";

/**
 * Raisonnement inversé : cas clinique → déduction → révélation de la triade.
 *
 * ⚠️ Le contenu est PREMIUM depuis la session S1 : les 110 fiches vivent dans
 * `private/content/signes/` et ne sortent du serveur que contre un jeton de
 * contenu (`Authorization: Bearer …`, obtenu via `/api/licenses/verify`).
 *
 * Le chargement reste côté NAVIGATEUR (`/content/signes/_catalog.json`, une
 * seule requête pour tout le catalogue) : en production le worker n'a pas
 * d'accès disque, et un chargement SSR ne pourrait de toute façon pas lire le
 * `localStorage` du client.
 *
 * Trois états, distincts à l'écran :
 *   • `locked`  → bandeau Premium (aucun cas n'est téléchargé) ;
 *   • `missing` → contenu pas encore publié ;
 *   • `ok`      → le parcours de déduction habituel.
 */
export const Route = createFileRoute("/signes")({
  component: SignesPage,
});

type State = { status: "loading" } | SignesLoad<SignesCatalog>;

function SignesPage() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadSignesCatalog()
      .then((loaded) => {
        if (!cancelled) setState(loaded);
      })
      .catch(() => {
        // Le catalogue est conçu pour ne jamais jeter ; ce garde protège d'un
        // échec réseau brut du navigateur.
        if (!cancelled) setState({ status: "missing" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "loading") {
    return (
      <Shell title="Signes & Syndromes">
        <SignesPending />
      </Shell>
    );
  }

  if (state.status === "locked") {
    return (
      <Shell title="Signes & Syndromes">
        <div className="mx-auto max-w-2xl" data-signes-catalog="locked">
          <p className="text-sm text-muted">Raisonnement inversé — du cas au syndrome</p>
          <ContentLocked />
        </div>
      </Shell>
    );
  }

  const items = state.status === "ok" ? state.data.items : [];

  if (state.status === "missing" || items.length === 0) {
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
          prochainement. La mécanique d'entraînement est déjà en place.
        </p>
      </div>
    </div>
  );
}
