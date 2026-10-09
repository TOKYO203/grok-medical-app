import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown, Lock, LockOpen, Check, Play } from "lucide-react";
import {
  LEVEL_ORDER,
  LEVEL_SHORT,
  type Level,
  type CurriculumSpecialty,
  type CurriculumBranch,
} from "@/core/curriculum";
import type { Deck, DeckProgress } from "@/core/types";
import { deckProgressPct } from "@/core/mastery";
import { cn } from "@/lib/utils";

type Props = {
  specialty: CurriculumSpecialty;
  decks: Deck[];
  progress: Record<string, DeckProgress>;
  userLevel: Level;
  hasAccess: (deck: Deck) => boolean;
  allowExplore?: boolean;
};

type DeckEntry = {
  deck: Deck;
  level: Level;
  pct: number;
  locked: boolean;
};

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
      {/* Header spécialité — compact */}
      <div className="mb-4 flex items-center gap-3 rounded-[var(--radius-lg)] bg-card px-4 py-3 shadow-[var(--shadow-border)]">
        <span className="text-2xl" aria-hidden>
          {specialty.icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-display text-lg font-medium tracking-tight">
              {specialty.label}
            </h2>
            <span className="shrink-0 font-mono text-[11px] tabular-nums text-subtle">
              {totals.total > 0 ? `${totals.done}/${totals.total}` : "Bientôt"}
            </span>
          </div>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full bg-primary transition-all duration-500"
              style={{ width: `${totals.pct}%` }}
            />
          </div>
        </div>
        <button
          type="button"
          onClick={() => setExplore((v) => !v)}
          aria-label={explore ? "Masquer les contenus avancés" : "Explorer tous les contenus"}
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-full transition-colors",
            explore ? "bg-primary-soft text-primary" : "bg-secondary text-muted hover:text-fg",
          )}
        >
          {explore ? <LockOpen className="size-3.5" /> : <Lock className="size-3.5" />}
        </button>
      </div>

      {/* Branches — liste ultra-compacte */}
      {totals.total === 0 ? (
        <p className="rounded-[var(--radius-md)] bg-card px-4 py-6 text-center text-sm text-muted shadow-[var(--shadow-border)]">
          Contenus en préparation pour cette spécialité.
        </p>
      ) : (
        <div className="space-y-2">
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
      )}
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

  const entries = useMemo(() => {
    return branch.decks
      .map((id): DeckEntry | null => {
        const deck = deckMap.get(id);
        if (!deck) return null;
        const level = extractLevel(id) ?? branch.levels[branch.levels.length - 1];
        const pct = deckProgressPct(deck, progress[deck.id]);
        const locked = !hasAccess(deck) && !explore;
        return { deck, level, pct, locked };
      })
      .filter((x): x is DeckEntry => x !== null);
  }, [branch, deckMap, progress, hasAccess, explore]);

  // Branches « squelette » : structure prévue mais vide, non rendue.
  if (branch.skeleton) return null;
  if (entries.length === 0) return null;

  const doneCount = entries.filter((d) => d.pct >= 100 && !d.locked).length;

  return (
    <section className="rounded-[var(--radius-md)] bg-card shadow-[var(--shadow-border)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left"
      >
        <span className="text-base" aria-hidden>
          {branch.icon}
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
          {branch.label}
        </span>
        <span className="shrink-0 font-mono text-[10px] tabular-nums text-subtle">
          {doneCount}/{entries.length}
        </span>
        <ChevronDown
          className={cn(
            "size-3.5 shrink-0 text-muted transition-transform",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {open ? (
        <div className="flex flex-wrap gap-1.5 px-3 pb-3">
          {entries.map((entry) => (
            <LevelPill
              key={entry.deck.id}
              entry={entry}
              userLevel={userLevel}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function LevelPill({
  entry,
  userLevel,
}: {
  entry: DeckEntry;
  userLevel: Level;
}) {
  const { deck, level, pct, locked } = entry;
  const done = pct >= 100 && !locked;
  const started = pct > 0 && pct < 100 && !locked;

  const userIdx = LEVEL_ORDER.indexOf(userLevel);
  const levelIdx = LEVEL_ORDER.indexOf(level);
  const isAbove = levelIdx > userIdx;

  const label = LEVEL_SHORT[level] ?? level;

  return (
    <Link
      to="/learn/$deckId"
      params={{ deckId: deck.id }}
      className={cn(
        "group flex min-w-[64px] items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-all",
        "hover:scale-[1.03] active:scale-[0.97]",
        locked && "border-zinc-700/40 bg-zinc-800/40 text-zinc-500",
        done && "border-[#A67C1E] bg-[#A67C1E]/15 text-[#E8C97A]",
        started && "border-[#4A7A47] bg-[#4A7A47]/15 text-emerald-400",
        !locked && !done && !started && "border-[#A67C1E]/30 bg-secondary text-fg",
      )}
      title={`${deck.title} · ${level}`}
    >
      {locked ? (
        <Lock className="size-3 shrink-0" aria-hidden />
      ) : done ? (
        <Check className="size-3 shrink-0" aria-hidden />
      ) : started ? (
        <Play className="size-3 shrink-0 fill-current" aria-hidden />
      ) : null}
      <span className="font-mono font-medium">{label}</span>
      {isAbove && !locked ? (
        <span className="text-[9px] opacity-70">↑</span>
      ) : null}
    </Link>
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
