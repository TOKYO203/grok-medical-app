import { useState } from "react";
import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Lock,
  Search,
  Sparkles,
  Stethoscope,
} from "lucide-react";
import { Page, Shell } from "@/components/shell";
import { DiagnosticCategoryHub } from "@/components/cases/DiagnosticCategoryHub";
import { CaseHub } from "@/components/cases/CaseHub";
import { buttonVariants } from "@/components/ui/button-variants";
import { CLINICAL_CASES, DIAGNOSTIC_CASES } from "@/content/catalog";
import diagnosticTopics from "@/content/data/diagnostic-topics.json";
import { groupDiagnosticsByCategory } from "@/lib/cases/diagnostic-category-engine";
import { groupDiagnosticsBySpecialty } from "@/lib/cases/diagnostic-organizer";
import { hasEntitlement, useOptimus } from "@/state/store";
import { ClinicalLearningHub } from "@/components/cases/ClinicalLearningHub";

export const Route = createFileRoute("/cas")({ component: CasPage });

function CasPage() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const done = useOptimus((s) => s.casesCompleted);
  const dxDone = useOptimus((s) => s.diagnosticsCompleted);
  const entitlements = useOptimus((s) => s.entitlements);
  const [diagnosticQuery, setDiagnosticQuery] = useState("");
  const normalizedQuery = normalizeSearch(diagnosticQuery);
  const diagnosticCategories = groupDiagnosticsByCategory(diagnosticTopics);
  const visibleDiagnosticTopics = diagnosticTopics.filter((topic) =>
    normalizeSearch(`${topic.title} ${topic.specialty}`).includes(normalizedQuery),
  );

    const diagnosticGroups = groupDiagnosticsBySpecialty(
      diagnosticTopics as any,
    );

  const accessibleCases = CLINICAL_CASES.filter((clinical) => hasCaseAccess(clinical, entitlements));
  const completedClinicalCount = CLINICAL_CASES.filter((clinical) => done.includes(clinical.id)).length;

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

        <div className="mt-5 grid grid-cols-3 gap-2" aria-label="Progression des cas cliniques">
          <CaseSummary label="Accessibles" value={accessibleCases.length} />
          <CaseSummary label="Cas terminés" value={completedClinicalCount} accent />
          <CaseSummary label="Diagnostics" value={dxDone.length} />
        </div>

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
        <div className="mt-3 space-y-3">
          {CLINICAL_CASES.map((clinical) => {
            const unlocked = hasCaseAccess(clinical, entitlements);
            const completed = done.includes(clinical.id);
            return (
              <Link
                key={clinical.id}
                to="/cas/$caseId"
                params={{ caseId: clinical.id }}
                className="optimus-interactive-card block min-w-0 touch-manipulation rounded-[var(--radius-xl)] bg-card p-4 shadow-[var(--shadow-border)] active:scale-[0.99]"
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`flex size-10 shrink-0 items-center justify-center rounded-full shadow-[var(--shadow-border)] ${
                      completed
                        ? "bg-primary text-primary-fg"
                        : unlocked
                          ? "bg-primary-soft text-primary"
                          : "bg-secondary text-muted"
                    }`}
                  >
                    {completed ? (
                      <CheckCircle2 className="size-4" />
                    ) : unlocked ? (
                      <Stethoscope className="size-4" />
                    ) : (
                      <Lock className="size-4" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-3">
                      <span className="text-xs uppercase tracking-wider text-muted">
                        {clinical.specialty}
                      </span>
                      <CaseStatus completed={completed} unlocked={unlocked} />
                    </span>
                    <span className="mt-1 block font-medium">{clinical.title}</span>
                    <span className="mt-1 block text-sm leading-relaxed text-muted">
                      {clinical.summary}
                    </span>
                    <span className="mt-3 flex items-center justify-between text-xs font-medium text-primary">
                      {completed
                        ? "Revoir le cas"
                        : unlocked
                          ? "Commencer le cas"
                          : "Aperçu gratuit · puis Pack spécialité"}
                      <ArrowRight className="size-4" />
                    </span>
                  </span>
                </div>
              </Link>
            );
          })}
        </div>


        <section className="mt-8">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
            Clinical Hub
          </p>

          <CaseHub
            categories={Object.fromEntries(
              Object.entries(diagnosticGroups).map(
                ([key, value]) => [key, (value as any[]).length]
              )
            )}
          />
        </section>

        

<section className="mt-8">

  <ClinicalLearningHub
    topics={diagnosticTopics}
  />

</section>

<section className="mt-10">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
                Programme Internat
              </p>
              <h2 className="font-display text-xl font-medium">Démarche diagnostique devant…</h2>
            </div>
            <span className="shrink-0 text-xs text-muted">
              {visibleDiagnosticTopics.length}/{diagnosticTopics.length}
            </span>
          </div>
          <p className="mt-1 max-w-lg text-sm leading-relaxed text-muted">
            Du symptôme à la prise en charge en huit décisions. Catalogue Premium des 43 chapitres du programme d’orientation diagnostique transmis.
          </p>
          <label className="relative mt-4 block">
            <Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted" />
            <span className="sr-only">Rechercher une démarche diagnostique</span>
            <input
              type="search"
              value={diagnosticQuery}
              onChange={(event) => setDiagnosticQuery(event.target.value)}
              placeholder="Rechercher : dyspnée, hématurie, grossesse…"
              className="h-11 w-full rounded-[var(--radius-md)] bg-card pl-10 pr-3 text-sm shadow-[var(--shadow-border)] outline-none transition-[background-color,box-shadow] focus:bg-surface focus-visible:ring-2 focus-visible:ring-primary/60"
            />
          </label>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {visibleDiagnosticTopics.map((topic) => {
              const diagnostic = topic.routeId
                ? DIAGNOSTIC_CASES.find((item) => item.id === topic.routeId)
                : undefined;
              const completed = diagnostic ? dxDone.includes(diagnostic.id) : false;
              const cardContent = (
                <>
                  <span
                    className={`flex size-9 shrink-0 items-center justify-center rounded-full font-mono text-xs shadow-[var(--shadow-border)] ${
                      completed ? "bg-primary text-primary-fg" : "bg-secondary text-muted"
                    }`}
                  >
                    {completed ? <CheckCircle2 className="size-4" /> : topic.number}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2">
                      <span className="block text-sm font-medium leading-snug">{topic.title}</span>
                      {completed ? (
                        <span className="optimus-status-pill shrink-0 bg-primary-soft text-primary">
                          Terminé
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-1 block text-xs text-muted">{topic.specialty}</span>
                    <span className="mt-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-primary">
                      {diagnostic ? (
                        <>
                          {completed ? <CheckCircle2 className="size-3" /> : <Lock className="size-3" />}
                          {completed ? "Revoir la démarche" : "Premium · aperçu disponible"}
                        </>
                      ) : (
                        <>
                          <Clock3 className="size-3" />
                          Programme Premium · en préparation
                        </>
                      )}
                    </span>
                  </span>
                  {diagnostic ? <ArrowRight className="size-4 shrink-0 text-subtle" /> : null}
                </>
              );
              return diagnostic ? (
                <Link
                  key={topic.id}
                  to="/demarche/$id"
                  params={{ id: diagnostic.id }}
                  className="optimus-interactive-card flex min-h-28 touch-manipulation items-start gap-3 rounded-[var(--radius-xl)] bg-card p-4 shadow-[var(--shadow-border)] active:scale-[0.99]"
                >
                  {cardContent}
                </Link>
              ) : (
                <div
                  key={topic.id}
                  className="flex min-h-28 items-start gap-3 rounded-[var(--radius-xl)] bg-card/70 p-4 shadow-[var(--shadow-border)]"
                >
                  {cardContent}
                </div>
              );
            })}
          </div>
          {visibleDiagnosticTopics.length === 0 ? (
            <p className="mt-4 rounded-[var(--radius-lg)] bg-card p-4 text-sm text-muted shadow-[var(--shadow-border)]">
              Aucun item ne correspond à cette recherche.
            </p>
          ) : null}
        </section>
        <Link to="/calculateurs" className="mt-8 inline-block text-sm text-muted hover:text-fg">
          Calculateurs cliniques →
        </Link>
      </Page>
    </Shell>
  );
}

function CaseSummary({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return (
    <div
      className={`rounded-[var(--radius-lg)] px-3 py-3 text-center shadow-[var(--shadow-border)] ${
        accent ? "bg-primary-soft" : "bg-card"
      }`}
    >
      <p className={`font-display text-xl font-medium ${accent ? "text-primary" : "text-fg"}`}>
        {value}
      </p>
      <p className="mt-0.5 truncate text-[10px] font-medium uppercase tracking-wider text-muted sm:text-[11px]">
        {label}
      </p>
    </div>
  );
}

function CaseStatus({ completed, unlocked }: { completed: boolean; unlocked: boolean }) {
  return (
    <span
      className={`optimus-status-pill shrink-0 ${
        completed
          ? "bg-primary-soft text-primary"
          : unlocked
            ? "bg-secondary text-fg"
            : "bg-warn/15 text-warn"
      }`}
    >
      {completed ? "Terminé" : unlocked ? "Disponible" : "Premium"}
    </span>
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

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}