import { Link } from "@tanstack/react-router";
import { Check, Clock3, Layers3, Lock, Play, Sparkles } from "lucide-react";
import { LEVEL_LABEL, LEVEL_SHORT } from "@/core/curriculum";
import type { DeckSeries, DeckSeriesStep } from "@/lib/library/deck-series";
import type { ContentItem } from "@/lib/library/content-index";
import { cn } from "@/lib/utils";

export type DeckSeriesStepView = {
  step: DeckSeriesStep;
  item: ContentItem;
};

export type DeckSeriesCardProps = {
  series: DeckSeries;
  /** Étapes réellement affichées (les filtres de la page peuvent en masquer). */
  steps: DeckSeriesStepView[];
  /** Nombre d'étapes de la série absentes de la liste filtrée. */
  hiddenCount?: number;
  /** Progression par item (`deck:<id>` → pourcentage). */
  progressById: ReadonlyMap<string, number>;
  isNew?: (item: ContentItem) => boolean;
  className?: string;
};

/**
 * Escalier d'une pathologie : **une** carte pour les 5 decks qui la composent.
 *
 * Pourquoi ce composant existe : les decks d'une même pathologie sont cinq
 * strates de profondeur du même sujet (`cardio-sca-l2` → `cardio-sca-int`).
 * Affichés en cinq cartes, ils noient le sujet dans son propre sommaire.
 * Affichés en un escalier, on lit d'un coup d'œil : *le sujet, où j'en suis,
 * et la marche suivante*.
 *
 * Contrat d'affichage :
 *  - la carte n'est **pas** un lien (elle contient N liens d'étapes) ;
 *  - chaque marche porte son état (validée / en cours / à faire / verrouillée)
 *    et son niveau — jamais un prix à la place du niveau ;
 *  - une seule action principale : la marche courante.
 */
