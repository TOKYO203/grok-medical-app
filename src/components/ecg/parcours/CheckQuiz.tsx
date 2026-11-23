import { useState } from "react";
import type { CheckQuizQuestion } from "@/lib/ecg/parcours/types";

interface Props {
  questions: CheckQuizQuestion[];
  onComplete: (scorePct: number) => void;
}

export function CheckQuiz({ questions, onComplete }: Props) {
  const [answers, setAnswers] = useState<(number | null)[]>(questions.map(() => null));
  const [revealed, setRevealed] = useState(false);

  const allAnswered = answers.every((a) => a !== null);
  const score = answers.filter((a, i) => a === questions[i].correct).length;
  const pct = questions.length === 0 ? 0 : Math.round((score / questions.length) * 100);

  function select(qi: number, ci: number) {
    if (revealed) return;
    setAnswers((prev) => prev.map((a, i) => (i === qi ? ci : a)));
  }

  function validate() {
    setRevealed(true);
    onComplete(pct);
  }

  return (
    <div className="space-y-4 rounded-xl border border-default p-4">
      <h3 className="font-semibold">Vérifions votre compréhension</h3>
      {questions.map((q, qi) => (
        <div key={qi} className="space-y-2">
          <p className="text-sm font-medium">{qi + 1}. {q.question}</p>
          <div className="space-y-1">
            {q.choices.map((choice, ci) => {
              const selected = answers[qi] === ci;
              const isCorrect = revealed && ci === q.correct;
              const isWrong = revealed && selected && ci !== q.correct;
              return (
                <button
                  key={ci}
                  type="button"
                  onClick={() => select(qi, ci)}
                  disabled={revealed}
                  className={`block w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                    isCorrect ? "border-emerald-500 bg-emerald-50"
                      : isWrong ? "border-red-500 bg-red-50"
                      : selected ? "border-blue-500 bg-blue-50"
                      : "border-default hover:border-strong"
                  }`}
                >
                  {choice}
                </button>
              );
            })}
          </div>
          {revealed && (
            <p className="text-xs text-subtle">
              <strong>Explication :</strong> {q.explanation}
            </p>
          )}
        </div>
      ))}
      {!revealed ? (
        <button
          type="button"
          onClick={validate}
          disabled={!allAnswered}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Valider
        </button>
      ) : (
        <div className="rounded-lg bg-muted p-3 text-sm">
          <strong>Score : {score}/{questions.length} ({pct}%)</strong>
          {pct >= 70
            ? <p className="mt-1 text-emerald-700">✅ Leçon validée.</p>
            : <p className="mt-1 text-amber-700">⚠️ Relisez la leçon et réessayez (seuil 70%).</p>}
        </div>
      )}
    </div>
  );
}
