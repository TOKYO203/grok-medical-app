import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Activity, ChevronRight } from "lucide-react";
import { Page, Shell, PageHeader } from "@/components/shell";
import { listEcg } from "@/lib/ecg/catalog";
import { getParcours } from "@/lib/ecg/parcours/catalog";
import { EcgMonitor } from "@/components/ecg/EcgMonitor";
import { ExamenModeEcg } from "@/components/ecg/ExamenModeEcg";
import { LevelCard } from "@/components/ecg/parcours/LevelCard";

export const Route = createFileRoute("/ecg")({
  component: EcgLibraryPage,
});

function EcgLibraryPage() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  if (pathname !== "/ecg" && pathname !== "/ecg/") {
    return <Outlet />;
  }

  const cases = listEcg();
  const parcours = getParcours();

  return (
    <Shell title="ECG">
      <Page className="mx-auto max-w-2xl" header={
        <PageHeader
          kicker="Parcours d'apprentissage"
          title="Apprendre l'ECG de A à Z"
          description="5 niveaux progressifs, de la lecture du papier à l'interprétation des urgences."
        />
      }>
        <div className="space-y-3">
          {parcours.levels.map((level) => (
            <LevelCard key={level.id} level={level} />
          ))}
        </div>

        <div className="mt-10 border-t border-subtle pt-6">
          <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold">
            <Activity size={18} /> Mode examen libre
          </h2>
          <p className="mb-4 text-sm text-subtle">
            Accès direct aux {cases.length} cas sans parcours guidé.
          </p>
          <EcgMonitor bpm={75} autoStart />
          <div className="mt-4"><ExamenModeEcg /></div>
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
                  <p className="text-xs text-subtle">{c.difficulty} · {c.rhythm}</p>
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
