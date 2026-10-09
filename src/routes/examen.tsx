import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ClipboardCheck, Lock, Sparkles, Timer } from "lucide-react";
import { QuizPlayer, type QuizItem } from "@/components/quiz-player";
import { Page, PageHeader, Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { pickExamQuestions, questionXp } from "@/core/quiz-engine";
import { hasAccess, hasEntitlement, useAllDecks, useOptimus } from "@/state/store";

export const Route = createFileRoute("/examen")({ component: ExamPage });

const EXAM_QUESTIONS = 12;

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
    return pickExamQuestions(unlocked, EXAM_QUESTIONS).map((row) => ({
      question: row.question,
      deckTitle: row.deck.title,
    }));
  }, [started, unlocked]);
  const deckByQ = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of unlocked) for (const q of d.questions) m.set(q.id, d.id);
    return m;
  }, [unlocked]);

  const locked = !hasEntitlement("OPTIMUS_PRO", entitlements);

  return (
    <Shell title="Examen blanc">
      <Page className="mx-auto max-w-2xl">
        <PageHeader
          kicker="Évaluation"
          title="Examen blanc"
          description="Douze questions tirées de vos decks débloqués, sans indice. L’XP entretient la motivation ; c’est la maîtrise clinique qui progresse."
        />

        <div className="mt-5 grid grid-cols-3 gap-2">
          <Metric label="Questions" value={String(EXAM_QUESTIONS)} />
          <Metric label="Decks" value={String(unlocked.length)} accent />
          <Metric label="Mode" value="Sans indice" />
        </div>

        {!started ? (
          <section className="premium-hero mt-6 overflow-hidden rounded-[var(--radius-xl)] p-5 text-primary-fg shadow-[var(--shadow-md)]">
            <div className="flex items-start gap-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-white/20 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.22)]">
                {locked ? <Lock className="size-5" /> : <ClipboardCheck className="size-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-2xl font-medium tracking-tight">
                  {locked ? "Épreuve complète Premium" : "Prêt à vous tester ?"}
                </h2>
                <p className="mt-2 max-w-md text-sm leading-relaxed opacity-85">
                  {locked
                    ? "Les examens complets sont inclus dans Optimus Pro. Un essai court de douze questions reste disponible."
                    : "Une épreuve chronométrée, tous decks confondus, pour mesurer vos acquis en conditions réelles."}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3 text-xs opacity-85">
                  <span className="inline-flex items-center gap-1.5">
                    <Timer className="size-4" aria-hidden />
                    ~10 minutes
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Sparkles className="size-4" aria-hidden />
                    XP + maîtrise
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Button
                onClick={() => setStarted(true)}
                className="w-full bg-bg text-fg hover:bg-bg/90 sm:w-auto"
              >
                {locked ? "Essai · 12 questions" : "Commencer l’épreuve"}
              </Button>
              {locked ? (
                <Link
                  to="/pro"
                  className={buttonVariants({
                    variant: "secondary",
                    className: "w-full sm:w-auto",
                  })}
                >
                  Optimus Pro
                </Link>
              ) : null}
            </div>
          </section>
        ) : (
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
        )}

        {!started ? (
          <p className="mt-6 text-xs leading-relaxed text-muted">
            Astuce : pour travailler une faiblesse précise, ouvrez la bibliothèque et filtrez par
            compétence.
          </p>
        ) : null}
      </Page>
    </Shell>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="optimus-card px-3 py-3 text-center">
      <p
        className={`truncate font-display text-xl font-medium tabular-nums ${
          accent ? "text-primary" : "text-fg"
        }`}
      >
        {value}
      </p>
      <p className="mt-0.5 truncate text-[11px] font-medium uppercase tracking-wider text-muted">
        {label}
      </p>
    </div>
  );
}
