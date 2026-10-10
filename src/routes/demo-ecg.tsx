import { createFileRoute } from "@tanstack/react-router";
import { Page, Shell } from "@/components/shell";
import { EcgCinema } from "@/components/ecg/EcgCinema";

export const Route = createFileRoute("/demo-ecg")({
  component: DemoEcgPage,
});

function DemoEcgPage() {
  return (
    <Shell title="Démo ECG">
      <Page className="mx-auto max-w-3xl">
        <div className="mb-6">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
            Prototype moteur ECG
          </p>
          <h1 className="mt-1 font-display text-2xl font-medium tracking-tight">
            ECG animé — temps réel
          </h1>
          <p className="mt-2 text-sm text-muted">
            Tracé synthétique qui se dessine comme sur un moniteur. Contrôles :
            lecture/pause, rejouer, vitesse ×1 ×2 ×4.
          </p>
        </div>

        <EcgCinema bpm={75} cycles={6} autoPlay />

        <div className="mt-6 rounded-[var(--radius-lg)] bg-card p-4 shadow-[var(--shadow-border)]">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
            Variantes
          </p>
          <div className="mt-3 space-y-4">
            <div>
              <p className="mb-2 text-xs text-subtle">Rythme lent (50 bpm)</p>
              <EcgCinema bpm={50} cycles={4} autoPlay={false} />
            </div>
            <div>
              <p className="mb-2 text-xs text-subtle">Tachycardie (130 bpm)</p>
              <EcgCinema bpm={130} cycles={8} autoPlay={false} />
            </div>
          </div>
        </div>
      </Page>
    </Shell>
  );
}
