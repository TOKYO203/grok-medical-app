import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { Question, Source } from "@/core/types";
import { comboBonus } from "@/core/quiz-engine";
import { cn } from "@/lib/utils";

export type QuizItem = {
  question: Question;
  deckTitle?: string;
};

const QUESTION_ARM_DELAY_MS = 500;

export function QuizPlayer({
  items,
  onAnswer,
  onFinish,
  finishLabel = "Terminer",
}: {
  items: QuizItem[];
  onAnswer: (item: QuizItem, ok: boolean, combo: number) => void;
  onFinish: (summary: { correct: number; total: number; maxCombo: number }) => void;
  finishLabel?: string;
}) {
  const [sessionItems] = useState(() => items);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [answerReady, setAnswerReady] = useState(true);
  const answerLocked = useRef(false);
  const advanceLocked = useRef(false);
  const unlockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const item = sessionItems[index];
  const done = index >= sessionItems.length;
  const order = useMemo(() => {
    if (!item) return [];
    return item.question.choices.map((_, i) => i);
  }, [item]);

  useEffect(
    () => () => {
      if (unlockTimer.current) clearTimeout(unlockTimer.current);
    },
    [],
  );

  if (sessionItems.length === 0) {
    return <p className="text-sm text-muted">Aucune question dans cette session.</p>;
  }

  if (done || !item) {
    return (
      <div className="mx-auto max-w-lg py-8 text-center">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Session</p>
        <h2 className="mt-2 font-display text-3xl font-medium tracking-tight">
          {correctCount}/{sessionItems.length}
        </h2>
        <p className="mt-2 text-sm text-muted">
          Combo max {maxCombo}. L’XP mesure l’effort — la Mastery, la compétence.
        </p>
        <Button
          className="mt-6"
          onClick={() => onFinish({ correct: correctCount, total: sessionItems.length, maxCombo })}
        >
          {finishLabel}
        </Button>
      </div>
    );
  }

  const q = item.question;
  const revealed = picked !== null;
  const ok = picked === q.correct;

  function choose(i: number) {
    if (!answerReady || answerLocked.current || picked !== null) return;
    answerLocked.current = true;
    const isOk = i === q.correct;
    setPicked(i);
    const nextCombo = isOk ? combo + 1 : 0;
    setCombo(nextCombo);
    setMaxCombo((m) => Math.max(m, nextCombo));
    if (isOk) setCorrectCount((c) => c + 1);
    onAnswer(item, isOk, nextCombo);
  }

  function next() {
    if (advanceLocked.current) return;
    advanceLocked.current = true;
    answerLocked.current = true;
    setAnswerReady(false);
    setPicked(null);
    setIndex((n) => n + 1);
    unlockTimer.current = setTimeout(() => {
      answerLocked.current = false;
      advanceLocked.current = false;
      setAnswerReady(true);
    }, QUESTION_ARM_DELAY_MS);
  }

  return (
    <div className="mx-auto w-full max-w-lg">
      <div className="mb-5 flex items-center gap-3">
        <Progress value={((index + (revealed ? 1 : 0)) / sessionItems.length) * 100} />
        <span className="shrink-0 font-mono text-xs tabular-nums text-muted">
          {index + 1}/{sessionItems.length}
        </span>
      </div>
      {item.deckTitle ? (
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
          {item.deckTitle}
        </p>
      ) : null}
      <h2 className="font-display text-2xl font-medium leading-snug tracking-tight text-fg">
        {q.prompt}
      </h2>
      <ul className="mt-6 space-y-2">
        {order.map((i) => {
          const choice = q.choices[i];
          const isCorrect = i === q.correct;
          const isPicked = i === picked;
          return (
            <li key={i}>
              <button
                type="button"
                disabled={revealed || !answerReady}
                onClick={() => choose(i)}
                className={cn(
                  "flex min-h-14 w-full items-start gap-3 rounded-[var(--radius-lg)] px-4 py-3 text-left text-sm shadow-[var(--shadow-border)] transition-colors duration-150 disabled:cursor-default",
                  !revealed && "bg-card hover:bg-surface",
                  revealed && isCorrect && "bg-primary-soft text-fg",
                  revealed && isPicked && !isCorrect && "bg-danger/15 text-fg",
                  revealed && !isCorrect && !isPicked && "bg-card opacity-60",
                )}
              >
                <span className="mt-0.5 font-mono text-xs text-muted">
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="flex-1">{choice}</span>
                {revealed && isCorrect ? <Check className="size-4 text-primary" /> : null}
                {revealed && isPicked && !isCorrect ? <X className="size-4 text-danger" /> : null}
              </button>
            </li>
          );
        })}
      </ul>
      {revealed ? (
        <div className="mt-5 rounded-[var(--radius-lg)] bg-card p-4 shadow-[var(--shadow-border)]">
          <p className={cn("text-sm font-medium", ok ? "text-primary" : "text-danger")}>
            {ok
              ? `Juste · combo ${combo} · +${comboBonus(combo)} XP combo`
              : "Incorrect — à revoir bientôt"}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-fg">{q.explanation}</p>
          <SourcesList sources={q.sources} />
          <Button className="mt-4 w-full" onClick={next}>
            {index === sessionItems.length - 1 ? "Voir mes résultats" : "Question suivante"}
            <ArrowRight className="size-4" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function SourcesList({ sources }: { sources: Source[] }) {
  if (!sources.length) return null;
  return (
    <ul className="mt-3 space-y-1">
      {sources.map((s, i) => (
        <li key={`${s.title}-${i}`} className="text-xs leading-relaxed text-muted">
          <span className="font-medium text-fg/80">{s.title}</span>
          {s.year ? ` · ${s.year}` : ""} — {s.citation}
        </li>
      ))}
    </ul>
  );
}
