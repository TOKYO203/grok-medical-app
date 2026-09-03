import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { QuizPlayer, type QuizItem } from "@/components/quiz-player";
import { Page, Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { pickExamQuestions, questionXp } from "@/core/quiz-engine";
import { hasAccess, useAllDecks, useOptimus } from "@/state/store";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/examen")({ component: ExamPage });

function ExamPage() {
  const decks = useAllDecks();
  const entitlements = useOptimus((s) => s.entitlements);
  const profile = useOptimus((s) => s.profile);
  const recordAnswer = useOptimus((s) => s.recordAnswer);
  const navigate = useNavigate();
  const unlocked = decks.filter((d) => hasAccess(d, entitlements, profile.tier));
  const [started, setStarted] = useState(false);
  const items: QuizItem[] = useMemo(() => {
    if (!started) return [];
    return pickExamQuestions(unlocked, 12).map((row) => ({
      question: row.question,
      deckTitle: row.deck.title,
    }));
  }, [started, unlocked]);
  const deckByQ = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of unlocked) for (const q of d.questions) m.set(q.id, d.id);
    return m;
  }, [unlocked]);

  const locked = profile.tier !== "pro" && !entitlements.some((e) => e.product === "OPTIMUS_PRO");

  return (
    <Shell title="Examen blanc">
      <Page className="mx-auto max-w-lg">
        <h1 className="font-display text-3xl font-medium tracking-tight">Examen blanc</h1>
        <p className="mt-2 text-sm text-muted">
          Douze questions tirées de vos decks débloqués. L’XP motive ; le score ne remplace pas la Mastery.
        </p>
        {locked ? (
          <div className="mt-6 rounded-[var(--radius-xl)] bg-card p-5 shadow-[var(--shadow-border)]">
            <p className="text-sm">Les examens blancs complets sont un entitlement Pro. Un essai court reste possible.</p>
            <div className="mt-4 flex gap-2">
              <Button onClick={() => setStarted(true)}>Essai 12 questions</Button>
              <Link to="/pro">
                <Button variant="secondary">Optimus Pro</Button>
              </Link>
            </div>
          </div>
        ) : null}
        {!started && !locked ? (
          <Button className="mt-6" onClick={() => setStarted(true)}>
            Commencer
          </Button>
        ) : null}
        {started ? (
          <div className="mt-6">
            <QuizPlayer
              items={items}
              onAnswer={(item, ok, combo) => {
                const deckId = deckByQ.get(item.question.id);
                if (!deckId) return;
                recordAnswer({
                  deckId,
                  questionId: item.question.id,
                  ok,
                  xp: questionXp(item.question.difficulty, combo, ok),
                  mode: "exam",
                });
              }}
              onFinish={() => void navigate({ to: "/" })}
              finishLabel="Retour"
            />
          </div>
        ) : null}
      </Page>
    </Shell>
  );
}
