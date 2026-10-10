import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, ChevronRight } from "lucide-react";
import { Page, Shell, PageHeader } from "@/components/shell";
import { listEcg } from "@/lib/ecg/catalog";
import { EcgMonitor } from "@/components/ecg/EcgMonitor";

export const Route = createFileRoute("/ecg")({
  component: EcgLibraryPage,
});

function EcgLibraryPage() {
  const cases = listEcg();
  return (
    <Shell title="ECG">
      <Page className="mx-auto max-w-2xl" header={
        <PageHeader
          kicker="Moteur d'apprentissage"
          title="ECG — Interprétation"
          description="Lecture guidée, annotations, cinéma temps réel. Apprends à lire un ECG comme un cardiologue."
        />
      }>
        <EcgMonitor bpm={75} label="II" secondsWindow={4} autoStart />
        <p className="mt-4 font-mono text-xs tabular-nums text-subtle">
          {cases.length} cas disponible{cases.length > 1 ? "s" : ""}
        </p>
        <div className="mt-4 space-y-2">
          {cases.map((c) => (
            <Link key={c.id} to="/ecg/$id" params={{ id: c.id }}
              className="optimus-card optimus-interactive-card flex items-center gap-3 p-4 active:scale-[0.99]">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                <Activity className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{c.title}</p>
                <p className="mt-0.5 text-xs text-muted">{c.specialty} · {c.rhythm}</p>
              </div>
              <ChevronRight className="size-4 shrink-0 text-subtle" />
            </Link>
          ))}
        </div>
      </Page>
    </Shell>
  );
}
