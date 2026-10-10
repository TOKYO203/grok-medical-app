import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, Search, X } from "lucide-react";
import { Page, PageHeader, Shell } from "@/components/shell";
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
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/programme")({ component: ProgrammePage });

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
  const [sectionId, setSectionId] = useState<string | null>(null);
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

  const normalized = query.trim().toLowerCase();

  const matchesQuery = useMemo(
    () => (item: ProgrammeItem) =>
      !normalized || `${item.title} ${item.specialty}`.toLowerCase().includes(normalized),
    [normalized],
  );

  /** Spécialités proposées au filtre : celles du périmètre courant (section + recherche). */
  const specialtyOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const section of sections) {
      if (sectionId && section.id !== sectionId) continue;
      for (const item of section.items) {
        if (!matchesQuery(item)) continue;
        counts.set(item.specialty, (counts.get(item.specialty) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .map(([label, count]) => ({ specialty: label, count }))
      .sort((a, b) => b.count - a.count || a.specialty.localeCompare(b.specialty, "fr"));
  }, [sections, sectionId, matchesQuery]);

  /** Sections visibles avec leurs items filtrés (les sections vides disparaissent). */
  const visibleSections = useMemo(() => {
    return sections
      .filter((section) => !sectionId || section.id === sectionId)
      .map((section) => ({
        section,
        items: section.items.filter(
          (item) => (!specialty || item.specialty === specialty) && matchesQuery(item),
        ),
      }))
      .filter((entry) => entry.items.length > 0);
  }, [sections, sectionId, specialty, matchesQuery]);

  const visibleCount = visibleSections.reduce((sum, entry) => sum + entry.items.length, 0);

  const coverage = useMemo(() => {
    const items = sections.flatMap((section) => section.items);
    const covered = items.filter((item) => libraryBySlug.has(slugify(item.specialty))).length;
    return { covered, total: items.length };
  }, [sections, libraryBySlug]);

  const total = programme ? programmeItemCount(programme) : 0;
  const filtered = Boolean(sectionId || specialty || normalized);

  function reset() {
    setSectionId(null);
    setSpecialty(null);
    setQuery("");
  }

  return (
    <Shell title="Programme national">
      <Page>
        <PageHeader
          kicker={programme ? `${programme.flag} ${programme.pays} · ${programme.annee}` : "Référentiel"}
          title="Programme national"
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
              <Stat label="Items" value={total} />              <Stat label="Spécialités" value={specialtyOptions.length} />
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

            {/* Sections du référentiel */}
            <div className="mt-5 -mx-5 flex gap-2 overflow-x-auto px-5 pb-1 md:mx-0 md:flex-wrap md:px-0">
              <Chip
                active={sectionId === null}
                onClick={() => {
                  setSectionId(null);
                  setSpecialty(null);
                }}
              >
                Toutes les sections
                <span className="font-mono tabular-nums opacity-70">{total}</span>
              </Chip>
              {sections.map((section) => (
                <Chip
                  key={section.id}
                  active={sectionId === section.id}
                  onClick={() => {
                    setSectionId(section.id);
                    setSpecialty(null);
                  }}
                >
                  {section.label}
                  <span className="font-mono tabular-nums opacity-70">{section.items.length}</span>
                </Chip>
              ))}
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

            {specialtyOptions.length > 0 ? (
              <div className="mt-3 -mx-5 flex gap-2 overflow-x-auto px-5 pb-1 md:mx-0 md:flex-wrap md:px-0">
                <Chip active={specialty === null} onClick={() => setSpecialty(null)}>
                  Toutes spécialités
                </Chip>
                {specialtyOptions.map((option) => (
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

            <div className="mt-6 flex items-baseline justify-between gap-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
                {filtered ? `${visibleCount} item${visibleCount > 1 ? "s" : ""} sur ${total}` : "Référentiel complet"}
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
                <p className="text-sm text-muted">Aucun item ne correspond à ces critères.</p>
                <button
                  type="button"
                  onClick={reset}
                  className="mt-3 text-sm font-medium text-primary hover:underline"
                >
                  Réinitialiser la recherche
                </button>
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