export function DeckSeriesCard({
  series,
  steps,
  hiddenCount = 0,
  progressById,
  isNew,
  className,
}: DeckSeriesCardProps) {
  if (steps.length === 0) return null;

  /*
   * L'ordre des marches vient du CURRICULUM, pas de l'ordre du store : la liste
   * d'items peut arriver triée par pertinence (ou par année du profil), ce qui
   * affichait « L5 puis L2 puis L3 » — un escalier qui descend.
   */
  const orderedSteps = [...steps].sort((a, b) => a.step.index - b.step.index);

  const totalSteps = series.steps.length;
  const doneCount = orderedSteps.filter(
    ({ item }) => !item.locked && (progressById.get(item.id) ?? 0) >= 100,
  ).length;
  const hasLocked = orderedSteps.some(({ item }) => item.locked);
  const percent = Math.round((doneCount / orderedSteps.length) * 100);

  /*
   * Marche courante : celle commencée mais non terminée, sinon la première
   * accessible non validée, sinon la première tout court (tout est fait).
   */
  const current =
    orderedSteps.find(({ item }) => {
      const pct = progressById.get(item.id) ?? 0;
      return !item.locked && pct > 0 && pct < 100;
    }) ??
    orderedSteps.find(({ item }) => !item.locked && (progressById.get(item.id) ?? 0) < 100) ??
    orderedSteps[0];

  const currentPct = progressById.get(current.item.id) ?? 0;
  const currentDone = !current.item.locked && currentPct >= 100;
  const questionCount = orderedSteps.reduce(
    (sum, { item }) => sum + Number(item.metric.replace(/\D/g, "") || 0),
    0,
  );
  const levels = orderedSteps.flatMap(({ step }) => (step.level ? [step.level] : []));
  const levelRange =
    levels.length > 1
      ? `${LEVEL_SHORT[levels[0]] ?? ""} → ${LEVEL_SHORT[levels[levels.length - 1]] ?? ""}`
      : "";

  return (
    <article
      className={cn(
        "optimus-card optimus-interactive-card--premium group flex h-full flex-col p-4",
        className,
      )}
      data-deck-series={series.id}
    >
      <div className="flex items-start gap-3">
        <span className="optimus-card-icon optimus-card-icon--gold flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-lg shadow-[var(--shadow-border)]">
          <span aria-hidden>{series.icon}</span>
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="optimus-type-badge bg-primary-soft text-primary">
              <Layers3 className="size-3" aria-hidden />
              Parcours
            </span>
            <span className="optimus-type-badge bg-secondary text-muted">
              {orderedSteps.length}/{totalSteps} étapes
            </span>
            {hasLocked ? (
              <span className="optimus-type-badge bg-secondary text-muted">
                <Lock className="size-3" aria-hidden />
                Débloquer
              </span>
            ) : null}
            {isNew?.(current.item) && !current.item.locked ? (
              <span className="optimus-type-badge bg-warn/15 text-warn">
                <Sparkles className="size-3" aria-hidden />
                Nouveau
              </span>
            ) : null}
          </div>

          <h3 className="mt-2 font-display text-lg font-medium leading-snug tracking-tight text-fg">
            {series.label}
          </h3>
          <p className="mt-0.5 line-clamp-2 text-sm leading-relaxed text-muted">
            {series.description}
          </p>
        </div>
      </div>

      {/* L'escalier : une marche = un deck, dans l'ordre de progression. */}
      <ol
        className="mt-4 grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${orderedSteps.length}, minmax(0, 1fr))` }}
      >
        {orderedSteps.map(({ step, item }) => {
          const pct = progressById.get(item.id) ?? 0;
          const done = !item.locked && pct >= 100;
          const started = !item.locked && pct > 0 && pct < 100;
          const isCurrent = step.deckId === current.step.deckId;
          const levelLabel = step.level ? LEVEL_SHORT[step.level] : "";

          return (
            <li key={step.deckId} className="min-w-0">
              <Link
                to="/parcours/$deckId"
                params={{ deckId: step.deckId }}
                data-deck-series-step={step.deckId}
                data-state={item.locked ? "locked" : done ? "done" : started ? "started" : "todo"}
                aria-label={`Étape ${step.index + 1} sur ${totalSteps} — ${step.label}${
                  step.level ? ` (${LEVEL_LABEL[step.level]})` : ""
                } : ${item.title}${item.locked ? " — verrouillé" : ""}`}
                title={`${item.title}${step.level ? ` · ${LEVEL_LABEL[step.level]}` : ""}`}
                className={cn(
                  "flex h-full min-h-12 flex-col items-center justify-center gap-0.5 rounded-[var(--radius-sm)] border px-1 py-1.5 text-center transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:outline-none",
                  item.locked && "border-transparent bg-secondary text-subtle",
                  done && "border-primary/40 bg-primary-soft text-primary",
                  started && "border-accent/45 bg-accent/12 text-accent",
                  !item.locked &&
                    !done &&
                    !started &&
                    "border-border bg-card text-fg hover:border-primary/40",
                  isCurrent && !item.locked && "ring-1 ring-primary/50",
                )}
              >
                <span className="flex items-center gap-1">
                  {item.locked ? (
                    <Lock className="size-3" aria-hidden />
                  ) : done ? (
                    <Check className="size-3" aria-hidden />
                  ) : started ? (
                    <Play className="size-3 fill-current" aria-hidden />
                  ) : null}
                  <span className="font-mono text-[10px] font-semibold tabular-nums">
                    {levelLabel}
                  </span>
                </span>
                {/*
                 * Le libellé passe sur deux lignes plutôt que d'être tronqué :
                 * en 390 px une marche fait 59 px, et « Cas cliniques » ou
                 * « Prise en charge » y perdaient leur fin — or c'est
                 * précisément ce qui distingue deux marches voisines.
                 */}
                <span className="w-full text-[9px] leading-[1.15] opacity-80 line-clamp-2">
                  {step.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>

      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-2 pt-3 text-xs text-muted">
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <span className="h-1.5 min-w-8 flex-1 overflow-hidden rounded-full bg-secondary">
            <span
              className="block h-full bg-primary transition-[width] duration-500"
              style={{ width: `${percent}%` }}
            />
          </span>
          <span className="font-mono text-[11px] tabular-nums">
            {doneCount}/{orderedSteps.length}
          </span>
        </span>

        <span className="flex shrink-0 items-center gap-1">
          <Clock3 className="size-3.5" aria-hidden />
          {questionCount > 0 ? `${questionCount} questions` : `${orderedSteps.length} étapes`}
        </span>
        {levelRange ? (
          <span className="shrink-0 font-mono text-[11px] tabular-nums text-subtle">
            {levelRange}
          </span>
        ) : null}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
        <p className="min-w-0 truncate text-xs text-muted">
          Étape {current.step.index + 1}/{totalSteps} ·{" "}
          <span className="font-medium text-fg">{current.step.label}</span>
        </p>
        <Link
          to="/parcours/$deckId"
          params={{ deckId: current.step.deckId }}
          data-deck-series-cta={current.step.deckId}
          className="shrink-0 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-fg transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:outline-none"
        >
          {current.item.locked
            ? "Débloquer"
            : currentDone
              ? "Revoir"
              : currentPct > 0
                ? "Continuer"
                : "Commencer"}
        </Link>
      </div>

      {hiddenCount > 0 ? (
        <p className="mt-2 text-[11px] text-subtle">
          +{hiddenCount} étape{hiddenCount > 1 ? "s" : ""} masquée
          {hiddenCount > 1 ? "s" : ""} par les filtres
        </p>
      ) : null}
    </article>
  );
}
