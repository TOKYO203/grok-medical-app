import { createFileRoute, Link } from "@tanstack/react-router";
import { Page, Shell } from "@/components/shell";
import { CLINICAL_CASES, DIAGNOSTIC_CASES } from "@/content/catalog";
import { useOptimus } from "@/state/store";

export const Route = createFileRoute("/cas")({ component: CasPage });

function CasPage() {
  const done = useOptimus((s) => s.casesCompleted);
  const dxDone = useOptimus((s) => s.diagnosticsCompleted);
  return (
    <Shell title="Cas">
      <Page>
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Raisonnement</p>
        <h1 className="mt-1 font-display text-3xl font-medium tracking-tight">Cas cliniques</h1>
        <p className="mt-2 max-w-lg text-sm text-muted">
          Un cas n’est pas un QCM. Le dossier se révèle, puis les décisions. La démarche force les étapes.
        </p>
        <h2 className="mt-8 font-display text-xl font-medium">Dossiers</h2>
        <div className="mt-3 space-y-2">
          {CLINICAL_CASES.map((c) => (
            <Link
              key={c.id}
              to="/cas/$caseId"
              params={{ caseId: c.id }}
              className="block rounded-[var(--radius-xl)] bg-card p-4 shadow-[var(--shadow-border)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted">{c.specialty}</p>
                  <p className="mt-1 font-medium">{c.title}</p>
                  <p className="mt-1 text-sm text-muted">{c.summary}</p>
                </div>
                <span className="text-[11px] uppercase tracking-wider text-subtle">
                  {done.includes(c.id) ? "fait" : `${c.studyYear}e`}
                </span>
              </div>
            </Link>
          ))}
        </div>
        <h2 className="mt-10 font-display text-xl font-medium">Démarche diagnostique</h2>
        <p className="mt-1 text-sm text-muted">Huit étapes, une à la fois.</p>
        <div className="mt-3 space-y-2">
          {DIAGNOSTIC_CASES.map((d) => (
            <Link
              key={d.id}
              to="/demarche/$id"
              params={{ id: d.id }}
              className="block rounded-[var(--radius-xl)] bg-card p-4 shadow-[var(--shadow-border)]"
            >
              <p className="text-xs uppercase tracking-wider text-muted">{d.specialty}</p>
              <p className="mt-1 font-medium">{d.title}</p>
              <p className="mt-1 text-sm text-muted">{d.vignette}</p>
              <p className="mt-2 text-[11px] uppercase tracking-wider text-subtle">
                {dxDone.includes(d.id) ? "fait" : "8 étapes"}
              </p>
            </Link>
          ))}
        </div>
        <Link to="/calculateurs" className="mt-8 inline-block text-sm text-muted hover:text-fg">
          Calculateurs cliniques →
        </Link>
      </Page>
    </Shell>
  );
}
