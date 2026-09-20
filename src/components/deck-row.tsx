import { Link } from "@tanstack/react-router";
import { CheckCircle2, Lock, Play } from "lucide-react";
import { LEVEL_SHORT, type Level, levelGapLabel } from "@/core/curriculum";
import type { Deck } from "@/core/types";
import { cn } from "@/lib/utils";

export type DeckState = "done" | "in-progress" | "todo" | "locked";

type Props = {
  deck: Deck;
  level: Level;
  state: DeckState;
  progressPct: number;
  userLevel: Level;
};

const STATE_ICON: Record<DeckState, string> = {
  done: "✅",
  "in-progress": "🔄",
  todo: "⏳",
  locked: "🔒",
};

export function DeckRow({ deck, level, state, progressPct, userLevel }: Props) {
  const gap = levelGapLabel(userLevel, level);
  const isClickable = state !== "locked";

  const inner = (
    <div
      className={cn(
        "group flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 transition-colors",
        isClickable
          ? "bg-card shadow-[var(--shadow-border)] hover:bg-secondary"
          : "bg-card/40 shadow-[var(--shadow-border)]",
      )}
    >
      <span className="text-base" aria-hidden>
        {STATE_ICON[state]}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p
            className={cn(
              "truncate text-sm font-medium",
              state === "locked" && "text-muted",
            )}
          >
            {deck.title}
          </p>
          <span className="shrink-0 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted">
            {LEVEL_SHORT[level]}
          </span>
          {gap && state !== "locked" ? (
            <span className="shrink-0 text-[10px] text-amber-400">{gap}</span>
          ) : null}
        </div>
        {state === "in-progress" ? (
          <div className="mt-1 flex items-center gap-2">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="shrink-0 text-[10px] text-subtle">{progressPct}%</span>
          </div>
        ) : state === "locked" ? (
          <p className="mt-0.5 text-[10px] text-subtle">Premium</p>
        ) : null}
      </div>

      {state === "done" ? (
        <CheckCircle2 className="size-4 shrink-0 text-emerald-500" aria-hidden />
      ) : state === "in-progress" ? (
        <Play className="size-4 shrink-0 text-primary" aria-hidden />
      ) : state === "locked" ? (
        <Lock className="size-4 shrink-0 text-muted" aria-hidden />
      ) : (
        <Play className="size-4 shrink-0 text-muted" aria-hidden />
      )}
    </div>
  );

  if (!isClickable) return inner;

  return (
    <Link to="/parcours/$deckId" params={{ deckId: deck.id }} className="block">
      {inner}
    </Link>
  );
}
