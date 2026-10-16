successfully downloaded text file (SHA: 8496a216904a3eefbd6d2284b7d82f109fc38edf)
import { useMemo } from "react";
import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { ArrowRight, Sparkles } from "lucide-react";
import ClinicalAIWidget from "@/components/ai/ClinicalAIWidget";
import { ContentCard } from "@/components/content/content-card";
import { Page, PageHeader, SectionTitle, Shell } from "@/components/shell";
import { ScrollToTopButton } from "@/components/scroll-to-top";
import { buttonVariants } from "@/components/ui/button-variants";
import { CLINICAL_CASES } from "@/content/catalog";
import { buildContentIndex } from "@/lib/library/content-index";
import { groupBySpecialty, specialtyEmoji, specialtySlug } from "@/lib/library/specialty-helpers";
import { useAllDecks, useOptimus } from "@/state/store";

export const Route = createFileRoute("/cas")({ component: CasPage });

function CasPage() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const decks = useAllDecks();
  const entitlements = useOptimus((s) => s.entitlements);
  const profile = useOptimus((s) => s.profile);
  const tier = profile.tier;
  const done = useOptimus((s) => s.casesCompleted);
  const index = useMemo(
    () => buildContentIndex({ decks, entitlements, tier, includeTools: false }),
    [decks, entitlements, tier],
  );
  const caseItems = useMemo(() => index.filter((i) => i.kind === "case"), [index]);
  const accessibleCases = caseItems.filter((i) => !i.locked);

  /**
   * Dossiers regroupés par spécialité résolue, du PLUS pertinent au MOINS pertinent
   * pour le profil (matières prioritaires → année d'étude → volume de cas accessibles).
   */
  const caseGroups = useMemo(() => groupBySpecialty(caseItems, profile), [caseItems, profile]);
  const completedClinicalCount = CLINICAL_CASES.filter((clinical) =>
    done.includes(clinical.id),
  ).length;

  if (pathname !== "/cas" && pathname !== "/cas/") {
    return <Outlet />;
  }

  return (
    <Shell title="Cas">
      <Page>
        <ScrollToTopButton />
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
                id={specialtySlug(group.specialty, "cas")}
                /*
                 * Offset d'ancrage = en-tête du Shell (h-14 → 56 px) + en-tête de groupe
                 * collant (mesuré ≈41 px en mobile 390×844 → ≈97 px requis). `scroll-mt-32`
                 * (128 px) garantit que la 1re carte n'est jamais cachée par l'en-tête
                 * collant ; en desktop l'en-tête du Shell est masqué (2px de respiration sous
                 * le bord), 96 px suffisent d'où `md:scroll-mt-24`.
                 */
                className="scroll-mt-32 md:scroll-mt-24"
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
                    <ContentCard
                      key={item.id}
                      item={item}
                      className="scroll-mt-32 md:scroll-mt-24"
                      showSpecialty={false}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
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

