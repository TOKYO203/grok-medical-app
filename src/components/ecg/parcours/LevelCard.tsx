import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { countLessonsForLevel, isLevelAvailable, listLevelLessons } from "@/lib/ecg/parcours/catalog";
import { levelProgress } from "@/lib/ecg/parcours/progression";
import type { LevelMeta } from "@/lib/ecg/parcours/types";

export function LevelCard({ level }: { level: LevelMeta }) {
  const available = isLevelAvailable(level.id);
  const [progress, setProgress] = useState({ done: 0, total: 0, pct: 0 });

  useEffect(() => {
    if (!available) return;
    const lessons = listLevelLessons(level.id).map((l) => l.id);
    setProgress(levelProgress(level.id, lessons));
  }, [available, level.id]);

  const inner = (
    <div className="flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 font-bold text-emerald-700">
        {level.id}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-semibold">{level.title}</h3>
          <span className="text-xs text-subtle">
            {available ? `${countLessonsForLevel(level.id)} leçons · ~${level.estimatedMin} min` : "Bientôt"}
          </span>
        </div>
        <p className="mt-1 text-sm text-subtle">{level.subtitle}</p>
        {available && (
          <div className="mt-3">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-emerald-500" style={{ width: `${progress.pct}%` }} />
            </div>
            <p className="mt-1 text-xs text-subtle">{progress.done}/{progress.total} · {progress.pct}%</p>
          </div>
        )}
      </div>
      {available && <ChevronRight size={16} className="text-subtle mt-1" />}
    </div>
  );

  if (!available) {
    return <div className="rounded-xl border border-subtle p-4 opacity-60">{inner}</div>;
  }

  return (
    <Link
      to="/ecg/niveau/$letter"
      params={{ letter: level.id }}
      className="block rounded-xl border border-default p-4 transition hover:border-strong"
    >
      {inner}
    </Link>
  );
}
