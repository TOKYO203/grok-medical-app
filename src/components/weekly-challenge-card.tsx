import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useAllDecks, useOptimus } from "@/state/store";
import { useAppUser } from "@/hooks/useAppUser";
import { challengeScore, currentWeekKey, weeklyChallengeDeck } from "@/lib/weekly-challenge-model";
import {
  getWeeklyChallenge,
  submitWeeklyChallengeRun,
  type WeeklyChallengeRow,
} from "@/lib/weekly-challenge";
import { cn } from "@/lib/utils";

/**
 * Défi hebdomadaire (LB-2) : un deck désigné par semaine, le même pour tout le
 * monde (choix déterministe de la clé de semaine). Le score publié = bonnes
 * réponses cumulées sur CE deck (maîtrise, pas vélocité) ; la RPC ne garde que
 * le meilleur score de la semaine et refuse toute autre semaine que l'en cours.
 */
export function WeeklyChallengeCard() {
  const progress = useOptimus((s) => s.progress);
  const decks = useAllDecks();
  const { user, isPending } = useAppUser();
  const connected = !isPending && !!user && !(user?.isDevFallback ?? false);
  const weekKey = currentWeekKey();
  const deck = weeklyChallengeDeck(weekKey, decks);
  const [rows, setRows] = useState<WeeklyChallengeRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { rows: fresh } = await getWeeklyChallenge();
      setRows(fresh);
    } catch {
      setRows([]);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (connected) void load();
    else setLoaded(true);
  }, [connected, load]);

  if (!deck) return null;
  const seen = progress[deck.id]?.seen as Record<string, { correct: number; wrong: number }> | undefined;
  const { score, total } = challengeScore(deck, seen);

  async function publish() {
    // Les déclarations de fonctions sont hoistées : le narrowing du return
    // ci-dessus ne s'applique pas ici, d'où la garde explicite.
    if (!deck) return;
    setBusy(true);
    setMsg(null);
    try {
      const { ok } = await submitWeeklyChallengeRun({
        data: { weekKey, deckId: deck.id, score, total: Math.max(total, 1) },
      });
      if (!ok) {
        setMsg("Soumission refusée (la semaine a peut-être changé, recharge la page).");
      } else {
        setMsg("Score publié ✓");
        await load();
      }
    } catch {
      setMsg("Publication impossible pour l'instant.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 rounded-[var(--radius-xl)] bg-card p-5 shadow-[var(--shadow-border)]">
      <p className="text-xs uppercase tracking-wide text-muted">Défi de la semaine</p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium">{deck.title}</h2>
          <p className="text-xs text-muted">
            {deck.questionCount ?? deck.questions.length} questions · semaine {weekKey} · le même défi pour tout le monde
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/parcours/$deckId"
            params={{ deckId: deck.id }}
            className="h-9 rounded-[var(--radius-sm)] bg-primary px-3 text-sm font-medium leading-9 text-primary-fg"
          >
            Étudier ce deck
          </Link>
          {connected ? (
            <button
              type="button"
              onClick={() => void publish()}
              disabled={busy}
              className="h-9 rounded-[var(--radius-sm)] border border-border px-3 text-sm disabled:opacity-50"
            >
              {busy ? "…" : "Publier mon score"}
            </button>
          ) : null}
        </div>
      </div>
      <p className="mt-2 text-xs text-muted">
        {msg ??
          (total > 0
            ? `Ta maîtrise : ${score} bonnes réponses sur ${total} posées sur ce deck.`
            : "Aucune réponse enregistrée sur ce deck pour l'instant.")}
      </p>

      {connected && loaded && rows.length > 0 ? (
        <ol className="mt-3 space-y-1">
          {rows.slice(0, 10).map((row) => (
            <li
              key={row.rank}
              className={cn(
                "flex items-center gap-3 rounded-[var(--radius-sm)] px-2 py-1.5 text-sm",
                row.self ? "bg-primary-soft" : "",
              )}
            >
              <span className="w-5 font-mono text-xs tabular-nums text-muted">{row.rank}</span>
              <span className="min-w-0 flex-1 truncate">
                {row.pseudo}
                {row.self ? " (toi)" : ""}
              </span>
              <span className="font-mono text-xs tabular-nums">
                {row.score}/{row.total}
              </span>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
