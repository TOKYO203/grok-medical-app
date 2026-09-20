import { useMemo, useState } from "react";
import { ChevronDown, Lock, LockOpen } from "lucide-react";
import {
  BRANCH_ICON,
  LEVEL_ORDER,
  LEVEL_SHORT,
  type Level,
  type CurriculumSpecialty,
  type CurriculumBranch,
} from "@/core/curriculum";
import type { Deck, DeckProgress } from "@/core/types";
import { deckProgressPct } from "@/core/mastery";
import { DeckRow, type DeckState } from "@/components/deck-row";
import { cn } from "@/lib/utils";

type Props = {
  specialty: CurriculumSpecialty;
  decks: Deck[];
  progress: Record<string, DeckProgress>;
  userLevel: Level;
  hasAccess: (deck: Deck) => boolean;
  allowExplore?: boolean;
};

function deckState(pct: number, locked: boolean): DeckState {
  if (locked) return "locked";
  if (pct >= 100) return "done";
  if (pct > 0) return "in-progress";
  return "todo";
}

export function CurriculumTree({
  specialty,
  decks,
  progress,
  userLevel,
  hasAccess,
  allowExplore = false,
}: Props) {
  const [explore, setExplore] = useState(allowExplore);

  const deckMap = useMemo(() => {
    const m = new Map<string, Deck>();
    for (const d of decks) m.set(d.id, d);
    return m;
  }, [decks]);

  // Calcule la progression globale
  const totals = useMemo(() => {
    let total = 0;
    let done = 0;
    for (const branch of specialty.branches) {
      for (const deckId of branch.decks) {
        const deck = deckMap.get(deckId);
        if (!deck) continue;
        total += 1;
        if (deckProgressPct(deck, progress[deck.id]) >= 100) done += 1;
      }
    }
    return { total, done, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
  }, [specialty, deckMap, progress]);

  return (
    <div>
      {/* Header spécialité */}
      <div className="mb-4 flex items-start gap-3 rounded-[var(--radius-lg)] bg-card p-4 shadow-[var(--shadow-border)]">
        <span className="text-3xl" aria-hidden>
          {specialty.icon}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-medium tracking-tight">
            {specialty.label}
          </h2>
          <p className="mt-0.5 text-xs text-muted">{specialty.description}</p>
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${totals.pct}%` }}
              />
            </div>
            <span className="shrink-0 text-[11px] text-subtle">
              {totals.done}/{totals.total} · {totals.pct}%
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setExplore((v) => !v)}
          aria-label={explore ? "Masquer les contenus avancés" : "Explorer tous les contenus"}
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full transition-colors",
            explore ? "bg-primary-soft text-primary" : "bg-secondary text-muted hover:text-fg",
          )}
        >
          {explore ? <LockOpen className="size-4" /> : <Lock className="size-4" />}
        </button>
      </div>

      {/* Branches */}
      <div className="space-y-4">
        {specialty.branches.map((branch) => (
          <BranchSection
            key={branch.id}
            branch={branch}
            deckMap={deckMap}
            progress={progress}
            userLevel={userLevel}
            hasAccess={hasAccess}
            explore={explore}
          />
        ))}
      </div>
    </div>
  );
}

function BranchSection({
  branch,
  deckMap,
  progress,
  userLevel,
  hasAccess,
  explore,
}: {
  branch: CurriculumBranch;
  deckMap: Map<string, Deck>;
  progress: Props["progress"];
  userLevel: Level;
  hasAccess: (deck: Deck) => boolean;
  explore: boolean;
}) {
  const [open, setOpen] = useState(true);
  const levelsLabel = branch.levels.map((l) => LEVEL_SHORT[l]).join("·");

  const visibleDecks = branch.decks
    .map((id) => {
      const deck = deckMap.get(id);
      if (!deck) return null;
      const level = extractLevel(id) ?? branch.levels[branch.levels.length - 1];
      const pct = deckProgressPct(deck, progress[deck.id]);
      const locked = !hasAccess(deck) && !explore;
      return { deck, level, pct, locked };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  if (visibleDecks.length === 0) return null;

  const doneCount = visibleDecks.filter((d) => d.pct >= 100 && !d.locked).length;

  return (
    <section className="overflow-hidden rounded-[var(--radius-lg)] bg-bg/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-3 py-2 text-left"
      >
        <span className="text-base" aria-hidden>
          {BRANCH_ICON[branch.id]}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h3 className="text-sm font-medium uppercase tracking-wider">
              {branch.label}
            </h3>
            <span className="text-[10px] text-subtle">{levelsLabel}</span>
          </div>
          <p className="text-[11px] text-muted">{branch.description}</p>
        </div>
        <span className="shrink-0 text-[11px] text-subtle">
          {doneCount}/{visibleDecks.length}
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted transition-transform",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {open ? (
        <div className="space-y-1.5 px-2 pb-3">
          {visibleDecks.map(({ deck, level, pct, locked }) => (
            <DeckRow
              key={deck.id}
              deck={deck}
              level={level}
              state={deckState(pct, locked)}
              progressPct={pct}
              userLevel={userLevel}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function extractLevel(deckId: string): Level | null {
  const match = deckId.match(/-(l\d|intern|resident|senior)(?:$|-)/i);
  if (!match) return null;
  const raw = match[1].toUpperCase();
  if (raw === "INTERN") return "INTERNE";
  if (raw === "RESIDENT") return "RESIDENT";
  if (raw === "SENIOR") return "SENIOR";
  return LEVEL_ORDER.includes(raw as Level) ? (raw as Level) : null;
}
