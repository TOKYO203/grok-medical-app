import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Search, SearchX, SlidersHorizontal, X } from "lucide-react";
import { ContentCard } from "@/components/content/content-card";
import { EmptyState } from "@/components/empty-state";
import { SpecialtyGroupHeader } from "@/components/content/specialty-group-header";
import { Page, PageHeader, SectionTitle, Shell } from "@/components/shell";
import { ScrollToTopButton } from "@/components/scroll-to-top";
import { deckProgressPct } from "@/core/mastery";
import { COMPETENCY_LABEL, type Competency } from "@/core/types";
import {
  buildContentIndex,
  KIND_META,
  LEVEL_LABEL,
  uniqueSorted,
  type ContentItem,
  type ContentKind,
  type ContentLevel,
} from "@/lib/library/content-index";
import {
  groupBySpecialty,
  resolveSpecialty,
  specialtyFacets,
  specialtySlug,
} from "@/lib/library/specialty-helpers";
import { seedBuiltinDecks } from "@/state/builtin-decks";
import { BUILTIN_DECKS } from "@/content/catalog";
import { useAllDecks, useOptimus } from "@/state/store";
import { cn } from "@/lib/utils";

// G51 — code-splitting : le store ne charge plus le catalogue ; cette route
// sème le cache des decks intégrés (évalué côté serveur comme côté client).
seedBuiltinDecks(BUILTIN_DECKS);

export const Route = createFileRoute("/bibliotheque")({ component: BibliothequePage });

const KIND_ORDER: ContentKind[] = ["deck", "case", "diagnostic", "tool"];
const LEVEL_ORDER: ContentLevel[] = ["intro", "intermediate", "advanced"];

