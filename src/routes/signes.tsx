import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Shell } from "@/components/shell";
import { SigneView } from "@/components/signes/signe-view";
import type { SignesCatalog } from "@/core/signes/types";
import { loadSignesCatalog } from "@/lib/signes/catalog";

/**
 * Raisonnement inversé : cas clinique → déduction → révélation de la triade.
 *
 * Le contenu n'est PAS importé (il ne doit pas peser dans le bundle) : le
 * catalogue est chargé PAR LE NAVIGATEUR depuis les actifs statiques
 * `public/content/signes/` — cache CDN « immutable » d'un an (un seul
 * téléchargement par navigateur) puis cache mémoire pour toute la navigation.
 *
 * Pourquoi le navigateur, alors que le chargement se faisait à l'origine côté
 * serveur (loader de route — voir DECISIONS.md SIGNES-8) : en production, le
 * worker Cloudflare n'a pas les actifs sur disque et le lecteur serveur se
 * repliait sur UN `fetch()` vers sa propre origine PAR FICHE. À ~110 fiches,
 * la limite de sous-requêtes du plan Workers (~50 par requête) était dépassée
 * et /signes affichait l'écran d'erreur. Le navigateur, lui, interroge le CDN
 * directement, sans cette limite.
 */
export const Route = createFileRoute("/signes")({
  component: SignesPage,
});

function SignesPage() {
  // `null` = chargement en cours ; `undefined` = aucun catalogue publié ;
  // sinon le catalogue complet, dans l'ordre éditorial du manifeste.
  const [catalog, setCatalog] = useState<SignesCatalog | null | undefined>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadSignesCatalog()
      .then((loaded) => {
        if (!cancelled) setCatalog(loaded ?? undefined);
      })
      .catch(() => {
        // Le catalogue est conçu pour ne jamais jeter (fiche manquante =
        // ignorée) ; ce garde protège d'un échec réseau brut du navigateur.
        if (!cancelled) setCatalog(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const items = catalog?.items ?? [];

  if (catalog === null) {
    return (
      <Shell title="Signes & Syndromes">
        <SignesPending />
      </Shell>
    );
  }

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
          prochainement. La mécanique d'entraînement est déjà en place.
        </p>
      </div>
    </div>
  );
}
