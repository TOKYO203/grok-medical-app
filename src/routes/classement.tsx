import { createFileRoute } from "@tanstack/react-router";
import { Page, Shell } from "@/components/shell";
import { PEERS } from "@/content/leaderboard";
import { optimusScore } from "@/core/scoring";
import { currentLeague, useAllDecks, useOptimus } from "@/state/store";
import { cn } from "@/lib/utils";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/classement")({ component: BoardPage });

function BoardPage() {
  const profile = useOptimus((s) => s.profile);
  const xp = useOptimus((s) => s.xp);
  const streak = useOptimus((s) => s.streak);
  const weeklyXp = useOptimus((s) => s.weeklyXp);
  const casesCompleted = useOptimus((s) => s.casesCompleted);
  const progress = useOptimus((s) => s.progress);
  const decks = useAllDecks();
  const [scope, setScope] = useState<"world" | "mg" | "year">("mg");
  const league = currentLeague(weeklyXp);
  const youScore = optimusScore({
    xp,
    streak,
    casesCompleted: casesCompleted.length,
    decks,
    progressMap: progress,
    weeklyXp,
  });
  const you = {
    id: "you",
    name: profile.displayName || "Vous",
    year: profile.studyYear,
    country: profile.country || "Madagascar",
    faculty: profile.faculty || "—",
    score: youScore,
    league: league.label,
    subject: profile.prioritySubjects[0] ?? "—",
  };
  const rows = useMemo(() => {
    let list = [...PEERS, you];
    if (scope === "mg") list = list.filter((p) => p.country === "Madagascar");
    if (scope === "year") list = list.filter((p) => p.year === profile.studyYear);
    return list.sort((a, b) => b.score - a.score);
  }, [scope, youScore, profile.studyYear, profile.country, profile.displayName, profile.faculty, you]);

  return (
    <Shell title="Classement">
      <Page>
        <h1 className="font-display text-3xl font-medium tracking-tight">Classement</h1>
        <p className="mt-2 max-w-lg text-sm text-muted">
          Score Optimus : Mastery, rétention, cas, régularité — pas seulement le volume. Calcul local en attendant le
          serveur. Anti-triche : les événements sont filetés et horodatés.
        </p>
        <p className="mt-3 text-sm">
          Ligue {league.label} · saison hebdomadaire · {weeklyXp} XP cette semaine
        </p>
        <div className="mt-4 flex gap-1.5">
          {(
            [
              ["mg", "National"],
              ["year", "Année"],
              ["world", "Mondial"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setScope(id)}
              className={cn(
                "h-9 rounded-full px-3 text-sm",
                scope === id ? "bg-primary text-primary-fg" : "bg-card shadow-[var(--shadow-border)]",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <ol className="mt-6 space-y-1">
          {rows.map((p, i) => (
            <li
              key={p.id}
              className={cn(
                "flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-3",
                p.id === "you" ? "bg-primary-soft" : "bg-card shadow-[var(--shadow-border)]",
              )}
            >
              <span className="w-6 font-mono text-sm tabular-nums text-muted">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{p.name}</p>
                <p className="truncate text-xs text-muted">
                  {p.faculty} · {p.year}e · {p.league}
                </p>
              </div>
              <span className="font-mono text-sm tabular-nums">{p.score}</span>
            </li>
          ))}
        </ol>
      </Page>
    </Shell>
  );
}
