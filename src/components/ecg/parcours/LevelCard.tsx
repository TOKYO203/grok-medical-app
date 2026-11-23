import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronRight, Lock } from "lucide-react";
import {
  countLessonsForLevel,
  isLevelAvailable,
  listLevelLessons,
} from "@/lib/ecg/parcours/catalog";
import {
  levelProgress,
  isLevelUnlocked,
  getUnlockThreshold,
} from "@/lib/ecg/parcours/progression";
import type { Level, LevelMeta } from "@/lib/ecg/parcours/types";

const LEVEL_ORDER: Level[] = ["A", "B", "C", "D", "E"];

export function LevelCard({ level }: { level: LevelMeta }) {
  const hasData = isLevelAvailable(level.id);
  const [progress, setProgress] = useState({ done: 0, total: 0, pct: 0 });
  const [unlocked, setUnlocked] = useState(true);
  const [prevLevelName, setPrevLevelName] = useState<string>("");
  const [threshold, setThreshold] = useState(80);

  useEffect(() => {
    if (!hasData) return;
    const lessons = listLevelLessons(level.id).map((l) => l.id);
    setProgress(levelProgress(level.id, lessons));
    setThreshold(getUnlockThreshold());

    const idx = LEVEL_ORDER.indexOf(level.id);
    if (idx > 0) {
      const prevLevel = LEVEL_ORDER[idx - 1];
      const prevLessons = listLevelLessons(prevLevel).map((l) => l.id);
      setUnlocked(isLevelUnlocked(level.id, prevLessons));
      setPrevLevelName(prevLevel);
    } else {
      setUnlocked(true);
    }
  }, [hasData, level.id]);

  const locked = hasData && !unlocked;

  const inner = (
    <div className="flex items-start gap-3">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg font-bold ${
          locked
            ? "bg-muted text-subtle"
            : "bg-emerald-50 text-emerald-700"
        }`}
      >
        {locked ? <Lock size={16} /> : level.id}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className={`font-semibold ${locked ? "text-subtle" : ""}`}>
            {level.title}
          </h3>
          <span className="text-xs text-subtle">
            {hasData
              ? `${countLessonsForLevel(level.id)} leçons · ~${level.estimatedMin} min`
              : "Bientôt"}
          </span>
        </div>
        <p className="mt-1 text-sm text-subtle">{level.subtitle}</p>

        {hasData && unlocked && (
          <div className="mt-3">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-emerald-500"
                style={{ width: `${progress.pct}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-subtle">
              {progress.done}/{progress.total} · {progress.pct}%
            </p>
          </div>
        )}

        {locked && (
          <p className="mt-2 text-xs text-amber-700">
            🔒 Atteignez {threshold}% du niveau {prevLevelName} pour débloquer
          </p>
        )}
      </div>
      {hasData && unlocked && <ChevronRight size={16} className="text-subtle mt-1" />}
    </div>
  );

  if (!hasData || locked) {
    return (
      <div className="cursor-not-allowed rounded-xl border border-subtle p-4 opacity-70">
        {inner}
      </div>
    );
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
