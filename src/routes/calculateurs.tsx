import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, Check, ChevronLeft, ChevronRight, Sigma } from "lucide-react";
import { Page, PageHeader, Shell } from "@/components/shell";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  getCalculator,
  listCategoryGroups,
  type Calculator,
  type CalculatorField,
  type CalculatorResult,
  type CalculatorSeverity,
} from "@/content/calculators";

/**
 * Lien profond `?score=<id>` — utilisé par les pages « sujet » (`/sujet/sca`
 * → « À calculer » → GRACE). Sans lui, chaque score d'un sujet renvoyait à
 * l'accueil des calculateurs et il fallait re-chercher la catégorie puis le
 * score : trois gestes pour arriver là où le lien prétendait mener.
 */
export type CalculatorSearch = { score?: string };

export const Route = createFileRoute("/calculateurs")({
  component: CalcPage,
  validateSearch: (search: Record<string, unknown>): CalculatorSearch => ({
    score: typeof search.score === "string" ? search.score : undefined,
  }),
});

/** Couleur + libellé du badge de gravité. */
const SEVERITY_STYLE: Record<CalculatorSeverity, { label: string; className: string }> = {
  low: { label: "Faible", className: "bg-success/12 text-success" },
  medium: { label: "Modéré", className: "bg-warn/15 text-warn" },
  high: { label: "Élevé", className: "bg-danger/12 text-danger" },
  critical: { label: "Critique", className: "bg-danger text-white" },
};

function CalcPage() {
  const groups = useMemo(() => listCategoryGroups(), []);
  const { score } = Route.useSearch();

  // Sélection initiale dérivée du lien profond (aucun état à corriger après
  // coup : le premier rendu affiche déjà le bon score).
  const initial = score ? getCalculator(score) : undefined;
  const [category, setCategory] = useState<string>(
    () => initial?.categorie ?? groups[0]?.category ?? "general",
  );
  const [selectedId, setSelectedId] = useState<string | null>(initial?.id ?? null);

  // Depuis une page sujet, un score peut être visé sans démonter la route
  // (même chemin, autre query) : on resynchronise alors la sélection.
  useEffect(() => {
    if (!score) return;
    const target = getCalculator(score);
    if (!target) return;
    setCategory(target.categorie);
    setSelectedId(target.id);
  }, [score]);

  const activeGroup = groups.find((g) => g.category === category) ?? groups[0];
  const selected = activeGroup?.items.find((c) => c.id === selectedId) ?? null;

  function changeCategory(next: string) {
    setCategory(next);
    setSelectedId(null);
  }

  return (
    <Shell title="Calculateurs">
      <Page
        className="mx-auto max-w-5xl"
        header={
          <PageHeader
            kicker="Outils cliniques"
            title="Calculateurs"
            description="Scores et règles de décision utilisables hors ligne. Ils éclairent la décision — ils ne remplacent jamais le jugement clinique."
          />
        }
      >
        {/* Onglets par catégorie (jamais un onglet vide). */}
        <div
          className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 md:mx-0 md:flex-wrap md:px-0"
          role="tablist"
          aria-label="Choisir une catégorie de calculateurs"
        >
          {groups.map((group) => (
            <button
              key={group.category}
              type="button"
              role="tab"
              aria-selected={group.category === activeGroup?.category}
              onClick={() => changeCategory(group.category)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium whitespace-nowrap transition-colors",
                group.category === activeGroup?.category
                  ? "bg-primary text-primary-fg shadow-[var(--shadow-soft)]"
                  : "bg-card text-muted shadow-[var(--shadow-border)] hover:text-fg",
              )}
            >
              {group.label}
              <span
                className={cn(
                  "rounded-full px-1.5 text-[10px] tabular-nums",
                  group.category === activeGroup?.category
                    ? "bg-primary-fg/20 text-primary-fg"
                    : "bg-secondary text-subtle",
                )}
              >
                {group.items.length}
              </span>
            </button>
          ))}
        </div>

        <div
          role="tabpanel"
          aria-label={activeGroup ? `Calculateurs ${activeGroup.label}` : "Calculateurs"}
          className="mt-5 grid gap-5 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]"
        >
          {/* Liste des scores de la catégorie */}
          <div className={cn("space-y-2", selected && "hidden md:block")}>
            {activeGroup?.items.map((calc) => (
              <CalculatorRow
                key={calc.id}
                calc={calc}
                selected={calc.id === selectedId}
                onSelect={() => setSelectedId(calc.id)}
              />
            ))}
          </div>

          {/* Panneau détail */}
          <div className={cn(!selected && "hidden md:block")}>
            {selected ? (
              <CalculatorView
                key={selected.id}
                calc={selected}
                onBack={() => setSelectedId(null)}
              />
            ) : (
              <EmptyDetail />
            )}
          </div>
        </div>

        <Link
          to="/bibliotheque"
          className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-fg"
        >
          <BookOpen className="size-4" aria-hidden />
          Tous les outils dans la bibliothèque
        </Link>
      </Page>
    </Shell>
  );
}

