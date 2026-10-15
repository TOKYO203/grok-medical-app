import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Activity, ChevronRight } from "lucide-react";
import { Page, Shell, PageHeader } from "@/components/shell";
import { listEcg } from "@/lib/ecg/catalog";
import { EcgMonitor } from "@/components/ecg/EcgMonitor";

export const Route = createFileRoute("/ecg")({
  component: EcgLibraryPage,
});

function EcgLibraryPage() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  // /ecg est le layout parent de /ecg/$id : on laisse l'enfant prendre la main
  // (sans cet <Outlet/>, la page détail ne s'affichait jamais — cf. demarche.tsx).
  if (pathname !== "/ecg" && pathname !== "/ecg/") {
    return <Outlet />;
  }

  const cases = listEcg();
  return (
    <Shell title="ECG">
      <Page className="mx-auto max-w-2xl" header={
        <PageHeader
          kicker="Moteur d'apprentissage"
          title="ECG — Interprétation"
          description="Moniteur temps réel, lecture guidée 5 étapes, annotations révélées. La pathologie s'affiche en premier."
        />
      }>
        <EcgMonitor bpm={75} autoStart />
        <p className="mt-4 font-mono text-xs tabular-nums text-subtle">
          {cases.length} cas disponible{cases.length > 1 ? "s" : ""}
        </p>
        <div className="mt-4 space-y-2">
          {cases.map((c) => (
            <Link key={c.id} to="/ecg/$id" params={{ id: c.id }}
              className="optimus-card optimus-interactive-card block p-4 active:scale-[0.99]">
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                  <Activity className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-snug">{c.title}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-[#A67C1E]/15 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-[#E8C97A]">
                      {c.difficulty === "intro" ? "Découverte" : c.difficulty === "advanced" ? "Avancé" : "Consolidation"}
                    </span>
                    <span className="rounded-full bg-secondary px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted">
                      {c.rhythm}
                    </span>
                  </div>
                </div>
                <ChevronRight className="mt-1 size-4 shrink-0 text-subtle" />
              </div>
            </Link>
          ))}
        </div>
        <p className="mt-6 rounded-[var(--radius-md)] bg-secondary/60 px-3 py-2.5 text-[11px] leading-relaxed text-muted">
          Références de lecture : J. Hampton, <em>The ECG Made Easy</em> (Elsevier) ·
          Recommandations de la Société européenne de cardiologie (ESC).
          Outil d&apos;apprentissage — l&apos;interprétation finale reste celle du clinicien.
        </p>
      </Page>
    </Shell>
  );
}
