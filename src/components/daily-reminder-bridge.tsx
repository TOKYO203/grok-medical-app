import { useEffect } from "react";
import { useDailyGoal } from "@/lib/daily-goal";
import { shouldRemind, sendDailyReminder } from "@/lib/notifications/daily-reminder";

export function DailyReminderBridge() {
  const { answered, target } = useDailyGoal();

  useEffect(() => {
    if (target <= 0) return;

    const check = () => {
      if (shouldRemind(answered, target)) {
        sendDailyReminder(answered, target);
      }
    };

    check();
    const interval = window.setInterval(check, 60_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [answered, target]);

  return null;
}
