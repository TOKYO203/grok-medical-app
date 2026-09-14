import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, Lock, Sparkles } from "lucide-react";
import { Page, Shell } from "@/components/shell";
import { buttonVariants } from "@/components/ui/button-variants";
import { CLINICAL_CASES, DIAGNOSTIC_CASES } from "@/content/catalog";
import { hasEntitlement, useOptimus } from "@/state/store";

export const Route = createFileRoute("/cas")({ component: CasPage });

function CasPage() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const done = useOptimus((s) => s.casesCompleted);
  const dxDone = useOptimus((s) => s.diagnosticsCompleted);
  const entitlements = useOptimus((s) => s.entitlements);

  if (pathname !== "/cas" && pathname !== "/cas/") {
    return <Outlet />;
  }

  return (
    <Shell title="Cas">
      <Page>
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Raisonnement</p>
        <h1 className="mt-1 font-display text-3xl font-medium tracking-tight">Cas cliniques</h1>
        <p className="mt-2 max-w-lg text-sm text-muted">
          Un cas n’est pas un QCM. Le dossier se révèle, puis les décisions. La démarche force les étapes.
        </p>
        <section className="premium-hero relative mt-7 overflow-hidden rounded-[var(--radius-xl)] p-5 text-primary-fg shadow-[var(--shadow-md)]">
          <Sparkles className="size-6" aria-hidden />
          <h2 className="mt-3 font-display text-2xl font-medium tracking-tight">
            Décidez comme en garde
          </h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed opacity-80">
            Dossiers progressifs, décisions critiques, correction argumentée et conduite pratique.
            Un cas est offert ; les cas avancés sont inclus dans chaque spécialité Premium.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
            <span className="flex items-center gap-2 rounded-[var(--radius-md)] bg-bg/15 p-3">
              <CheckCircle2 className="size-4 shrink-0" /> Aperçu sans paiement
            </span>
            <span className="flex items-center gap-2 rounded-[var(--radius-md)] bg-bg/15 p-3">
              <CheckCircle2 className="size-4 shrink-0" /> Sources vérifiables
            </span>
          </div>
          <Link
            to="/pro"
            className={buttonVariants({ className: "mt-4 w-full bg-bg text-fg hover:bg-bg/90" })}
          >
            Découvrir les spécialités Premium
            <ArrowRight className="size-4" />
          </Link>
        </section>

        <div className="mt-8 flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
              Entraînement clinique
            </p>
            <h2 className="font-display text-xl font-medium">Dossiers</h2>
          </div>
          <span className="text-xs text-muted">1 offert · aperçus inclus</span>
        </div>
        <div className="mt-3 space-y-2">
          {CLINICAL_CASES.map((clinical) => {
            const unlocked = hasCaseAccess(clinical, entitlements);
            return (
              <Link
                key={clinical.id}
                to="/cas/$caseId"
                params={{ caseId: clinical.id }}
                className="block min-w-0 touch-manipulation rounded-[var(--radius-xl)] bg-card p-4 shadow-[var(--shadow-border)] transition-all hover:bg-secondary active:scale-[0.99]"
              >
                <div className="flex items-start gap-3">
                  <span className={`flex size-10 shrink-0 items-center justify-center rounded-full ${
                    unlocked ? "bg-primary-soft text-primary" : "bg-secondary text-muted"
                  }`}>
                    {unlocked ? <CheckCircle2 className="size-4" /> : <Lock className="size-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-3">
                      <span className="text-xs uppercase tracking-wider text-muted">
                        {clinical.specialty}
                      </span>
                      <span className="shrink-0 text-[11px] uppercase tracking-wider text-subtle">
                        {done.includes(clinical.id) ? "fait" : `${clinical.studyYear}e`}
                      </span>
                    </span>
                    <span className="mt-1 block font-medium">{clinical.title}</span>
                    <span className="mt-1 block text-sm leading-relaxed text-muted">
                      {clinical.summary}
                    </span>
                    <span className="mt-3 flex items-center justify-between text-xs font-medium text-primary">
                      {unlocked ? "Commencer le cas" : "Aperçu gratuit · puis Pack spécialité"}
                      <ArrowRight className="size-4" />
                    </span>
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
        <h2 className="mt-10 font-display text-xl font-medium">Démarche diagnostique</h2>
        <p className="mt-1 text-sm text-muted">Huit étapes, une à la fois.</p>
        <div className="mt-3 space-y-2">
          {DIAGNOSTIC_CASES.map((d) => (
            <Link
              key={d.id}
              to="/demarche/$id"
              params={{ id: d.id }}
              className="block min-w-0 touch-manipulation rounded-[var(--radius-xl)] bg-card p-4 shadow-[var(--shadow-border)] transition-transform active:scale-[0.99]"
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


function specialtyCode(specialty: string): string {
  if (specialty === "Cardiologie") return "CARDIO";
  if (specialty === "Neurologie") return "NEURO";
  if (specialty === "Infectiologie") return "INFECTIO";
  if (specialty === "Urgences") return "URGENCES";
  if (specialty === "Dermatologie") return "DERMATO";
  return specialty.toUpperCase();
}

function hasCaseAccess(
  clinical: (typeof CLINICAL_CASES)[number],
  entitlements: ReturnType<typeof useOptimus.getState>["entitlements"],
): boolean {
  return (
    clinical.access === "free" ||
    hasEntitlement("OPTIMUS_PRO", entitlements) ||
    hasEntitlement(`${specialtyCode(clinical.specialty)}_PACK_10`, entitlements)
  );
}
