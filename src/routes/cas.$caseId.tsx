import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Check, X } from "lucide-react";
import { SourcesList } from "@/components/quiz-player";
import { Page, Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { getCase } from "@/content/catalog";
import { caseXp } from "@/core/quiz-engine";
import { useOptimus } from "@/state/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/cas/$caseId")({ component: CasePlay });

function CasePlay() {
  const { caseId } = Route.useParams();
  const clinical = getCase(caseId);
  const navigate = useNavigate();
  const completeCase = useOptimus((s) => s.completeCase);
  const [cursor, setCursor] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);
  const [asked, setAsked] = useState(0);

  const qCount = useMemo(
    () => clinical?.steps.filter((s) => s.kind === "question").length ?? 0,
    [clinical],
  );

  if (!clinical) {
    return (
      <Shell>
        <Page>
          <p className="text-sm text-muted">Cas introuvable.</p>
        </Page>
      </Shell>
    );
  }

  const step = clinical.steps[cursor];
  const finished = cursor >= clinical.steps.length;

  return (
    <Shell title={clinical.title}>
      <Page className="mx-auto max-w-lg">
        <Link to="/cas" className="inline-flex items-center gap-2 text-sm text-muted hover:text-fg">
          <ArrowLeft className="size-4" />
          Cas
        </Link>
        <p className="mt-4 text-[11px] font-medium uppercase tracking-[0.16em] text-muted">{clinical.specialty}</p>
        <h1 className="mt-1 font-display text-3xl font-medium tracking-tight">{clinical.title}</h1>
        <p className="mt-2 text-sm text-muted">
          {clinical.patient.sex === "F" ? "Femme" : "Homme"}, {clinical.patient.age} ans — {clinical.patient.context}
        </p>

        {finished ? (
          <div className="mt-8">
            <p className="text-sm text-muted">
              {correct}/{qCount} décisions justes
            </p>
            <h2 className="mt-4 font-display text-xl font-medium">Diagnostic</h2>
            <p className="mt-2 text-sm leading-relaxed">{clinical.diagnosis}</p>
            <h2 className="mt-6 font-display text-xl font-medium">Prise en charge</h2>
            <p className="mt-2 text-sm leading-relaxed">{clinical.management}</p>
            <SourcesList sources={clinical.sources} />
            <Button
              className="mt-6 w-full"
              onClick={() => {
                completeCase(clinical.id, caseXp(correct, qCount));
                void navigate({ to: "/cas" });
              }}
            >
              Enregistrer le cas
            </Button>
          </div>
        ) : step?.kind === "reveal" ? (
          <div className="mt-8 rounded-[var(--radius-xl)] bg-card p-5 shadow-[var(--shadow-border)]">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">{step.title}</p>
            <p className="mt-3 text-sm leading-relaxed">{step.body}</p>
            <Button className="mt-5 w-full" onClick={() => setCursor((c) => c + 1)}>
              Continuer
            </Button>
          </div>
        ) : step?.kind === "question" ? (
          <div className="mt-8">
            <p className="font-display text-xl font-medium leading-snug">{step.prompt}</p>
            <ul className="mt-4 space-y-2">
              {step.choices.map((choice, i) => {
                const revealed = picked !== null;
                const isCorrect = i === step.correct;
                const isPicked = i === picked;
                return (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => {
                        if (picked !== null) return;
                        setPicked(i);
                        setAsked((n) => n + 1);
                        if (i === step.correct) setCorrect((n) => n + 1);
                      }}
                      className={cn(
                        "flex min-h-14 w-full items-start gap-3 rounded-[var(--radius-lg)] px-4 py-3 text-left text-sm shadow-[var(--shadow-border)]",
                        !revealed && "bg-card hover:bg-surface",
                        revealed && isCorrect && "bg-primary-soft",
                        revealed && isPicked && !isCorrect && "bg-danger/15",
                        revealed && !isCorrect && !isPicked && "bg-card opacity-60",
                      )}
                    >
                      <span className="font-mono text-xs text-muted">{String.fromCharCode(65 + i)}</span>
                      <span className="flex-1">{choice}</span>
                      {revealed && isCorrect ? <Check className="size-4 text-primary" /> : null}
                      {revealed && isPicked && !isCorrect ? <X className="size-4 text-danger" /> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
            {picked !== null ? (
              <div className="mt-4 rounded-[var(--radius-lg)] bg-card p-4 shadow-[var(--shadow-border)]">
                <p className="text-sm leading-relaxed">{step.explanation}</p>
                <Button
                  className="mt-4 w-full"
                  onClick={() => {
                    setPicked(null);
                    setCursor((c) => c + 1);
                  }}
                >
                  Continuer
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
        <p className="mt-6 text-center font-mono text-xs tabular-nums text-subtle">
          {Math.min(cursor + 1, clinical.steps.length)}/{clinical.steps.length}
          {asked ? ` · ${correct}/${asked}` : ""}
        </p>
      </Page>
    </Shell>
  );
}