/* ════════════════════════════ Liste & détail ════════════════════════════ */

function CalculatorRow({
  calc,
  selected,
  onSelect,
}: {
  calc: Calculator;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "optimus-card optimus-interactive-card flex w-full items-start gap-3 p-4 text-left active:scale-[0.99]",
        selected && "ring-1 ring-primary",
      )}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
        <Sigma className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium leading-snug">{calc.label}</span>
        <span className="mt-0.5 block line-clamp-2 text-xs leading-relaxed text-muted">
          {calc.description}
        </span>
      </span>
      <ChevronRight className="mt-1 size-4 shrink-0 text-subtle" aria-hidden />
    </button>
  );
}

function EmptyDetail() {
  return (
    <div className="hidden h-full min-h-64 items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-border p-8 text-center md:flex">
      <div className="max-w-xs">
        <p className="font-display text-lg font-medium">Choisissez un score</p>
        <p className="mt-1 text-sm text-muted">
          Sélectionnez un calculateur dans la liste pour saisir les paramètres et afficher le
          résultat, son interprétation et sa source.
        </p>
      </div>
    </div>
  );
}

/* ═════════════════════════ Vue générique d'un score ═════════════════════════ */

function CalculatorView({ calc, onBack }: { calc: Calculator; onBack: () => void }) {
  const initial = useMemo(() => buildInitialValues(calc.fields), [calc.fields]);
  const [values, setValues] = useState<Record<string, any>>(initial);

  const result = useMemo<CalculatorResult>(() => {
    try {
      return calc.compute(values);
    } catch {
      return { value: "—", interpretation: "Vérifiez les valeurs saisies." };
    }
  }, [calc, values]);

  const severity = result.severity ? SEVERITY_STYLE[result.severity] : null;
  const reference = result.reference ?? calc.reference;

  return (
    <div className="rounded-[var(--radius-lg)] bg-card p-5 shadow-[var(--shadow-border)]">
      <button
        type="button"
        onClick={onBack}
        className="mb-3 inline-flex items-center gap-1 text-xs text-muted hover:text-fg md:hidden"
      >
        <ChevronLeft className="size-3.5" aria-hidden /> Tous les scores
      </button>

      <h2 className="font-display text-xl font-medium tracking-tight">{calc.label}</h2>
      <p className="mt-1 text-sm leading-relaxed text-muted">{calc.description}</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {calc.fields.map((field) => (
          <FieldControl
            key={field.id}
            field={field}
            value={values[field.id]}
            onChange={(v) => setValues((prev) => ({ ...prev, [field.id]: v }))}
          />
        ))}
      </div>

      {/* Résultat calculé à la volée */}
      <div className="optimus-card mt-6 overflow-hidden" data-calculator-result={calc.id}>
        <div
          className={cn(
            "h-1",
            result.severity === "critical"
              ? "bg-danger"
              : result.severity === "high"
                ? "bg-gradient-to-r from-warn to-danger"
                : "bg-gradient-to-r from-primary to-success",
          )}
          aria-hidden
        />
        <div className="p-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">Résultat</p>
          <div className="mt-1 flex flex-wrap items-center gap-2.5">
            <p className="font-display text-4xl font-medium tabular-nums text-primary">
              {result.value}
            </p>
            {severity ? (
              <span
                className={cn("optimus-status-pill", severity.className)}
                data-calculator-severity={result.severity}
              >
                {severity.label}
              </span>
            ) : null}
          </div>
          {result.label ? <p className="mt-1.5 font-medium text-fg">{result.label}</p> : null}
          {result.interpretation ? (
            <p className="mt-1 text-sm leading-relaxed text-muted">{result.interpretation}</p>
          ) : null}
        </div>
      </div>

      {calc.itemsProgramme && calc.itemsProgramme.length > 0 ? (
        <div className="mt-5">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted">
            Items du programme
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {calc.itemsProgramme.map((item) => (
              <span key={item} className="optimus-type-badge bg-secondary text-muted">
                {item}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {reference ? (
        <p className="mt-5 border-t border-border pt-3 text-[11px] leading-relaxed text-subtle">
          Source : {reference}
        </p>
      ) : null}
    </div>
  );
}

/** Valeurs initiales d'un formulaire à partir des `default` des champs. */
function buildInitialValues(fields: CalculatorField[]): Record<string, any> {
  const values: Record<string, any> = {};
  for (const field of fields) {
    if (field.default !== undefined) values[field.id] = field.default;
    else if (field.type === "boolean") values[field.id] = false;
    else if (field.type === "select") values[field.id] = field.options?.[0]?.value ?? "";
    else values[field.id] = field.min ?? 0;
  }
  return values;
}

function FieldControl({
  field,
  value,
  onChange,
}: {
  field: CalculatorField;
  value: any;
  onChange: (v: any) => void;
}) {
  if (field.type === "boolean") {
    return (
      <div className="sm:col-span-2">
        <CheckRow
          label={field.label}
          checked={value === true}
          onChange={onChange}
          help={field.help}
        />
      </div>
    );
  }

  return (
    <label className="block" htmlFor={`calc-${field.id}`}>
      <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
        {field.label}
        {field.unit ? (
          <span className="ml-1 normal-case tracking-normal text-subtle">{`(${field.unit})`}</span>
        ) : null}
      </span>
      <div className="mt-1.5">
        {field.type === "select" ? (
          <select
            id={`calc-${field.id}`}
            value={value == null ? "" : String(value)}
            onChange={(e) => onChange(e.target.value)}
            className="flex h-11 w-full rounded-[var(--radius-md)] bg-secondary px-3 text-sm text-fg shadow-[var(--shadow-border)] outline-none transition-[box-shadow] duration-150 focus-visible:ring-2 focus-visible:ring-ring/60"
          >
            {field.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : (
          <Input
            id={`calc-${field.id}`}
            type="number"
            inputMode="decimal"
            min={field.min}
            max={field.max}
            step={field.step ?? 1}
            value={value == null ? "" : value}
            onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
          />
        )}
      </div>
      {field.help ? <span className="mt-1 block text-xs text-subtle">{field.help}</span> : null}
    </label>
  );
}

function CheckRow({
  label,
  checked,
  onChange,
  help,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  help?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex min-h-11 w-full items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-left text-sm shadow-[var(--shadow-border)] transition-colors",
        checked ? "bg-primary-soft text-fg" : "bg-card text-muted hover:text-fg",
      )}
    >
      <span
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-[6px] border transition-colors",
          checked ? "border-primary bg-primary text-primary-fg" : "border-border-strong",
        )}
        aria-hidden
      >
        {checked ? <Check className="size-3.5" /> : null}
      </span>
      <span className="min-w-0 flex-1">
        {label}
        {help ? <span className="ml-1 text-xs text-subtle">{help}</span> : null}
      </span>
    </button>
  );
}
