import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Page, Shell } from "@/components/shell";
import { optimusScore } from "@/core/scoring";
import { seedBuiltinDecks } from "@/state/builtin-decks";
import { BUILTIN_DECKS } from "@/content/catalog";
import { currentLeague, useAllDecks, useOptimus } from "@/state/store";
import { useAppUser } from "@/hooks/useAppUser";
import { getLeaderboard, setLeaderboardPseudo, type LeaderboardRow } from "@/lib/leaderboard";
import { WeeklyChallengeCard } from "@/components/weekly-challenge-card";
import { cn } from "@/lib/utils";

// G51 — code-splitting : le store ne charge plus le catalogue ; cette route
// sème le cache des decks intégrés (évalué côté serveur comme côté client).
seedBuiltinDecks(BUILTIN_DECKS);

export const Route = createFileRoute("/classement")({ component: BoardPage });

type BoardStatus = "loading" | "ok" | "offline";

function BoardPage() {
  const profile = useOptimus((s) => s.profile);
  const xp = useOptimus((s) => s.xp);
  const streak = useOptimus((s) => s.streak);
  const weeklyXp = useOptimus((s) => s.weeklyXp);
  const casesCompleted = useOptimus((s) => s.casesCompleted);
  const progress = useOptimus((s) => s.progress);
  const decks = useAllDecks();
  const { user, isPending } = useAppUser();
  const connected = !isPending && !!user && !(user?.isDevFallback ?? false);
  const [scope, setScope] = useState<"world" | "mg" | "year">("mg");
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [status, setStatus] = useState<BoardStatus>("loading");
  const [pseudoInput, setPseudoInput] = useState("");
  const [pseudoBusy, setPseudoBusy] = useState(false);
  const [pseudoMsg, setPseudoMsg] = useState<string | null>(null);
  const league = currentLeague(weeklyXp);

  const refresh = useCallback(async () => {
    setStatus((prev) => (prev === "ok" ? prev : "loading"));
    try {
      const { rows: fresh } = await getLeaderboard();
      setRows(fresh);
      setStatus("ok");
      const self = fresh.find((row) => row.self);
      if (self) setPseudoInput(self.pseudo);
    } catch {
      setStatus("offline");
    }
  }, []);

  useEffect(() => {
    if (!connected) {
      setStatus("offline");
      return;
    }
    let disposed = false;
    const run = async () => {
      if (disposed) return;
      await refresh();
    };
    void run();
    const onOnline = () => void run();
    window.addEventListener("online", onOnline);
    return () => {
      disposed = true;
      window.removeEventListener("online", onOnline);
    };
  }, [connected, refresh]);

  async function savePseudo() {
    const pseudo = pseudoInput.trim();
    setPseudoMsg(null);
    setPseudoBusy(true);
    try {
      const { ok } = await setLeaderboardPseudo({ data: { pseudo } });
      if (ok) {
        setPseudoMsg("Pseudo enregistré ✓");
        await refresh();
      } else {
        setPseudoMsg("Pseudo refusé par le serveur (2 à 24 caractères).");
      }
    } catch {
      setPseudoMsg("Impossible d'enregistrer le pseudo pour l'instant.");
    } finally {
      setPseudoBusy(false);
    }
  }

  let scoped = rows;
  if (scope === "mg") scoped = scoped.filter((row) => row.country === "Madagascar");
  if (scope === "year") scoped = scoped.filter((row) => row.year === profile.studyYear);
  const selfRow = rows.find((row) => row.self);

  // Rivaux silencieux (LB-2) : des compteurs, jamais d'identités.
  const ahead = rows.filter((row) => !row.self && row.weeklyXp > weeklyXp).length;
  const behind = rows.filter((row) => !row.self && row.weeklyXp < weeklyXp).length;
  // Classe des facultés (LB-2) : somme des XP hebdo par faculté.
  const facultyTotals = new Map<string, number>();
  for (const row of rows) {
    if (!row.faculty) continue;
    facultyTotals.set(row.faculty, (facultyTotals.get(row.faculty) ?? 0) + row.weeklyXp);
  }
  const faculties = [...facultyTotals.entries()].sort((a, b) => b[1] - a[1]);
  const myFacultyRank = profile.faculty
    ? faculties.findIndex(([name]) => name === profile.faculty) + 1
    : 0;

  return (
    <Shell title="Classement">
      <Page>
        <h1 className="font-display text-3xl font-medium tracking-tight">Classement</h1>
        <p className="mt-2 max-w-lg text-sm text-muted">
          Saison hebdomadaire : XP de la semaine, comme les ligues. Les scores viennent du
          serveur (synchro de ta progression), jamais du poste local — anti-triche côté serveur.
        </p>

        <p className="mt-3 text-sm">
          Ligue {league.label} · {weeklyXp} XP cette semaine
        </p>

        {status === "ok" ? (
          <div className="mt-4 rounded-[var(--radius-md)] border border-border bg-card px-3 py-2.5 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="leaderboard-pseudo" className="font-medium">
                Ton pseudo :
              </label>
              <input
                id="leaderboard-pseudo"
                value={pseudoInput}
                onChange={(event) => setPseudoInput(event.target.value)}
                maxLength={24}
                placeholder={profile.displayName || "Étudiant"}
                className="h-8 min-w-0 flex-1 rounded-[var(--radius-sm)] border border-border bg-background px-2 text-xs outline-none focus:border-primary"
              />
              <button
                type="button"
                onClick={() => void savePseudo()}
                disabled={pseudoBusy || pseudoInput.trim().length < 2}
                className="h-8 shrink-0 rounded-[var(--radius-sm)] bg-primary px-3 text-xs font-medium text-primary-fg disabled:opacity-50"
              >
                {pseudoBusy ? "…" : "Enregistrer"}
              </button>
            </div>
            <p className="mt-1 text-muted">
              {pseudoMsg ?? "Pseudonymes uniquement : le classement n'expose jamais ton identifiant."}
            </p>
          </div>
        ) : (
          <div className="mt-3 rounded-[var(--radius-md)] border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 text-xs text-amber-200/85">
            {status === "loading" ? (
              "Chargement du classement…"
            ) : (
              <>🔌 Mode local : connecte-toi pour voir le classement réel des étudiants.</>
            )}
          </div>
        )}

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

        <WeeklyChallengeCard />

        {status === "ok" ? (
          <ol className="mt-6 space-y-1">
            {scoped.map((row) => (
              <li
                key={row.rank}
                className={cn(
                  "flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-3",
                  row.self ? "bg-primary-soft" : "bg-card shadow-[var(--shadow-border)]",
                )}
              >
                <span className="w-6 font-mono text-sm tabular-nums text-muted">{row.rank}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {row.pseudo}
                    {row.self ? " (toi)" : ""}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {row.faculty || "—"} · {row.year || "—"}e · {currentLeague(row.weeklyXp).label}
                  </p>
                </div>
                <span className="font-mono text-sm tabular-nums">{row.weeklyXp} XP</span>
              </li>
            ))}
            {!selfRow ? (
              <li className="flex items-center gap-3 rounded-[var(--radius-md)] bg-primary-soft px-3 py-3">
                <span className="w-6 font-mono text-sm tabular-nums text-muted">—</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{profile.displayName || "Vous"} (toi)</p>
                  <p className="truncate text-xs text-muted">
                    Pas encore classé : ta progression apparaîtra dès la prochaine synchro.
                  </p>
                </div>
                <span className="font-mono text-sm tabular-nums">{weeklyXp} XP</span>
              </li>
            ) : null}
            {scoped.length === 0 && selfRow ? (
              <li className="rounded-[var(--radius-md)] bg-card px-3 py-4 text-center text-xs text-muted shadow-[var(--shadow-border)]">
                Aucun étudiant dans ce filtre pour l'instant.
              </li>
            ) : null}
          </ol>
        ) : (
          <div className="mt-6 rounded-[var(--radius-xl)] bg-card p-6 shadow-[var(--shadow-border)]">
            <p className="text-sm font-medium">Ta progression locale</p>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-xs text-muted">XP total</dt>
                <dd className="font-mono">{xp}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">XP semaine</dt>
                <dd className="font-mono">{weeklyXp}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Streak</dt>
                <dd className="font-mono">{streak} j</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Cas résolus</dt>
                <dd className="font-mono">{casesCompleted.length}</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-muted">
              Score Optimus local :{" "}
              {optimusScore({
                xp,
                streak,
                casesCompleted: casesCompleted.length,
                decks,
                progressMap: progress,
                weeklyXp,
              })}
            </p>
          </div>
        )}

        {status === "ok" && rows.length > 0 ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[var(--radius-xl)] bg-card p-5 shadow-[var(--shadow-border)]">
              <p className="text-xs uppercase tracking-wide text-muted">Rivaux cette semaine</p>
              <p className="mt-2 text-sm">
                {rows.length <= 1 ? (
                  "Tu es le premier étudiant classé de la beta — les autres arrivent."
                ) : (
                  <>
                    {ahead === 0
                      ? "Personne ne te devance cette semaine. 🏆"
                      : `${ahead} étudiant${ahead > 1 ? "s" : ""} te devanc${ahead > 1 ? "ent" : "e"} en XP hebdo.`}{" "}
                    {behind > 0 ? `Tu en devances ${behind}.` : ""}
                  </>
                )}
              </p>
              <p className="mt-1 text-xs text-muted">Des compteurs, jamais d'identités.</p>
            </div>
            <div className="rounded-[var(--radius-xl)] bg-card p-5 shadow-[var(--shadow-border)]">
              <p className="text-xs uppercase tracking-wide text-muted">Classe des facultés</p>
              {faculties.length === 0 ? (
                <p className="mt-2 text-sm">
                  Aucune faculté renseignée pour l'instant — remplis ton profil pour compter pour la tienne.
                </p>
              ) : (
                <>
                  <ol className="mt-2 space-y-1 text-sm">
                    {faculties.slice(0, 3).map(([name, total], index) => (
                      <li key={name} className="flex items-center justify-between gap-2">
                        <span className="truncate">
                          {index + 1}. {name}
                          {name === profile.faculty ? " (ta promo)" : ""}
                        </span>
                        <span className="font-mono text-xs tabular-nums">{total} XP</span>
                      </li>
                    ))}
                  </ol>
                  {profile.faculty && myFacultyRank > 3 ? (
                    <p className="mt-1 text-xs text-muted">
                      Ta faculté est {myFacultyRank}
                      {myFacultyRank === 1 ? "re" : "e"} avec {facultyTotals.get(profile.faculty) ?? 0} XP cumulés.
                    </p>
                  ) : null}
                </>
              )}
            </div>
          </div>
        ) : null}
      </Page>
    </Shell>
  );
}
