import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, BookOpen, ChevronDown, ChevronRight, Search, X } from "lucide-react";
import { Page, PageHeader, Shell } from "@/components/shell";
import { ScrollToTopButton } from "@/components/scroll-to-top";
import {
  getDefaultProgramme,
  listProgrammes,
  programmeItemCount,
  programmeItemKey,
  type ProgrammeItem,
} from "@/content/programme";
import {
  librarySpecialtyLabels,
  slugify,
  specialtyEmoji,
  specialtySlug,
} from "@/lib/library/specialty-helpers";
import { hasPathologyContent, listPathologySummaries } from "@/lib/pathologies/manifest";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/competences")({ component: ProgrammePage });

const MONTHS_FR = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

/**
 * Formate une date ISO `YYYY-MM-DD` sans passer par `Date` : évite tout décalage
 * de fuseau (donc tout mismatch d'hydratation entre serveur et client).
 */
function formatIsoDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return "";
  const [, year, month, day] = match;
  const label = MONTHS_FR[Number(month) - 1];
  if (!label) return "";
  return `${Number(day)} ${label} ${year}`;
}

function ProgrammePage() {
  const programmes = listProgrammes();

  const [programmeId, setProgrammeId] = useState<string | null>(null);
  const [openSectionId, setOpenSectionId] = useState<string | null>(null);
  const [specialty, setSpecialty] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const programme = useMemo(
    () => programmes.find((item) => item.id === programmeId) ?? getDefaultProgramme(),
    [programmes, programmeId],
  );

  // Sémiologie = doublon avec /demarche (Orientation diagnostique) → exclue de la Nosographie.
  const sections = useMemo(
    () => (programme?.sections ?? []).filter((sec) => sec.id !== "semiologie"),
    [programme],
  );

  /**
   * Spécialités de la Bibliothèque réellement peuplées (slug → libellé canonique).
   * Un item ne devient cliquable que si un groupe existe : pas d'ancre morte.
   */
  const libraryBySlug = useMemo(() => {
    const map = new Map<string, string>();
    for (const label of librarySpecialtyLabels()) map.set(slugify(label), label);
    return map;
  }, []);

  /**
   * Items dont la fiche de nosographie est réellement ouvrable (déclarée au
   * manifeste ET branchée sur un chargeur). Un item sans fiche n'affiche aucun
   * lien : jamais de lien mort, même règle que les ancres de spécialité.
   */
  const itemFiches = useMemo(
    () =>
      new Set(
        listPathologySummaries()
          .filter((entry) => hasPathologyContent(entry.programmeId))
          .map((entry) => entry.programmeId),
      ),
    [],
  );

  const normalized = query.trim().toLowerCase();

  const matchesQuery = useMemo(
    () => (item: ProgrammeItem) =>
      !normalized || `${item.title} ${item.specialty}`.toLowerCase().includes(normalized),
    [normalized],
  );

  /** Spécialités proposées au filtre : celles du périmètre courant (section + recherche). */
  /** Nombre distinct de specialites (compteur du bandeau stats). */
  const distinctSpecialtyCount = useMemo(() => {
    const set = new Set<string>();
    for (const section of sections) {
      for (const item of section.items) {
        if (!matchesQuery(item)) continue;
        set.add(item.specialty);
      }
    }
    return set.size;
  }, [sections, matchesQuery]);

  /** Specialites par section (pour les chips dans chaque accordeon). */
  const specialtyOptionsBySection = useMemo(() => {
    const map = new Map<string, { specialty: string; count: number }[]>();
    for (const section of sections) {
      const counts = new Map<string, number>();
      for (const item of section.items) {
        if (!matchesQuery(item)) continue;
        counts.set(item.specialty, (counts.get(item.specialty) ?? 0) + 1);
      }
      map.set(
        section.id,
        [...counts.entries()]
          .map(([label, count]) => ({ specialty: label, count }))
          .sort((a, b) => b.count - a.count || a.specialty.localeCompare(b.specialty, "fr")),
      );
    }
    return map;
  }, [sections, matchesQuery]);

  /** Sections visibles avec leurs items filtrés (les sections vides disparaissent). */
  const visibleSections = useMemo(() => {
    // Mode recherche : toutes les sections avec des resultats sont ouvertes.
    // Mode normal : seule la section ouverte est visible.
    const scope = normalized
      ? sections
      : openSectionId
        ? sections.filter((s) => s.id === openSectionId)
        : [];

    return scope
      .map((section) => ({
        section,
        items: section.items.filter(
          (item) => (!specialty || item.specialty === specialty) && matchesQuery(item),
        ),
      }))
      .filter((entry) => entry.items.length > 0);
  }, [sections, openSectionId, specialty, matchesQuery, normalized]);

  const visibleCount = visibleSections.reduce((sum, entry) => sum + entry.items.length, 0);

  const coverage = useMemo(() => {
    const items = sections.flatMap((section) => section.items);
    const covered = items.filter((item) => libraryBySlug.has(slugify(item.specialty))).length;
    return { covered, total: items.length };
  }, [sections, libraryBySlug]);

  const total = programme ? programmeItemCount(programme) : 0;
  const filtered = Boolean(openSectionId || specialty || normalized);

  function reset() {
    setOpenSectionId(null);
    setSpecialty(null);
    setQuery("");
  }

  function toggleSection(id: string) {
    if (openSectionId === id) {
      setOpenSectionId(null);
      setSpecialty(null);
    } else {
      setOpenSectionId(id);
      setSpecialty(null);
    }
  }

  return (
    <Shell title="Compétences">
      <Page>
        <ScrollToTopButton />
        <PageHeader
          kicker={programme ? `${programme.flag} ${programme.pays} · ${programme.annee}` : "Référentiel"}
          title="Compétences"
          description={
            programme
              ? `Les ${total} items officiels du concours, tels que publiés. Les spécialités déjà couvertes par vos decks ouvrent directement le contenu correspondant.`
              : "Aucun référentiel n’est disponible pour le moment."
          }
        />

        {programme ? (
          <>
            {/* Bandeau de statistiques — séparé par des hairlines (esprit Stripe). */}
            <div className="mt-6 flex items-stretch divide-x divide-border overflow-hidden rounded-[var(--radius-lg)] bg-bg-elevated shadow-[var(--shadow-border)]">
              <Stat label="Items" value={total} />              <Stat label="Spécialités" value={distinctSpecialtyCount} />
              <Stat label="Couverts" value={coverage.covered} accent />
            </div>

            <p className="mt-3 text-xs leading-relaxed text-subtle">
              {programme.autorite}
              {programme.date ? ` · publié le ${formatIsoDate(programme.date)}` : ""}
            </p>

            {programmes.length > 1 ? (
              <div className="mt-4 -mx-5 flex gap-2 overflow-x-auto px-5 pb-1 md:mx-0 md:flex-wrap md:px-0">
                {programmes.map((item) => (
                  <Chip
                    key={item.id}
                    active={item.id === programme.id}
                    onClick={() => {
                      setProgrammeId(item.id);
                      reset();
                    }}
                  >
                    <span aria-hidden>{item.flag}</span>
                    {item.short}
                  </Chip>
                ))}
              </div>
            ) : null}

            {/* Accordeon des sections du referentiel */}
            <div className="mt-5 space-y-2">
              {sections.map((section) => {
                const isOpen = openSectionId === section.id;
                const opts = specialtyOptionsBySection.get(section.id) ?? [];
                return (
                  <div
                    key={section.id}
                    className={cn(
                      "overflow-hidden rounded-[var(--radius-lg)] bg-card shadow-[var(--shadow-border)] transition-colors",
                      isOpen && "ring-2 ring-primary/40",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSection(section.id)}
                      aria-expanded={isOpen}
                      className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-secondary"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        {isOpen ? (
                          <ChevronDown className="size-4 shrink-0 text-primary" aria-hidden />
                        ) : (
                          <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
                        )}
                        <span className="truncate font-medium">{section.label}</span>
                      </div>
                      <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 font-mono text-xs tabular-nums text-muted">
                        {section.items.length}
                      </span>
                    </button>

                    {isOpen ? (
                      <div className="border-t border-border bg-bg-elevated p-4">
                        {section.description ? (
                          <p className="mb-3 text-xs text-subtle">{section.description}</p>
                        ) : null}
                        {opts.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            <Chip active={specialty === null} onClick={() => setSpecialty(null)}>
                              Toutes specialites
                            </Chip>
                            {opts.map((option) => (
                              <Chip
                                key={option.specialty}
                                active={specialty === option.specialty}
                                onClick={() => setSpecialty(option.specialty)}
                              >
                                <span aria-hidden>{specialtyEmoji(option.specialty)}</span>
                                {option.specialty}
                                <span className="font-mono tabular-nums opacity-70">{option.count}</span>
                              </Chip>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            {/* Recherche */}
            <label className="relative mt-3 flex">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle"
                aria-hidden
              />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Rechercher un item, une spécialité…"
                aria-label="Rechercher dans le programme officiel"
                className="h-11 w-full rounded-[var(--radius-md)] bg-card pl-9 pr-3 text-sm text-fg shadow-[var(--shadow-border)] outline-none transition-shadow placeholder:text-subtle focus-visible:ring-2 focus-visible:ring-accent/60"
              />
            </label>

            <div className="mt-6 flex items-baseline justify-between gap-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
                {normalized
                  ? `${visibleCount} item${visibleCount > 1 ? "s" : ""} sur ${total}`
                  : openSectionId
                    ? `${visibleCount} item${visibleCount > 1 ? "s" : ""} dans cette section`
                    : `${sections.length} sections · ${total} items`}
              </p>
              {filtered ? (
                <button
                  type="button"
                  onClick={reset}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-fg"
                >
                  <X className="size-3.5" aria-hidden />
                  Réinitialiser
                </button>
              ) : null}
            </div>

            {visibleSections.length === 0 ? (
              <div className="optimus-card mt-4 p-8 text-center">
                <p className="text-sm text-muted">
                  {openSectionId || normalized
                    ? "Aucun item ne correspond a ces criteres."
                    : "Selectionne une section ci-dessus pour explorer les items."}
                </p>
                {openSectionId || normalized ? (
                  <button
                    type="button"
                    onClick={reset}
                    className="mt-3 text-sm font-medium text-primary hover:underline"
                  >
                    Reinitialiser la recherche
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="mt-4 flex flex-col gap-8">
                {visibleSections.map(({ section, items }) => (
                  <section key={section.id}>
                    <div className="mb-3 flex items-baseline justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="font-display text-lg font-medium tracking-tight text-fg md:text-xl">
                          {section.label}
                        </h2>
                        {section.description ? (
                          <p className="mt-0.5 text-xs text-subtle">{section.description}</p>
                        ) : null}
                      </div>
                      <span className="shrink-0 font-mono text-xs tabular-nums text-muted">
                        {items.length}
                      </span>
                    </div>

                    <ul className="optimus-card divide-y divide-border overflow-hidden">
                      {items.map((item) => {
                        const libraryLabel = libraryBySlug.get(slugify(item.specialty));
                        return (
                          <li
                            key={programmeItemKey(section.id, item.id)}
                            className="flex items-start gap-3 px-4 py-3"
                          >
                            <span
                              className="w-7 shrink-0 pt-0.5 text-right font-mono text-xs tabular-nums text-subtle"
                              aria-hidden
                            >
                              {item.n}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm leading-snug text-fg">{item.title}</p>
                              <p className="mt-1 flex items-center gap-1.5 text-[11px] text-subtle">
                                <span aria-hidden>{specialtyEmoji(item.specialty)}</span>
                                <span className="truncate">{item.specialty}</span>
                              </p>
                            </div>
                            {itemFiches.has(item.id) ? (
                              <Link
                                to="/pathologie/$slug"
                                params={{ slug: item.id }}
                                data-fiche-link={item.id}
                                title={`Lire la fiche de nosographie « ${item.title} »`}
                                className="mt-0.5 inline-flex h-8 shrink-0 items-center gap-1 rounded-[var(--radius-sm)] bg-primary-soft px-2 text-[11px] font-medium text-primary transition-colors hover:bg-primary/15"
                              >
                                <BookOpen className="size-3.5" aria-hidden />
                                Fiche
                                <span className="sr-only"> — {item.title}</span>
                              </Link>
                            ) : null}
                            {libraryLabel ? (
                              <Link
                                to="/bibliotheque"
                                hash={specialtySlug(libraryLabel, "bib")}
                                title={`Ouvrir « ${libraryLabel} » dans la bibliothèque`}
                                className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-primary transition-colors hover:bg-primary-soft"
                              >
                                <ArrowUpRight className="size-4" aria-hidden />
                                <span className="sr-only">
                                  Ouvrir {libraryLabel} dans la bibliothèque
                                </span>
                              </Link>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))}
              </div>
            )}

            <p className="mt-8 text-xs leading-relaxed text-subtle">
              Référentiel extensible : d’autres programmes (France EDN, Sénégal…) pourront être
              ajoutés sans toucher aux decks — un même item pourra être partagé par plusieurs
              référentiels.
            </p>
          </>
        ) : null}
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

function Chip({
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
