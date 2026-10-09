import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { ContentCard } from "@/components/content/content-card";
import { Page, SectionTitle, Shell } from "@/components/shell";
import { deckProgressPct } from "@/core/mastery";
import { COMPETENCY_LABEL, type Competency } from "@/core/types";
import {
  buildContentIndex,
  KIND_META,
  LEVEL_LABEL,
  uniqueSorted,
  type ContentKind,
  type ContentLevel,
} from "@/lib/library/content-index";
import { useAllDecks, useOptimus } from "@/state/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/bibliotheque")({ component: BibliothequePage });

const KIND_ORDER: ContentKind[] = ["deck", "case", "diagnostic", "tool"];
const LEVEL_ORDER: ContentLevel[] = ["intro", "intermediate", "advanced"];

function BibliothequePage() {
  const decks = useAllDecks();
  const entitlements = useOptimus((s) => s.entitlements);
  const tier = useOptimus((s) => s.profile.tier);
  const progress = useOptimus((s) => s.progress);
  const profile = useOptimus((s) => s.profile);

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

  const specialties = useMemo(() => uniqueSorted(items.map((i) => i.specialty)), [items]);
  const years = useMemo(
    () => uniqueSorted(items.map((i) => i.year)).sort((a, b) => Number(a) - Number(b)),
    [items],
  );
  const competencies = useMemo(() => {
    const set = new Set<Competency>();
    for (const item of items) item.competencies.forEach((c) => set.add(c));
    return [...set];
  }, [items]);

  const recommended = useMemo(() => {
    const priority = profile.prioritySubjects.map((s) => s.toLowerCase());
    return items
      .filter((i) => !i.locked && i.kind === "deck")
      .map((i) => {
        let score = progressById.get(i.id) ? 1 : 0;
        if (priority.some((p) => i.specialty.toLowerCase().includes(p))) score += 2;
        if (profile.studyYear > 0 && i.year === profile.studyYear) score += 2;
        return { item: i, score };
      })
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map((row) => row.item);
  }, [items, progressById, profile.prioritySubjects, profile.studyYear]);

  const normalized = query.trim().toLowerCase();
  const filtered = items.filter((item) => {
    if (kinds.length && !kinds.includes(item.kind)) return false;
    if (specialty && item.specialty !== specialty) return false;
    if (level && item.level !== level) return false;
    if (year !== null && item.year !== year) return false;
    if (competency && !item.competencies.includes(competency)) return false;
    if (normalized) {
      const haystack = `${item.title} ${item.subtitle} ${item.specialty}`.toLowerCase();
      if (!haystack.includes(normalized)) return false;
    }
    return true;
  });

  const activeFilters =
    kinds.length + (specialty ? 1 : 0) + (level ? 1 : 0) + (year !== null ? 1 : 0) + (competency ? 1 : 0);
  const accessibleCount = items.filter((i) => !i.locked).length;

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

  return (
    <Shell title="Bibliothèque">
      <Page>
        <header className="max-w-2xl">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
            Tout le contenu
          </p>
          <h1 className="mt-1 font-display text-3xl font-medium tracking-tight md:text-4xl">
            Bibliothèque
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Decks, cas cliniques, démarches diagnostiques et outils réunis dans un seul endroit —
            filtrables par spécialité, année, niveau et compétence.
          </p>
        </header>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <Metric label="Éléments" value={items.length} />
          <Metric label="Accessibles" value={accessibleCount} accent />
          <Metric label="Spécialités" value={specialties.length} />
        </div>

        {/* Barre de recherche */}
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
              className="h-11 w-full rounded-[var(--radius-md)] bg-card pl-9 pr-3 text-sm text-fg shadow-[var(--shadow-border)] outline-none transition-shadow placeholder:text-subtle focus-visible:ring-2 focus-visible:ring-ring/70"
            />
          </label>
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            aria-expanded={showFilters}
            className={cn(
              "relative flex h-11 items-center gap-2 rounded-[var(--radius-md)] px-3 text-sm font-medium shadow-[var(--shadow-border)] transition-colors",
              showFilters || activeFilters ? "bg-primary-soft text-primary" : "bg-card text-muted hover:text-fg",
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

        {recommended.length > 0 && kinds.length === 0 && !normalized ? (
          <section className="mt-8">
            <SectionTitle kicker="Pour vous" title="Recommandé selon votre profil" />
            <div className="grid gap-3 sm:grid-cols-2">
              {recommended.map((item) => (
                <ContentCard key={item.id} item={item} progress={progressById.get(item.id)} />
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-8">
          <SectionTitle
            kicker={activeFilters || normalized ? `${filtered.length} résultat${filtered.length > 1 ? "s" : ""}` : "Explorer"}
            title={activeFilters || normalized ? "Résultats filtrés" : "Tout le contenu"}
          />
          {filtered.length === 0 ? (
            <div className="optimus-card p-6 text-center">
              <p className="text-sm text-muted">Aucun contenu ne correspond à ces critères.</p>
              <button
                type="button"
                onClick={reset}
                className="mt-3 text-sm font-medium text-primary hover:underline"
              >
                Réinitialiser la recherche
              </button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((item) => (
                <ContentCard key={item.id} item={item} progress={progressById.get(item.id)} />
              ))}
            </div>
          )}
        </section>
      </Page>
    </Shell>
  );
}

function Metric({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="optimus-card px-3 py-3 text-center">
      <p
        className={cn(
          "font-display text-2xl font-medium tabular-nums",
          accent ? "text-primary" : "text-fg",
        )}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[11px] uppercase tracking-wider text-muted">{label}</p>
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
