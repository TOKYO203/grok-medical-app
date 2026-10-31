import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronDown, FlaskConical, Search } from "lucide-react";
import { Page, PageHeader, Shell } from "@/components/shell";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  filterValues,
  listCategories,
  loadAllValues,
  type ReferenceValue,
} from "@/content/valeurs-reference";

export const Route = createFileRoute("/valeurs-reference")({
  component: ValeursReferencePage,
});

function formatRange(min: number | null, max: number | null, unit: string): string {
  if (min !== null && max !== null) return `${min} – ${max} ${unit}`;
  if (min !== null) return `≥ ${min} ${unit}`;
  if (max !== null) return `≤ ${max} ${unit}`;
  return unit;
}

function ValeursReferencePage() {
  const categories = useMemo(() => listCategories(), []);
  const allValues = useMemo(() => loadAllValues(), []);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let values = filterValues(allValues, query);
    if (activeCategory) {
      values = values.filter((v) => v.category === activeCategory);
    }
    return values.sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }, [query, activeCategory, allValues]);

  return (
    <Shell title="Valeurs de référence">
      <Page>
        <PageHeader
          kicker="Outils cliniques"
          title="Valeurs de référence"
          description="Valeurs biologiques usuelles avec plages par population et interprétation clinique. Vérifier toujours les valeurs de votre laboratoire."
        />

        <div className="mt-6 space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <Input
              type="search"
              placeholder="Rechercher (Hb, glycémie, potassium…)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveCategory(null)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                activeCategory === null
                  ? "bg-primary text-primary-fg"
                  : "bg-secondary text-muted hover:bg-card",
              )}
            >
              Tous ({allValues.length})
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveCategory(c.id === activeCategory ? null : c.id)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                  activeCategory === c.id
                    ? "bg-primary text-primary-fg"
                    : "bg-secondary text-muted hover:bg-card",
                )}
              >
                {c.label} ({c.count})
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="mt-8 text-center text-sm text-muted">
            Aucune valeur ne correspond à ta recherche.
          </p>
        ) : (
          <ul className="mt-6 space-y-2">
            {filtered.map((value) => (
              <ValueCard
                key={value.id}
                value={value}
                expanded={expandedId === value.id}
                onToggle={() => setExpandedId(expandedId === value.id ? null : value.id)}
              />
            ))}
          </ul>
        )}
      </Page>
    </Shell>
  );
}

function ValueCard({
  value,
  expanded,
  onToggle,
}: {
  value: ReferenceValue;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <li className="overflow-hidden rounded-[var(--radius-xl)] bg-card shadow-[var(--shadow-border)]">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-secondary"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
          <FlaskConical className="size-5" strokeWidth={1.7} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h3 className="font-medium">{value.name}</h3>
            {value.abbreviation ? (
              <span className="text-xs text-muted">({value.abbreviation})</span>
            ) : null}
          </div>
          {value.subcategory ? (
            <p className="mt-0.5 text-xs text-muted">{value.subcategory}</p>
          ) : null}
        </div>
        <ChevronDown
          className={cn("size-4 shrink-0 text-muted transition-transform", expanded && "rotate-180")}
          aria-hidden
        />
      </button>

      {expanded ? (
        <div className="border-t border-border p-4">
          <h4 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
            Valeurs normales
          </h4>
          <ul className="mt-2 space-y-1.5">
            {value.ranges.map((range, i) => (
              <li key={i} className="flex flex-wrap items-baseline gap-2 text-sm">
                <span className="font-medium">{range.label}</span>
                <span className="text-primary">{formatRange(range.min, range.max, range.unit)}</span>
                {range.note ? (
                  <span className="text-xs text-muted">— {range.note}</span>
                ) : null}
              </li>
            ))}
          </ul>

          {value.interpretationLow || value.interpretationHigh ? (
            <>
              <h4 className="mt-4 text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
                Interprétation
              </h4>
              <div className="mt-2 space-y-2 text-sm">
                {value.interpretationLow ? (
                  <div className="rounded-[var(--radius-md)] bg-info/10 p-2">
                    <span className="font-medium text-info">↓ Bas : </span>
                    <span className="text-foreground">{value.interpretationLow}</span>
                  </div>
                ) : null}
                {value.interpretationHigh ? (
                  <div className="rounded-[var(--radius-md)] bg-warn/10 p-2">
                    <span className="font-medium text-warn">↑ Haut : </span>
                    <span className="text-foreground">{value.interpretationHigh}</span>
                  </div>
                ) : null}
              </div>
            </>
          ) : null}

          <h4 className="mt-4 text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
            Sources
          </h4>
          <ul className="mt-1 text-xs text-muted">
            {value.sources.map((s, i) => (
              <li key={i}>· {s.label}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </li>
  );
}
