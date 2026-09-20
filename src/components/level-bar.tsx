import { Sparkles } from "lucide-react";
import { levelInfo } from "@/core/scoring";
import { useOptimus } from "@/state/store";

export function LevelBar() {
  const xp = useOptimus((s) => s.xp);
  const lvl = levelInfo(xp);
  return (
    <div className="mt-4 rounded-[var(--radius-lg)] bg-card p-4 shadow-[var(--shadow-border)]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-full bg-primary-soft">
            <Sparkles className="size-4 text-primary" aria-hidden />
          </span>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
              Niveau {lvl.level}
            </p>
            <p className="text-sm font-medium">{lvl.title}</p>
          </div>
        </div>
        <span className="text-[11px] text-subtle">
          {lvl.xpInto} / {lvl.xpForNext} XP
        </span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full bg-primary transition-all duration-500"
          style={{ width: `${lvl.progress}%` }}
        />
      </div>
    </div>
  );
}
