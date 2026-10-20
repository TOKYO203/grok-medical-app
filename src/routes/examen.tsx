import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, ClipboardCheck, Lock, RotateCcw, Sparkles, Timer, Trophy } from "lucide-react";
import { QuizPlayer, type QuizItem } from "@/components/quiz-player";
import { EmptyState } from "@/components/empty-state";
import { Page, PageHeader, Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { pickExamQuestions, questionXp } from "@/core/quiz-engine";
import { cn } from "@/lib/utils";
import { seedBuiltinDecks } from "@/state/builtin-decks";
import { BUILTIN_DECKS } from "@/content/catalog";
import { hasAccess, hasEntitlement, useAllDecks, useOptimus } from "@/state/store";

// G51 — code-splitting : le store ne charge plus le catalogue ; cette route
// sème le cache des decks intégrés (évalué côté serveur comme côté client).
seedBuiltinDecks(BUILTIN_DECKS);

export const Route = createFileRoute("/examen")({ component: ExamPage });

const EXAM_QUESTIONS = 12;
// E44 — épreuve chronométrée : dix minutes pour douze questions (~50 s par question).
const EXAM_DURATION_SECONDS = 600;
// Seuil de réussite du rapport, aligné sur la barre « clear » des sessions (70 %).
const EXAM_PASS_RATIO = 0.7;
const TIMER_TICK_MS = 500;

type ExamPhase = "idle" | "running" | "results";

type ExamReport = {
  correct: number;
  answered: number;
  total: number;
  secondsUsed: number;
  xpEarned: number;
  timedOut: boolean;
};

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function ExamPage() {
  const decks = useAllDecks();
  const entitlements = useOptimus((s) => s.entitlements);
  const profile = useOptimus((s) => s.profile);
  const recordAnswer = useOptimus((s) => s.recordAnswer);
  const unlocked = decks.filter((d) => hasAccess(d, entitlements, profile.tier));
  const [phase, setPhase] = useState<ExamPhase>("idle");
  const [items, setItems] = useState<QuizItem[]>([]);
  const [report, setReport] = useState<ExamReport | null>(null);
  const [remaining, setRemaining] = useState(EXAM_DURATION_SECONDS);
  const totalRef = useRef(0);
  const startedAtRef = useRef(0);
  const finishedRef = useRef(false);
  const answersRef = useRef({ answered: 0, correct: 0, xpEarned: 0 });
  const deckByQ = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of unlocked) for (const q of d.questions) m.set(q.id, d.id);
    return m;
  }, [unlocked]);

  const completeExam = useCallback((opts: { timedOut: boolean; correct?: number }) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const secondsUsed = Math.min(
      EXAM_DURATION_SECONDS,
      Math.max(0, Math.round((Date.now() - startedAtRef.current) / 1000)),
    );
    const { answered, correct, xpEarned } = answersRef.current;
    setReport({
      correct: opts.correct ?? correct,
      answered,
      total: totalRef.current,
      secondsUsed,
      xpEarned,
      timedOut: opts.timedOut,
    });
    setPhase("results");
  }, []);

  // E44 — minuteur : l’épreuve se termine seule à l’expiration des dix minutes,
  // les questions restées sans réponse comptant comme fausses.
  useEffect(() => {
    if (phase !== "running") return;
    const deadline = startedAtRef.current + EXAM_DURATION_SECONDS * 1000;
    const id: ReturnType<typeof setInterval> = setInterval(() => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) completeExam({ timedOut: true });
    }, TIMER_TICK_MS);
    return () => clearInterval(id);
  }, [phase, completeExam]);

  function startExam() {
    const pool = pickExamQuestions(unlocked, EXAM_QUESTIONS);
    totalRef.current = pool.length;
    answersRef.current = { answered: 0, correct: 0, xpEarned: 0 };
    finishedRef.current = false;
    startedAtRef.current = Date.now();
    setItems(pool.map((row) => ({ question: row.question, deckTitle: row.deck.title })));
    setRemaining(EXAM_DURATION_SECONDS);
    setReport(null);
    setPhase("running");
  }

  const locked = !hasEntitlement("OPTIMUS_PRO", entitlements);
  const noContent = unlocked.length === 0;

  return (
    <Shell title="Examen blanc">
      <Page
        className="mx-auto max-w-2xl"
        header={
          <PageHeader
            kicker="Évaluation"
            title="Examen blanc"
            description="Douze questions tirées de vos decks débloqués, sans indice, en dix minutes chrono. L’XP entretient la motivation ; c’est la maîtrise clinique qui progresse."
          />
        }
      >
        {phase === "idle" ? (
          <>
            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Metric label="Questions" value={String(EXAM_QUESTIONS)} />
              <Metric label="Decks" value={String(unlocked.length)} accent />
              <Metric label="Durée" value="10 min" />
              <Metric label="Mode" value="Sans indice" />
            </div>

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
                      ? "Les examens complets sont inclus dans l’abonnement. Une épreuve découverte de douze questions reste disponible."
                      : "Une épreuve chronométrée, tous decks confondus, pour mesurer vos acquis en conditions réelles."}
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-3 text-xs opacity-85">
                    <span className="inline-flex items-center gap-1.5">
                      <Timer className="size-4" aria-hidden />
                      10 minutes chrono
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
                  onClick={startExam}
                  disabled={noContent}
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

            {noContent ? (
              <EmptyState
                className="mt-6"
                icon={BookOpen}
                title="Aucun deck débloqué pour l’instant"
                description="Ouvrez la bibliothèque pour commencer à réviser, puis revenez passer l’épreuve."
                action={
                  <Link to="/bibliotheque" className={buttonVariants({})}>
                    Ouvrir la bibliothèque
                  </Link>
                }
              />
            ) : (
              <p className="mt-6 text-xs leading-relaxed text-muted">
                Astuce : pour travailler une faiblesse précise, ouvrez la bibliothèque et filtrez
                par compétence.
              </p>
            )}
          </>
        ) : null}

        {phase === "running" ? (
          <div className="mt-6">
            <div className="mb-5 flex items-center justify-between gap-3 rounded-[var(--radius-lg)] bg-card px-4 py-3 shadow-[var(--shadow-border)]">
              <span className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
                <Timer className="size-4" aria-hidden />
                Temps restant
              </span>
              <span
                role="timer"
                aria-live="off"
                aria-label="Temps restant"
                className={cn(
                  "font-mono text-lg font-medium tabular-nums",
                  remaining <= 60 ? "text-danger" : remaining <= 180 ? "text-warn" : "text-fg",
                )}
              >
                {formatClock(remaining)}
              </span>
            </div>
            <QuizPlayer
              items={items}
              onAnswer={(item, ok, combo) => {
                const xp = questionXp(item.question.difficulty, combo, ok);
                answersRef.current.answered += 1;
                if (ok) answersRef.current.correct += 1;
                answersRef.current.xpEarned += xp;
                const deckId = deckByQ.get(item.question.id);
                if (!deckId) return;
                recordAnswer({
                  deckId,
                  questionId: item.question.id,
                  ok,
                  xp,
                  mode: "exam",
                });
              }}
              onFinish={(summary) => completeExam({ timedOut: false, correct: summary.correct })}
              finishLabel="Voir le rapport"
            />
          </div>
        ) : null}

        {phase === "results" && report ? (
          <ExamResults report={report} onRestart={startExam} />
        ) : null}
      </Page>
    </Shell>
  );
}

