import { Target } from "lucide-react";
import { useDailyGoal } from "@/lib/daily-goal";

export function DailyGoalCard() {
  const { goal } = useDailyGoal();
  if (!goal) return null;

  return (
    <div className="flex items-center gap-3 rounded-[var(--radius-lg)] bg-card px-4 py-3 shadow-[var(--shadow-border)]">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft">
        <Target className="size-4 text-primary" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
          Objectif du jour
        </p>
        <p className="mt-0.5 truncate text-sm font-medium">{goal.label}</p>
        <p className="mt-0.5 truncate text-xs text-subtle">{goal.description}</p>
      </div>
    </div>
  );
}
