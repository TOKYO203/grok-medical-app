import { useMemo, useState } from "react";
import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, Clock3, Lock, Search, Sparkles } from "lucide-react";
import ClinicalAIWidget from "@/components/ai/ClinicalAIWidget";
import { ContentCard } from "@/components/content/content-card";
import { Page, PageHeader, SectionTitle, Shell } from "@/components/shell";
import { buttonVariants } from "@/components/ui/button-variants";
import { CLINICAL_CASES, DIAGNOSTIC_CASES } from "@/content/catalog";
import diagnosticTopics from "@/content/data/diagnostic-topics.json";
import { buildContentIndex, type ContentItem } from "@/lib/library/content-index";
import type { Profile } from "@/core/types";
import { useAllDecks, useOptimus } from "@/state/store";

export const Route = createFileRoute("/cas")({ component: CasPage });

function CasPage() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const decks = useAllDecks();
  const entitlements = useOptimus((s) => s.entitlements);
  const profile = useOptimus((s) => s.profile);
  const tier = profile.tier;
  const done = useOptimus((s) => s.casesCompleted);
  const dxDone = useOptimus((s) => s.diagnosticsCompleted);
  const [diagnosticQuery, setDiagnosticQuery] = useState("");

  const index = useMemo(
    () => buildContentIndex({ decks, entitlements, tier, includeTools: false }),
    [decks, entitlements, tier],
  );
  const caseItems = useMemo(() => index.filter((i) => i.kind === "case"), [index]);
  const accessibleCases = caseItems.filter((i) => !i.locked);

  /**
   * Dossiers regroupés par spécialité.
   * « Inversion » validée : les groupes sont ordonnés du PLUS pertinent au MOINS
   * pertinent pour le profil (matières prioritaires → année d'étude → volume de cas
   * accessibles), et non selon l'ordre d'insertion du catalogue.
   */
  const caseGroups = useMemo(() => {
    const bySpecialty = new Map<string, ContentItem[]>();
    for (const item of caseItems) {
      const list = bySpecialty.get(item.specialty) ?? [];
      list.push(item);
      bySpecialty.set(item.specialty, list);
    }
    return [...bySpecialty.entries()]
      .map(([specialty, items]) => ({ specialty, items }))
      .sort(
        (a, b) =>
          caseGroupRelevance(b.items, profile) - caseGroupRelevance(a.items, profile) ||
          a.specialty.localeCompare(b.specialty, "fr"),
      );
  }, [caseItems, profile]);
  const completedClinicalCount = CLINICAL_CASES.filter((clinical) => done.includes(clinical.id)).length;

  const normalizedQuery = normalizeSearch(diagnosticQuery);
  const visibleDiagnosticTopics = diagnosticTopics.filter((topic) =>
    normalizeSearch(`${topic.title} ${topic.specialty}`).includes(normalizedQuery),
  );

  if (pathname !== "/cas" && pathname !== "/cas/") {
    return <Outlet />;
  }

  return (
    <Shell title="Cas">
      <Page>
        <PageHeader
          kicker="Raisonnement clinique"
          title="Cas cliniques"
          description="Un cas n’est pas un QCM : le dossier se révèle, puis viennent les décisions. Chaque étape entraîne le raisonnement et la conduite pratique."
        />

        <div className="mt-5 grid grid-cols-3 gap-2" aria-label="Progression des cas cliniques">
          <Summary label="Dossiers" value={caseItems.length} />
          <Summary label="Accessibles" value={accessibleCases.length} accent />
          <Summary label="Terminés" value={completedClinicalCount} />
        </div>

        <section className="mt-8">
          <SectionTitle
            kicker="Entraînement clinique"
            title="Dossiers progressifs"
            action={<span className="text-xs text-muted">Récompense : XP + Maîtrise clinique</span>}
          />
          <p className="-mt-2 mb-3 text-xs text-muted">
            Regroupés par spécialité, du plus proche de votre profil au plus éloigné.
          </p>

          {/* Vue groupée : un en-tête collant par spécialité, les cartes défilent dessous. */}
          <div className="space-y-2">
            {caseGroups.map((group) => (
              <section
                key={group.specialty}
                id={specialtySlug(group.specialty)}
                /*
                 * scroll-mt-24 (96 px) = en-tête du Shell (h-14 → 56 px) + en-tête de groupe
                 * collant (~40 px) sur mobile (390×844). Sans cette marge, un saut d'ancre
                 * (ou l'ancrage de défilement du navigateur) poserait la 1re carte du groupe
                 * SOUS l'en-tête collant. En desktop l'en-tête du Shell est masqué, mais on
                 * garde la marge : le coût est nul et le comportement reste cohérent.
                 */
                className="scroll-mt-24"
              >
                <div className="sticky top-14 z-10 -mx-5 mb-3 flex items-center gap-2 border-b border-border bg-bg/85 px-5 py-2 backdrop-blur-xl md:-mx-10 md:top-2 md:px-10">
                  <span className="text-base" aria-hidden>
                    {specialtyEmoji(group.specialty)}
                  </span>
                  <h3 className="min-w-0 flex-1 truncate font-display text-sm font-medium tracking-tight text-fg">
                    {group.specialty}
                  </h3>
                  <span className="shrink-0 font-mono text-[11px] tabular-nums text-subtle">
                    {group.items.length}
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {group.items.map((item) => (
                    <ContentCard key={item.id} item={item} className="scroll-mt-24" showSpecialty={false} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
                Programme internat
              </p>
              <h2 className="font-display text-xl font-medium tracking-tight md:text-2xl">
                Démarche diagnostique devant…
              </h2>
            </div>
            <span className="shrink-0 text-xs text-muted">
              {visibleDiagnosticTopics.length}/{diagnosticTopics.length}
            </span>
          </div>
          <p className="mt-1 max-w-lg text-sm leading-relaxed text-muted">
            Du symptôme à la prise en charge, décision par décision. Catalogue des chapitres du
            programme d’orientation diagnostique.
          </p>

          <label className="relative mt-4 block">
            <Search
              className="pointer-events-none absolute left-3 top-3.5 size-4 text-subtle"
              aria-hidden
            />
            <span className="sr-only">Rechercher une démarche diagnostique</span>
            <input
              type="search"
              value={diagnosticQuery}
              onChange={(event) => setDiagnosticQuery(event.target.value)}
              placeholder="Rechercher : dyspnée, hématurie, grossesse…"
              className="h-11 w-full rounded-[var(--radius-md)] bg-card pl-10 pr-3 text-sm shadow-[var(--shadow-border)] outline-none transition-shadow placeholder:text-subtle focus-visible:ring-2 focus-visible:ring-ring/70"
            />
          </label>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {visibleDiagnosticTopics.map((topic) => {
              const diagnostic = topic.routeId
                ? DIAGNOSTIC_CASES.find((item) => item.id === topic.routeId)
                : undefined;
              const completed = diagnostic ? dxDone.includes(diagnostic.id) : false;
              const content = (
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
                          {completed ? (
                            <CheckCircle2 className="size-3" />
                          ) : (
                            <Lock className="size-3" />
                          )}
                          {completed ? "Revoir la démarche" : "Aperçu disponible"}
                        </>
                      ) : (
                        <>
                          <Clock3 className="size-3" />
                          En préparation
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
                  className="optimus-card optimus-interactive-card flex min-h-28 touch-manipulation items-start gap-3 p-4 active:scale-[0.99]"
                >
                  {content}
                </Link>
              ) : (
                <div
                  key={topic.id}
                  className="flex min-h-28 items-start gap-3 rounded-[var(--radius-lg)] bg-card/70 p-4 shadow-[var(--shadow-border)]"
                >
                  {content}
                </div>
              );
            })}
          </div>
          {visibleDiagnosticTopics.length === 0 ? (
            <p className="optimus-card mt-4 p-4 text-sm text-muted">
              Aucun item ne correspond à cette recherche.
            </p>
          ) : null}
        </section>

        <section className="mt-8">
          <ClinicalAIWidget />
        </section>

        <section className="mt-8 flex flex-col gap-3 rounded-[var(--radius-xl)] bg-card p-5 shadow-[var(--shadow-border)] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
            <div>
              <p className="font-medium">Débloquer tous les dossiers</p>
              <p className="mt-0.5 text-sm text-muted">
                Un cas offert ; les cas avancés sont inclus dans chaque spécialité Premium.
              </p>
            </div>
          </div>
          <Link to="/pro" className={buttonVariants({ className: "shrink-0" })}>
            Découvrir Premium
            <ArrowRight className="size-4" />
          </Link>
        </section>
      </Page>
    </Shell>
  );
}

function Summary({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="optimus-card px-3 py-3 text-center">
      <p
        className={`font-display text-2xl font-medium tabular-nums ${
          accent ? "text-primary" : "text-fg"
        }`}
      >
        {value}
      </p>
      <p className="mt-0.5 truncate text-[11px] font-medium uppercase tracking-wider text-muted">
        {label}
      </p>
    </div>
  );
}

/**
 * Pertinence d'un groupe de cas pour le profil courant.
 * Priorité : matières prioritaires (4) > année d'étude (2) > nombre de cas accessibles.
 * Sert au tri « du plus pertinent au moins pertinent » des groupes de spécialité.
 */
function caseGroupRelevance(items: ContentItem[], profile: Profile): number {
  const priority = profile.prioritySubjects.some((subject) => {
    const needle = subject.toLowerCase();
    return items.some(
      (item) =>
        item.specialty.toLowerCase().includes(needle) ||
        needle.includes(item.specialty.toLowerCase()),
    );
  });
  const yearMatch = profile.studyYear > 0 && items.some((item) => item.year === profile.studyYear);
  const accessible = items.filter((item) => !item.locked).length;
  return (priority ? 4 : 0) + (yearMatch ? 2 : 0) + accessible;
}

/** Emoji d'illustration par spécialité (repli : 🩺). */
function specialtyEmoji(specialty: string): string {
  const s = specialty.toLowerCase();
  if (s.includes("cardio")) return "🫀";
  if (s.includes("neuro")) return "🧠";
  if (s.includes("infectio")) return "🦠";
  if (s.includes("pneumo")) return "🫁";
  if (s.includes("dermato")) return "🩹";
  if (s.includes("nephro")) return "🫘";
  if (s.includes("gastro") || s.includes("hepato")) return "🫃";
  return "🩺";
}

/** Identifiant d'ancre stable et sans accents à partir d'une spécialité. */
function specialtySlug(specialty: string): string {
  return `cas-${specialty
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")}`;
}

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
