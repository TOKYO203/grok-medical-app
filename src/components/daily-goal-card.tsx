import { Target, Flame, CheckCircle2 } from "lucide-react";
import { useDailyGoal } from "@/lib/daily-goal";

export function DailyGoalCard() {
  const { goal, answered, target, pct, done, streak } = useDailyGoal();
  if (!goal) return null;

  return (
    <div className="rounded-[var(--radius-lg)] bg-card p-4 shadow-[var(--shadow-border)]">
      <div className="flex items-center gap-3">
        <div
          className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
            done ? "bg-emerald-500/15" : "bg-primary-soft"
          }`}
        >
          {done ? (
            <CheckCircle2 className="size-4 text-emerald-500" aria-hidden />
          ) : (
            <Target className="size-4 text-primary" aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
              Objectif du jour
            </p>
            {streak > 0 ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400">
                <Flame className="size-3" aria-hidden />
                {streak} j
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-sm font-medium">{goal.label}</p>
        </div>
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between text-[11px] text-subtle">
          <span>{done ? "Objectif atteint 🎉" : `${answered} / ${target} QCMs`}</span>
          <span>{pct}%</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
          <div
            className={`h-full transition-all duration-500 ${
              done ? "bg-emerald-500" : "bg-primary"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