function ExamResults({ report, onRestart }: { report: ExamReport; onRestart: () => void }) {
  const total = report.total;
  const answered = Math.min(report.answered, total);
  const correct = report.correct;
  const percent = total > 0 ? Math.round((correct / total) * 100) : 0;
  const passed = total > 0 && correct / total >= EXAM_PASS_RATIO;
  const missed = Math.max(0, total - answered);

  return (
    <section className="optimus-card mt-6 p-6">
      <p className="text-center text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
        Rapport d’épreuve
      </p>
      <div className="mt-3 flex flex-col items-center">
        <span
          className={cn(
            "flex size-12 items-center justify-center rounded-[var(--radius-md)]",
            passed ? "bg-primary-soft text-primary" : "bg-danger/15 text-danger",
          )}
        >
          {passed ? <Trophy className="size-6" /> : <RotateCcw className="size-6" />}
        </span>
        <h2 className="mt-3 font-display text-2xl font-medium tracking-tight">
          {report.timedOut ? "Temps écoulé" : passed ? "Épreuve réussie" : "Épreuve terminée"}
        </h2>
        <p className="mt-2 font-display text-4xl font-medium tabular-nums">
          {correct}/{total}
        </p>
        <p className="mt-1 text-sm text-muted">
          {percent} % de bonnes réponses — seuil de réussite : {Math.round(EXAM_PASS_RATIO * 100)} %
        </p>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-2">
        <Metric label="Temps" value={formatClock(report.secondsUsed)} />
        <Metric label="Répondues" value={`${answered}/${total}`} />
        <Metric label="XP gagnés" value={`+${report.xpEarned}`} accent />
      </div>

      {report.timedOut && missed > 0 ? (
        <p className="mt-4 rounded-[var(--radius-lg)] bg-warn/10 px-4 py-3 text-sm leading-relaxed text-fg">
          L’épreuve s’est arrêtée à l’expiration du temps : {missed} question
          {missed > 1 ? "s" : ""} non traitée{missed > 1 ? "s" : ""} comptée
          {missed > 1 ? "s" : ""} comme fausse{missed > 1 ? "s" : ""}.
        </p>
      ) : null}

      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <Button onClick={onRestart} className="w-full bg-bg text-fg hover:bg-bg/90 sm:w-auto">
          <RotateCcw className="size-4" />
          Refaire une épreuve
        </Button>
        <Link
          to="/"
          className={buttonVariants({ variant: "secondary", className: "w-full sm:w-auto" })}
        >
          Retour à l’accueil
        </Link>
      </div>

      <p className="mt-4 text-xs leading-relaxed text-muted">
        Astuce : pour retravailler une faiblesse précise, ouvrez la bibliothèque et filtrez par
        compétence.
      </p>
    </section>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="optimus-card px-3 py-3 text-center">
      <p
        className={`truncate font-display text-xl font-medium tabular-nums ${accent ? "text-primary" : "text-fg"}`}
      >
        {value}
      </p>
      <p className="mt-0.5 truncate text-[11px] font-medium uppercase tracking-wider text-muted">
        {label}
      </p>
    </div>
  );
}