function BibliothequePage() {
  const decks = useAllDecks();
  const entitlements = useOptimus((s) => s.entitlements);
  const tier = useOptimus((s) => s.profile.tier);
  const progress = useOptimus((s) => s.progress);
  const profile = useOptimus((s) => s.profile);
  const casesCompleted = useOptimus((s) => s.casesCompleted);
  const diagnosticsCompleted = useOptimus((s) => s.diagnosticsCompleted);

  const [query, setQuery] = useState("");
  const [kinds, setKinds] = useState<ContentKind[]>([]);
  const [specialty, setSpecialty] = useState<string | null>(null);
  const [level, setLevel] = useState<ContentLevel | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const [competency, setCompetency] = useState<Competency | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const items = useMemo(
    () => buildContentIndex({ decks, entitlements, tier }),
    [decks, entitlements, tier],
  );

  const progressById = useMemo(() => {
    const map = new Map<string, number>();
    for (const deck of decks) {
      const pct = deckProgressPct(deck, progress[deck.id]);
      if (pct > 0) map.set(`deck:${deck.id}`, pct);
    }
    return map;
  }, [decks, progress]);

  // Spécialités « résolues » (decks mappés sur le curriculum) — un deck neuro rangé
  // sous « Clinique » dans le catalogue apparaît bien sous « Neurologie » ici.
  const specialties = useMemo(() => specialtyFacets(items), [items]);
  const years = useMemo(
    () => uniqueSorted(items.map((i) => i.year)).sort((a, b) => Number(a) - Number(b)),
    [items],
  );
  const competencies = useMemo(() => {
    const set = new Set<Competency>();
    for (const item of items) item.competencies.forEach((c) => set.add(c));
    return [...set];
  }, [items]);

  const normalized = query.trim().toLowerCase();
  const filtered = items.filter((item) => {
    if (kinds.length && !kinds.includes(item.kind)) return false;
    if (specialty && resolveSpecialty(item) !== specialty) return false;
    if (level && item.level !== level) return false;
    if (year !== null && item.year !== year) return false;
    if (competency && !item.competencies.includes(competency)) return false;
    if (normalized) {
      const haystack =
        `${item.title} ${item.subtitle} ${item.specialty} ${resolveSpecialty(item)}`.toLowerCase();
      if (!haystack.includes(normalized)) return false;
    }
    return true;
  });

  const activeFilters =
    kinds.length +
    (specialty ? 1 : 0) +
    (level ? 1 : 0) +
    (year !== null ? 1 : 0) +
    (competency ? 1 : 0);
  const accessibleCount = items.filter((i) => !i.locked).length;
  const kindCount = new Set(items.map((i) => i.kind)).size;

  /** Résultats regroupés par spécialité résolue (en-têtes collants, pattern /cas). */
  const groups = useMemo(() => groupBySpecialty(filtered, profile), [filtered, profile]);

  function reset() {
    setKinds([]);
    setSpecialty(null);
    setLevel(null);
    setYear(null);
    setCompetency(null);
    setQuery("");
  }

  function toggleKind(kind: ContentKind) {
    setKinds((prev) => (prev.includes(kind) ? prev.filter((k) => k !== kind) : [...prev, kind]));
  }

  /*
   * D38 — badge « Nouveau » : contenu débloqué jamais exploré par ce
   * profil. Le catalogue médical est gelé (aucune date d'ajout disponible),
   * la nouveauté se lit donc du point de vue de l'utilisateur : un deck sans
   * progression, un cas ou une démarche jamais terminée. Le Parcours
   * expose déjà le même signal via sa pilule DeckStatus.
   */
  function isNewContent(item: ContentItem): boolean {
    if (item.locked) return false;
    if (item.kind === "deck") return !progressById.has(item.id);
    const rawId = item.id.split(":")[1] ?? item.id;
    if (item.kind === "case") return !casesCompleted.includes(rawId);
    if (item.kind === "diagnostic") return !diagnosticsCompleted.includes(rawId);
    return false;
  }

  return (
    <Shell title="Bibliothèque">
      <Page>
        <ScrollToTopButton />
        <PageHeader
          kicker="Tout le contenu"
          title="Bibliothèque"
          description="Decks, cas cliniques, démarches et outils réunis, groupés par spécialité — du plus proche de votre profil au plus éloigné."
        />

        {/* Bandeau de statistiques — séparé par des hairlines (esprit Stripe). */}
        <div className="mt-6 flex items-stretch divide-x divide-border overflow-hidden rounded-[var(--radius-lg)] bg-bg-elevated shadow-[var(--shadow-border)]">
          <Stat label="Contenus" value={items.length} />
          <Stat label="Accessibles" value={accessibleCount} accent />
          <Stat label="Spécialités" value={specialties.length} />
          <Stat label="Types" value={kindCount} />
        </div>

        {/* Recherche + filtres (logique inchangée). */}
        <div className="mt-5 flex gap-2">
          <label className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle"
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un sujet, une spécialité…"
              aria-label="Rechercher dans la bibliothèque"
              className="h-11 w-full rounded-[var(--radius-md)] bg-card pl-9 pr-3 text-sm text-fg shadow-[var(--shadow-border)] outline-none transition-shadow placeholder:text-subtle focus-visible:ring-2 focus-visible:ring-accent/60"
            />
          </label>
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            aria-expanded={showFilters}
            className={cn(
              "relative flex h-11 items-center gap-2 rounded-[var(--radius-md)] px-3 text-sm font-medium shadow-[var(--shadow-border)] transition-colors",
              showFilters || activeFilters
                ? "bg-primary-soft text-primary"
                : "bg-card text-muted hover:text-fg",
            )}
          >
            <SlidersHorizontal className="size-4" aria-hidden />
            Filtres
            {activeFilters > 0 ? (
              <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-fg">
                {activeFilters}
              </span>
            ) : null}
          </button>
        </div>

        {/* Type — toujours visible */}
        <div className="mt-3 -mx-5 flex gap-2 overflow-x-auto px-5 pb-1 md:mx-0 md:flex-wrap md:px-0">
          <FilterChip active={kinds.length === 0} onClick={() => setKinds([])}>
            Tout
          </FilterChip>
          {KIND_ORDER.map((kind) => (
            <FilterChip key={kind} active={kinds.includes(kind)} onClick={() => toggleKind(kind)}>
              <span aria-hidden>{KIND_META[kind].emoji}</span>
              {KIND_META[kind].label}
            </FilterChip>
          ))}
        </div>

        {showFilters ? (
          <div className="mt-3 space-y-4 rounded-[var(--radius-lg)] bg-bg-elevated p-4 shadow-[var(--shadow-border)]">
            <FilterRow label="Spécialité">
              <FilterChip active={specialty === null} onClick={() => setSpecialty(null)}>
                Toutes
              </FilterChip>
              {specialties.map((s) => (
                <FilterChip key={s} active={specialty === s} onClick={() => setSpecialty(s)}>
                  {s}
                </FilterChip>
              ))}
            </FilterRow>

            <FilterRow label="Niveau">
              <FilterChip active={level === null} onClick={() => setLevel(null)}>
                Tous
              </FilterChip>
              {LEVEL_ORDER.map((l) => (
                <FilterChip key={l} active={level === l} onClick={() => setLevel(l)}>
                  {LEVEL_LABEL[l]}
                </FilterChip>
              ))}
            </FilterRow>

            <FilterRow label="Année">
              <FilterChip active={year === null} onClick={() => setYear(null)}>
                Toutes
              </FilterChip>
              {years.map((y) => (
                <FilterChip key={y} active={year === Number(y)} onClick={() => setYear(Number(y))}>
                  {Number(y) <= 6 ? `${y}ᵉ année` : y}
                </FilterChip>
              ))}
            </FilterRow>

            <FilterRow label="Compétence">
              <FilterChip active={competency === null} onClick={() => setCompetency(null)}>
                Toutes
              </FilterChip>
              {competencies.map((c) => (
                <FilterChip key={c} active={competency === c} onClick={() => setCompetency(c)}>
                  {COMPETENCY_LABEL[c]}
                </FilterChip>
              ))}
            </FilterRow>

            {activeFilters > 0 ? (
              <button
                type="button"
                onClick={reset}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-fg"
              >
                <X className="size-3.5" aria-hidden />
                Réinitialiser les filtres
              </button>
            ) : null}
          </div>
        ) : null}

        <section className="mt-10">
          <SectionTitle
            kicker={
              activeFilters || normalized
                ? `${filtered.length} résultat${filtered.length > 1 ? "s" : ""}`
                : "Explorer"
            }
            title={activeFilters || normalized ? "Résultats filtrés" : "Tout le contenu"}
          />
          {groups.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="Aucun contenu ne correspond à ces critères"
              description="Essayez un autre mot-clé ou élargissez les filtres pour retrouver le catalogue complet."
              action={
                <button
                  type="button"
                  onClick={reset}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Réinitialiser la recherche
                </button>
              }
            />
          ) : (
            /*
             * Groupes de spécialité : en-tête éditorial collant + grille de cartes.
             * `gap-12 md:gap-16` = la respiration verticale entre spécialités.
             */
            <div className="flex flex-col gap-12 md:gap-16">
              {groups.map((group) => (
                <section
                  key={group.specialty}
                  id={specialtySlug(group.specialty, "bib")}
                  /*
                   * Offset d'ancrage : en-tête du Shell (56 px) + en-tête de groupe collant
                   * (mesuré ≈71 px en mobile 390×844 → ≈127 px requis). `scroll-mt-32` (128 px)
                   * en mobile ; 96 px suffisent en desktop (pas d'en-tête Shell collant).
                   */
                  className="scroll-mt-32 md:scroll-mt-24"
                >
                  {/*
                   * En-tête collant (décision validée 2026-10-10) :
                   *  - mobile  : `top-14` = hauteur de l'en-tête du Shell (h-14), l'en-tête
                   *    de groupe se colle juste dessous ;
                   *  - desktop : `md:top-2` = respiration de 8 px sous le bord supérieur
                   *    (layout sidebar, pas d'en-tête Shell collant) — wireframe validé.
                   * Ne pas repasser à `md:top-0` : l'en-tête toucherait le bord.
                   */}
                  <SpecialtyGroupHeader
                    specialty={group.specialty}
                    items={group.items}
                    progressById={progressById}
                    className="sticky top-14 z-10 -mx-5 px-5 md:-mx-10 md:top-2 md:px-10"
                  />
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {group.items.map((item) => (
                      <ContentCard
                        key={item.id}
                        item={item}
                        progress={progressById.get(item.id)}
                        className="scroll-mt-32 md:scroll-mt-24"
                        showSpecialty={false}
                        premium
                        isNew={isNewContent(item)}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </section>
      </Page>
    </Shell>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-2 py-3 text-center">
      <p
        className={cn(
          "font-display text-xl font-medium tabular-nums md:text-2xl",
          accent ? "text-accent" : "text-fg",
        )}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-muted">{label}</p>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
        active
          ? "bg-primary text-primary-fg shadow-[var(--shadow-soft)]"
          : "bg-card text-muted shadow-[var(--shadow-border)] hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted">{label}</p>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 md:flex-wrap md:overflow-visible">
        {children}
      </div>
    </div>
  );
}
