import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Activity, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { Page, Shell, PageHeader } from "@/components/shell";
import { listEcg } from "@/lib/ecg/catalog";
import { getParcours } from "@/lib/ecg/parcours/catalog";
import { EcgMonitor } from "@/components/ecg/EcgMonitor";
import { ExamenModeEcg } from "@/components/ecg/ExamenModeEcg";
import { LevelCard } from "@/components/ecg/parcours/LevelCard";
import {
  isUnlockAllActive,
  setUnlockAll,
} from "@/lib/ecg/parcours/progression";

export const Route = createFileRoute("/ecg")({
  component: EcgLibraryPage,
});

/**
 * Parent : décide si on affiche l'enfant (/ecg/$id) ou le hub.
 * Aucun hook ici → pas de violation rules-of-hooks.
 */
function EcgLibraryPage() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  if (pathname !== "/ecg" && pathname !== "/ecg/") {
    return <Outlet />;
  }

  return <EcgHub />;
}

/**
 * Enfant : contient TOUS les hooks (useState, useEffect).
 * Monté uniquement quand on est bien sur /ecg → hooks toujours appelés
 * dans le même ordre.
 */
function EcgHub() {
  const cases = listEcg();
  const parcours = getParcours();

  const [unlockAll, setUnlockAllState] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setUnlockAllState(isUnlockAllActive());
    setMounted(true);
  }, []);

  function toggleUnlockAll() {
    const next = !unlockAll;
    setUnlockAll(next);
    setUnlockAllState(next);
  }

  return (
    <Shell title="ECG">
      <Page
        className="mx-auto max-w-2xl"
        header={
          <PageHeader
            kicker="Parcours d'apprentissage"
            title="Apprendre l'ECG de A à Z"
            description="5 niveaux progressifs, de la lecture du papier à l'interprétation des urgences."
          />
        }
      >
        <div className="space-y-3">
          {parcours.levels.map((level) => (
            <LevelCard key={level.id} level={level} />
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between rounded-lg border border-subtle px-3 py-2 text-sm">
          <span className="text-subtle">Mode révision libre</span>
          {mounted && (
            <button
              type="button"
              onClick={toggleUnlockAll}
              className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                unlockAll
                  ? "bg-amber-500 text-white"
                  : "bg-muted text-subtle hover:bg-subtle"
              }`}
            >
              {unlockAll ? "Désactiver" : "Tout déverrouiller"}
            </button>
          )}
        </div>

        <div className="mt-6 border-t border-subtle pt-6">
          <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold">
            <Activity size={18} /> Mode examen libre
          </h2>
          <p className="mb-4 text-sm text-subtle">
            Accès direct aux {cases.length} cas sans parcours guidé.
          </p>
          <EcgMonitor bpm={75} autoStart />
          <div className="mt-4">
            <ExamenModeEcg />
          </div>
          <div className="mt-4 space-y-2">
            {cases.map((c) => (
              <Link
                key={c.id}
                to="/ecg/$id"
                params={{ id: c.id }}
                className="flex items-center justify-between rounded-lg border border-default p-3 transition hover:border-strong"
              >
                <div>
                  <p className="text-sm font-medium">{c.title}</p>
                  <p className="text-xs text-subtle">
                    {c.difficulty} · {c.rhythm}
                  </p>
                </div>
                <ChevronRight size={16} className="text-subtle" />
              </Link>
            ))}
          </div>
        </div>
      </Page>
    </Shell>
  );
}
