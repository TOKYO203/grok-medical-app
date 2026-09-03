import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { QuizPlayer, type QuizItem } from "@/components/quiz-player";
import { Page, Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { pickTodayQuestions, questionXp } from "@/core/quiz-engine";
import { isDue } from "@/core/spaced-repetition";
import { hasAccess, useAllDecks, useOptimus } from "@/state/store";

type Search = { mode?: "today" | "revue" };

export const Route = createFileRoute("/revue")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    mode: s.mode === "today" ? "today" : "revue",
  }),
  component: RevuePage,
});

function RevuePage() {
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const decks = useAllDecks();
  const progress = useOptimus((s) => s.progress);
  const entitlements = useOptimus((s) => s.entitlements);
  const tier = useOptimus((s) => s.profile.tier);
  const recordAnswer = useOptimus((s) => s.recordAnswer);
  const unlocked = decks.filter((d) => hasAccess(d, entitlements, tier));

  const today = pickTodayQuestions(unlocked, progress, mode === "today" ? 10 : 8);
  const dueOnly: QuizItem[] =
    mode === "today"
      ? today.map((row) => ({ question: row.question, deckTitle: row.deck.title }))
      : unlocked.flatMap((deck) => {
          const seen = progress[deck.id]?.seen ?? {};
          return deck.questions
            .filter((q) => isDue(seen[q.id]) || (seen[q.id] && seen[q.id].wrong > seen[q.id].correct))
            .map((question) => ({ question, deckTitle: deck.title }));
        });

  const items = dueOnly.slice(0, 10);
  const deckByQuestion = new Map<string, string>();
  for (const row of today) deckByQuestion.set(row.question.id, row.deck.id);
  for (const deck of unlocked) {
    for (const q of deck.questions) if (!deckByQuestion.has(q.id)) deckByQuestion.set(q.id, deck.id);
  }

  return (
    <Shell title="Réviser">
      <Page>
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Répétition espacée</p>
        <h1 className="mt-1 font-display text-3xl font-medium tracking-tight">
          {mode === "today" ? "Session du jour" : "Révisions"}
        </h1>
        <p className="mt-2 max-w-lg text-sm text-muted">
          Les cartes fragiles reviennent vite, les consolidées plus tard. Fonctionne sans Internet.
        </p>
        {items.length === 0 ? (
          <div className="mt-10 rounded-[var(--radius-xl)] bg-card p-6 shadow-[var(--shadow-border)]">
            <p className="text-sm text-muted">Rien à réviser pour l’instant. Avancez un deck, les échéances suivront.</p>
            <Link to="/parcours" className="mt-4 inline-block">
              <Button>Ouvrir le parcours</Button>
            </Link>
          </div>
        ) : (
          <div className="mt-6">
            <QuizPlayer
              items={items}
              onAnswer={(item, ok, combo) => {
                const deckId = deckByQuestion.get(item.question.id);
                if (!deckId) return;
                recordAnswer({
                  deckId,
                  questionId: item.question.id,
                  ok,
                  xp: questionXp(item.question.difficulty, combo, ok),
                  mode: "revue",
                });
              }}
              onFinish={() => void navigate({ to: "/" })}
              finishLabel="Retour à l’accueil"
            />
          </div>
        )}
      </Page>
    </Shell>
  );
}
