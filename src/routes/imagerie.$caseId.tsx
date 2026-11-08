import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, BookOpen, Check, RotateCcw, Trophy, X } from "lucide-react";
import { RadioViewer } from "@/components/imagerie/radio-viewer";
import { Button } from "@/components/ui/button";
import type { ImagingCase } from "@/content/imagerie";
import cxr001 from "@/content/data/imagerie/cxr-001.json";
import cxr002 from "@/content/data/imagerie/cxr-002.json";
import cxr003 from "@/content/data/imagerie/cxr-003.json";
import cxr004 from "@/content/data/imagerie/cxr-004.json";
import cxr005 from "@/content/data/imagerie/cxr-005.json";

const CASES: Record<string, ImagingCase> = {
  [cxr001.id]: cxr001 as ImagingCase,
  [cxr002.id]: cxr002 as ImagingCase,
  [cxr003.id]: cxr003 as ImagingCase,
  [cxr004.id]: cxr004 as ImagingCase,
  [cxr005.id]: cxr005 as ImagingCase,
};

export const Route = createFileRoute("/imagerie/$caseId")({
  component: ImagerieCasePage,
});

function ImagerieCasePage() {
  const { caseId } = Route.useParams();
  const c = CASES[caseId];
  const [stepIndex, setStepIndex] = useState(0);
  const [answer, setAnswer] = useState<number | null>(null);
  const [validated, setValidated] = useState(false);
  /** true = bonne réponse, false = erreur ; une entrée par étape déjà validée. */
  const [results, setResults] = useState<boolean[]>([]);

  if (!c) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-6">
        <p className="text-sm text-muted">Cas introuvable.</p>
        <Link to="/imagerie" className="mt-4 inline-block text-primary underline">
          Retour à la liste
        </Link>
      </main>
    );
  }

  const done = stepIndex >= c.steps.length;
  const step = done ? null : c.steps[stepIndex];
  const isCorrect = step !== null && validated && answer === step.correctIndex;
  const isLast = stepIndex === c.steps.length - 1;
  const score = results.filter(Boolean).length;
  const total = c.steps.length;

  function handleValidate() {
    if (answer === null || step === null) return;
    setValidated(true);
    setResults((prev) => {
      const next = [...prev];
      next[stepIndex] = answer === step.correctIndex;
      return next;
    });
  }

  function handleNext() {
    if (!validated) return;
    if (isLast) {
      setStepIndex(c.steps.length);
    } else {
      setStepIndex(stepIndex + 1);
      setAnswer(null);
      setValidated(false);
    }
  }

  function handleRestart() {
    setStepIndex(0);
    setAnswer(null);
    setValidated(false);
    setResults([]);
  }

  const scorePercent = Math.round((score / total) * 100);
  const scoreMessage =
    scorePercent === 100
      ? "Parfait — lecture méthodique maîtrisée !"
      : scorePercent >= 75
        ? "Très bien — encore un ou deux points à consolider."
        : scorePercent >= 50
          ? "Correct — revois les étapes en rouge avant l'examen."
          : "À retravailler — refais le cas en te concentrant sur la méthode A→H.";

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      {/* ── Header : fil d'Ariane + titre + bouton Recommencer toujours visible ── */}
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-muted">
        <Link to="/imagerie" className="inline-flex items-center gap-1 hover:text-primary">
          <ArrowLeft className="size-4" /> Tous les cas
        </Link>
        <span>·</span>
        <span className="font-medium text-foreground">{c.title}</span>
        <span className="ml-auto">
          <button
            type="button"
            onClick={handleRestart}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-secondary px-3 py-1.5 text-xs font-medium transition-colors hover:bg-primary-soft"
          >
            <RotateCcw className="size-3.5" aria-hidden />
            Recommencer
          </button>
        </span>
      </div>

      {/* ── Barre de progression A → H ── */}
      <div className="mb-4 rounded-[var(--radius-md)] bg-card p-3 shadow-[var(--shadow-border)]">
        <div className="flex items-center gap-2">
          <div className="flex flex-1 items-center gap-1.5">
            {c.steps.map((s, i) => {
              const r = results[i];
              const isCurrent = i === stepIndex && !done;
              return (
                <div key={i} className="flex flex-1 items-center gap-1.5">
                  <div
                    title={`${s.step} — ${s.letter}`}
                    className={[
                      "flex size-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold transition-colors",
                      r === true
                        ? "border-green-600 bg-green-600/15 text-green-700 dark:text-green-400"
                        : "",
                      r === false
                        ? "border-red-500 bg-red-500/15 text-red-700 dark:text-red-400"
                        : "",
                      r === undefined && isCurrent
                        ? "border-primary bg-primary text-primary-fg"
                        : "",
                      r === undefined && !isCurrent && i < stepIndex
                        ? "border-border bg-secondary text-muted"
                        : "",
                      r === undefined && i > stepIndex
                        ? "border-border text-muted opacity-50"
                        : "",
                    ].join(" ")}
                  >
                    {s.step}
                  </div>
                  {i < c.steps.length - 1 && (
                    <div
                      className={[
                        "h-0.5 flex-1 rounded-full transition-colors",
                        i < stepIndex ? "bg-green-600/50" : "bg-border",
                      ].join(" ")}
                    />
                  )}
                </div>
              );
            })}
          </div>
          {/* Score live */}
          <div className="ml-2 flex shrink-0 items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-semibold">
            <Trophy className="size-3.5 text-primary" aria-hidden />
            {score} / {total}
          </div>
        </div>
      </div>

      <p className="mb-3 text-sm leading-relaxed text-muted">{c.clinical}</p>

      {done ? (
        /* ── Écran final ── */
        <div className="rounded-[var(--radius-xl)] bg-card p-6 shadow-[var(--shadow-border)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
                Cas terminé · Diagnostic final
              </p>
              <h1 className="mt-1 font-display text-2xl font-medium">{c.finalDiagnosis}</h1>
            </div>
            <div
              className={[
                "flex size-20 shrink-0 flex-col items-center justify-center rounded-full border-4",
                scorePercent >= 75
                  ? "border-green-600/70 bg-green-600/10 text-green-700 dark:text-green-400"
                  : scorePercent >= 50
                    ? "border-amber-500/70 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                    : "border-red-500/70 bg-red-500/10 text-red-700 dark:text-red-400",
              ].join(" ")}
            >
              <span className="font-display text-xl font-bold leading-none">{score}/{total}</span>
              <span className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">
                {scorePercent}%
              </span>
            </div>
          </div>

          <p className="mt-3 text-sm text-muted">{scoreMessage}</p>

          <h2 className="mt-6 font-medium">Signes clés à retenir</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
            {c.keyFindings.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>

          {c.linkedPathology ? (
            <Link
              to="/pathologie/$slug"
              params={{ slug: c.linkedPathology }}
              className="mt-6 inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-primary px-4 py-2.5 text-sm font-medium text-primary-fg transition-opacity hover:opacity-90"
            >
              <BookOpen className="size-4" aria-hidden />
              Voir la fiche : {c.finalDiagnosis}
            </Link>
          ) : null}

          <div className="mt-8 flex flex-wrap gap-2">
            <Button onClick={handleRestart}>
              <RotateCcw className="mr-1.5 size-4" aria-hidden />
              Refaire ce cas
            </Button>
            <Link
              to="/imagerie"
              className="inline-flex items-center rounded-[var(--radius-md)] bg-secondary px-4 py-2 text-sm font-medium"
            >
              Retour à la liste
            </Link>
          </div>
        </div>
      ) : (
        <>
          <RadioViewer src={c.imageUrl} alt={c.imageAlt} highlight={step!.highlight} />

          <div className="mt-6 rounded-[var(--radius-xl)] bg-card p-4 shadow-[var(--shadow-border)]">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
              Étape {stepIndex + 1} / {c.steps.length} · {step!.step} — {step!.letter}
            </p>
            <h2 className="mt-2 font-medium">{step!.question}</h2>

            <div className="mt-3 space-y-2">
              {step!.options.map((opt, i) => {
                const selected = answer === i;
                const correct = validated && i === step!.correctIndex;
                const wrong = validated && selected && i !== step!.correctIndex;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => !validated && setAnswer(i)}
                    disabled={validated}
                    className={[
                      "w-full rounded-[var(--radius-md)] border p-3 text-left text-sm transition-colors",
                      correct ? "border-green-500 bg-green-500/10" : "",
                      wrong ? "border-red-500 bg-red-500/10" : "",
                      !validated && selected ? "border-primary bg-primary-soft" : "",
                      !validated && !selected ? "border-border bg-card hover:bg-secondary" : "",
                      validated && !correct && !wrong ? "border-border opacity-60" : "",
                    ].join(" ")}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>

            {validated ? (
              <div
                className={`mt-4 rounded-[var(--radius-md)] p-3 text-sm ${isCorrect ? "bg-green-500/10 text-green-700 dark:text-green-400" : "bg-red-500/10 text-red-700 dark:text-red-400"}`}
              >
                <div className="flex items-center gap-2 font-medium">
                  {isCorrect ? <Check className="size-4" /> : <X className="size-4" />}
                  {isCorrect ? "Bonne réponse" : "Réponse incorrecte"}
                </div>
                <p className="mt-2 text-foreground">{step!.explanation}</p>
              </div>
            ) : null}

            <div className="mt-4">
              {!validated ? (
                <Button onClick={handleValidate} disabled={answer === null} className="w-full">
                  Valider
                </Button>
              ) : (
                <Button onClick={handleNext} className="w-full">
                  {isLast ? "Voir le diagnostic" : "Étape suivante"}
                </Button>
              )}
            </div>
          </div>
        </>
      )}
    </main>
  );
}
