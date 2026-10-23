import { useMemo, useState } from "react";
import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { ArrowRight, Search, Sparkles, X } from "lucide-react";
import ClinicalAIWidget from "@/components/ai/ClinicalAIWidget";
import { ContentCard } from "@/components/content/content-card";
import { Page, PageHeader, SectionTitle, Shell } from "@/components/shell";
import { ScrollToTopButton } from "@/components/scroll-to-top";
import { buttonVariants } from "@/components/ui/button-variants";
import { Input } from "@/components/ui/input";
import { BUILTIN_DECKS, CLINICAL_CASES } from "@/content/catalog";
import { buildContentIndex } from "@/lib/library/content-index";
import {
  groupBySpecialty,
  resolveSpecialty,
  specialtyEmoji,
  specialtyFacets,
  specialtySlug,
} from "@/lib/library/specialty-helpers";
import { seedBuiltinDecks } from "@/state/builtin-decks";
import { useAllDecks, useOptimus } from "@/state/store";

// G51 — code-splitting : le store ne charge plus le catalogue ; cette route
// sème le cache des decks intégrés (évalué côté serveur comme côté client).
seedBuiltinDecks(BUILTIN_DECKS);

export const Route = createFileRoute("/cas")({ component: CasPage });

/** Préfixe des identifiants de cas dans l'index de contenu (`case:<id>`). */
const CASE_ID_PREFIX = "case:";

/** Recherche insensible à la casse et aux accents (épilepsie ≈ epilepsie). */
function fold(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function CasPage() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const decks = useAllDecks();
  const entitlements = useOptimus((s) => s.entitlements);
  const profile = useOptimus((s) => s.profile);
  const tier = profile.tier;
  const done = useOptimus((s) => s.casesCompleted);
  const caseSessions = useOptimus((s) => s.caseSessions);
  const [query, setQuery] = useState("");
  const [specialtyFilter, setSpecialtyFilter] = useState<string | null>(null);
  const index = useMemo(
    () => buildContentIndex({ decks, entitlements, tier, includeTools: false }),
    [decks, entitlements, tier],
  );
  const caseItems = useMemo(() => index.filter((i) => i.kind === "case"), [index]);
  const accessibleCases = caseItems.filter((i) => !i.locked);

  /**
   * Facettes de spécialité : libellés RÉSOLUS (même canonisation que le
   * regroupement), donc une facette ne peut jamais promettre un groupe vide
   * — « Gynécologie / Obstétrique » est rangée sous sa spécialité primaire.
   */
  const facets = useMemo(() => specialtyFacets(caseItems), [caseItems]);

  /**
   * Catalogue filtré pour la navigation : recherche (titre, spécialité,
   * résumé) + facette de spécialité. Les compteurs du résumé restent
   * globaux ; seules les cartes et les groupes se réduisent.
   */
  const filteredItems = useMemo(() => {
    const needle = fold(query.trim());
    return caseItems.filter((item) => {
      const matchesSpecialty = !specialtyFilter || resolveSpecialty(item) === specialtyFilter;
      const haystack = fold(`${item.title} ${item.specialty} ${item.subtitle}`);
      const matchesQuery = !needle || haystack.includes(needle);
      return matchesSpecialty && matchesQuery;
    });
  }, [caseItems, query, specialtyFilter]);

  /**
   * Dossiers regroupés par spécialité résolue, du PLUS pertinent au MOINS pertinent
   * pour le profil (matières prioritaires → année d'étude → volume de cas accessibles).
   */
  const caseGroups = useMemo(() => groupBySpecialty(filteredItems, profile), [filteredItems, profile]);
  const completedClinicalCount = CLINICAL_CASES.filter((clinical) =>
    done.includes(clinical.id),
  ).length;

  /**
   * Phase 2 — reprise : dossiers NON terminés dont une session en cours existe
   * (au moins une étape franchie). Le premier servi par la bannière « Reprendre ».
   */
  const resumableCases = useMemo(
    () =>
      CLINICAL_CASES.filter(
        (clinical) =>
          caseSessions[clinical.id] &&
          !done.includes(clinical.id) &&
          caseSessions[clinical.id].cursor > 0,
      ),
    [caseSessions, done],
  );

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

        {resumableCases.length > 0 ? (
          <Link
            data-cas-resume
            to="/cas/$caseId"
            params={{ caseId: resumableCases[0].id }}
            className={buttonVariants({ className: "mt-3 w-full" })}
          >
            {resumableCases.length === 1
              ? `Reprendre « ${resumableCases[0].title} »`
              : `${resumableCases.length} dossiers en cours — reprendre « ${resumableCases[0].title} »`}
            <ArrowRight className="size-4" />
          </Link>
        ) : null}

        {/* Navigation du catalogue : recherche plein texte + facettes de
            spécialité. `flex-wrap` obligatoire : l'audit mobile 320 px refuse
            tout débordement horizontal, les pastilles doivent passer à la
            ligne plutôt que d'étirer la page. */}
        <section className="mt-5 space-y-3" aria-label="Recherche et filtres des cas cliniques">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
              aria-hidden
            />
            <Input
              data-cas-search
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher un dossier, une spécialité…"
              aria-label="Rechercher un cas clinique"
              className="pl-9 pr-9"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Effacer la recherche"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-fg"
              >
                <X className="size-4" aria-hidden />
              </button>
            ) : null}
          </div>
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label="Filtrer par spécialité"
            data-cas-specialty-filters
          >
            <FilterChip
              label="Toutes"
              count={caseItems.length}
              active={specialtyFilter === null}
              onClick={() => setSpecialtyFilter(null)}
            />
            {facets.map((specialty) => (
              <FilterChip
                key={specialty}
                label={specialty}
                count={caseItems.filter((item) => resolveSpecialty(item) === specialty).length}
                active={specialtyFilter === specialty}
                onClick={() =>
                  setSpecialtyFilter(specialtyFilter === specialty ? null : specialty)
                }
              />
            ))}
          </div>
        </section>

        <section className="mt-8">
          <SectionTitle
            kicker="Entraînement clinique"
            title="Dossiers progressifs"
            action={<span className="text-xs text-muted">Récompense : XP + Maîtrise clinique</span>}
          />
          <p className="-mt-2 mb-3 text-xs text-muted">
            Regroupés par spécialité, du plus proche de votre profil au plus éloigné.
          </p>

          {caseGroups.length === 0 ? (
            <div className="optimus-card p-5 text-center text-sm text-muted">
              Aucun dossier ne correspond à cette recherche.
            </div>
          ) : (
            <div className="space-y-2">
              {caseGroups.map((group) => {
                const completed = group.items.filter((item) =>
                  done.includes(item.id.slice(CASE_ID_PREFIX.length)),
                ).length;
                return (
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
                      {completed > 0 ? (
                        <span className="shrink-0 text-[11px] font-medium text-primary">
                          {completed} terminé{completed > 1 ? "s" : ""}
                        </span>
                      ) : null}
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
                );
              })}
            </div>
          )}
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

function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={buttonVariants({
        variant: active ? "default" : "secondary",
        size: "pill",
      })}
    >
      {label}
      <span className="font-mono text-[11px] tabular-nums opacity-70">{count}</span>
    </button>
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
