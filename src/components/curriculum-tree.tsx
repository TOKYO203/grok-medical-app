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
import { deriveStepLabel, extractDeckLevel } from "@/lib/library/deck-series";
import { cn } from "@/lib/utils";
import { detectPreferredCurrency, formatPrice, PRICES_MGA } from "@/content/pricing";

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
  /** Nom de l'étape dans l'escalier (« Sémiologie », « Prise en charge »…). */
  stepLabel: string | null;
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
        const level = extractDeckLevel(id) ?? branch.levels[branch.levels.length - 1];
        const pct = deckProgressPct(deck, progress[deck.id]);
        const locked = !hasAccess(deck) && !explore;
        return {
          deck,
          level,
          /*
           * Le nom d'étape n'a de sens que dans un escalier : sur une branche à
           * un seul deck (« Anatomie », « Pharmacologie »), il n'y a pas de
           * marche suivante — afficher « Synthèse » inventerait une progression.
           */
          stepLabel: branch.decks.length >= 2 ? deriveStepLabel(id, deck.title) : null,
          pct,
          locked,
        };
      })
      .filter((x): x is DeckEntry => x !== null);
  }, [branch, deckMap, progress, hasAccess, explore]);

  // Branches « squelette » : structure prévue mais vide, non rendue.
  if (branch.skeleton) return null;
  if (entries.length === 0) return null;

  const doneCount = entries.filter((d) => d.pct >= 100 && !d.locked).length;
  const lockedCount = entries.filter((d) => d.locked).length;
  /*
   * Le prix est affiché UNE fois par pathologie (en-tête de branche) et non plus
   * sur chaque marche : cinq marches verrouillées affichaient cinq fois le même
   * montant, à la place du niveau — l'escalier devenait illisible.
   */
  const lockedPrice =
    lockedCount > 0 ? formatPrice(PRICES_MGA.deck, detectPreferredCurrency()) : null;

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
        {lockedPrice ? (
          <span
            className="shrink-0 font-mono text-[10px] tabular-nums text-subtle"
            title="Prix de déblocage d'un deck"
          >
            {lockedPrice}
          </span>
        ) : null}
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
  const { deck, level, stepLabel, pct, locked } = entry;
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
      title={`${deck.title} · ${level}${locked ? " — verrouillé" : ""}`}
    >
      {locked ? (
        <Lock className="size-3 shrink-0" aria-hidden />
      ) : done ? (
        <Check className="size-3 shrink-0" aria-hidden />
      ) : started ? (
        <Play className="size-3 shrink-0 fill-current" aria-hidden />
      ) : null}
      <span className="font-mono font-medium">{label}</span>
      {/* Le niveau seul ne dit pas ce qu'on apprend : l'étape le dit. */}
      {stepLabel ? (
        <>
          <span className="text-[9px] opacity-50" aria-hidden>
            ·
          </span>
          <span className="max-w-28 truncate text-[10px] font-medium">{stepLabel}</span>
        </>
      ) : null}
      {isAbove && !locked ? (
        <span className="text-[9px] opacity-70" aria-hidden>
          ↑
        </span>
      ) : null}
    </Link>
  );
}
