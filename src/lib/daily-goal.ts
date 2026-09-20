import { useEffect, useState } from "react";
import { DAILY_GOALS, type DailyGoalId } from "@/data/onboarding";
import { useOptimus } from "@/state/store";

const KEY = "optimus.dailyGoal";

export function useDailyGoal() {
  const [goalId, setGoalId] = useState<DailyGoalId | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(KEY) as DailyGoalId | null;
    if (raw && DAILY_GOALS.some((g) => g.id === raw)) setGoalId(raw);
  }, []);

  const answered = useOptimus((s) => s.daily.answered);
  const streak = useOptimus((s) => s.streak);

  const goal = goalId ? DAILY_GOALS.find((g) => g.id === goalId) ?? null : null;
  const target = goal?.target ?? 0;
  const pct = target > 0 ? Math.min(100, Math.round((answered / target) * 100)) : 0;
  const done = pct >= 100;

  return { goalId, goal, answered, target, pct, done, streak };
}
