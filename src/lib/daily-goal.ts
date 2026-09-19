import { useEffect, useState } from "react";
import { DAILY_GOALS, type DailyGoalId } from "@/data/onboarding";

const KEY = "optimus.dailyGoal";

export function useDailyGoal() {
  const [goalId, setGoalId] = useState<DailyGoalId | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(KEY) as DailyGoalId | null;
    if (raw && DAILY_GOALS.some((g) => g.id === raw)) setGoalId(raw);
  }, []);

  const goal = goalId ? DAILY_GOALS.find((g) => g.id === goalId) ?? null : null;
  return { goalId, goal };
}
