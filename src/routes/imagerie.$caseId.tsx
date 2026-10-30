import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Check, X } from "lucide-react";
import { RadioViewer } from "@/components/imagerie/radio-viewer";
import { Button } from "@/components/ui/button";
import type { ImagingCase } from "@/content/imagerie";
import cxr001 from "@/content/data/imagerie/cxr-001.json";

const CASES: Record<string, ImagingCase> = {
  [cxr001.id]: cxr001 as ImagingCase,
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

  const step = c.steps[stepIndex];
  const isCorrect = validated && answer === step.correctIndex;
  const isWrong = validated && answer !== step.correctIndex;
  const isLast = stepIndex === c.steps.length - 1;

  function handleValidate() {
    if (answer === null) return;
    setValidated(true);
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
  }

  if (stepIndex >= c.steps.length) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="font-display text-2xl font-medium">Cas terminé</h1>
        <p className="mt-2 text-sm text-muted">Diagnostic final</p>
        <p className="mt-1 font-display text-xl">{c.finalDiagnosis}</p>

        <h2 className="mt-6 font-medium">Signes clés à retenir</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
          {c.keyFindings.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>

        <div className="mt-8 flex flex-wrap gap-2">
          <Button onClick={handleRestart}>Refaire ce cas</Button>
          <Link to="/imagerie" className="inline-flex items-center rounded-[var(--radius-md)] bg-secondary px-4 py-2 text-sm font-medium">
            Retour à la liste
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-4 flex items-center gap-2 text-sm text-muted">
        <Link to="/imagerie" className="inline-flex items-center gap-1 hover:text-primary">
          <ArrowLeft className="size-4" /> Tous les cas
        </Link>
        <span>·</span>
        <span>{c.title}</span>
      </div>

      <p className="mb-3 text-sm leading-relaxed text-muted">{c.clinical}</p>

      <RadioViewer src={c.imageUrl} alt={c.imageAlt} highlight={step.highlight} />

      <div className="mt-6 rounded-[var(--radius-xl)] bg-card p-4 shadow-[var(--shadow-border)]">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
          Étape {stepIndex + 1} / {c.steps.length} · {step.step} — {step.letter}
        </p>
        <h2 className="mt-2 font-medium">{step.question}</h2>

        <div className="mt-3 space-y-2">
          {step.options.map((opt, i) => {
            const selected = answer === i;
            const correct = validated && i === step.correctIndex;
            const wrong = validated && selected && i !== step.correctIndex;
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
          <div className={`mt-4 rounded-[var(--radius-md)] p-3 text-sm ${isCorrect ? "bg-green-500/10 text-green-700 dark:text-green-400" : "bg-red-500/10 text-red-700 dark:text-red-400"}`}>
            <div className="flex items-center gap-2 font-medium">
              {isCorrect ? <Check className="size-4" /> : <X className="size-4" />}
              {isCorrect ? "Bonne réponse" : "Réponse incorrecte"}
            </div>
            <p className="mt-2 text-foreground">{step.explanation}</p>
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
    </main>
  );
}
