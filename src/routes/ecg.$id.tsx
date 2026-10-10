import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import { Page, Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { getEcg } from "@/lib/ecg/catalog";
import { EcgMonitor } from "@/components/ecg/EcgMonitor";
import { cn } from "@/lib/utils";

function EcgAnnotations({ step, annotations }: { step: number; annotations?: Array<{ id: string; revealAtStep: number; type: string; label: string; tone: string; coords: Record<string, number> }> }) {
  if (!annotations || annotations.length === 0) return null;
  const visible = annotations.filter((a) => a.revealAtStep <= step + 1);
  if (visible.length === 0) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {visible.map((a) => {
        const left = (a.coords.x / 1200) * 100;
        const top = (a.coords.y / 400) * 100;
        const cls = a.tone === "warning" ? "border-danger/60 bg-danger/15 text-danger" : a.tone === "info" ? "border-amber-500/60 bg-amber-500/15 text-amber-300" : "border-emerald-500/60 bg-emerald-500/15 text-emerald-300";
        return (
          <div
            key={a.id}
            className={"absolute -translate-x-1/2 -translate-y-1/2 rounded-full border px-2 py-0.5 text-[10px] font-medium backdrop-blur " + cls}
            style={{ left: left + "%", top: top + "%" }}
          >
            {a.label}
          </div>
        );
      })}
      <div className="absolute right-3 top-2 rounded-full bg-black/60 px-2 py-0.5 font-mono text-[10px] text-white/80">
        {visible.length}/{annotations.length} annotations
      </div>
    </div>
  );
}


export const Route = createFileRoute("/ecg/$id")({ component: EcgCasePage });

function EcgCasePage() {
  const { id } = Route.useParams();
  const ecg = getEcg(id);
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);

  if (!ecg) {
    return (
      <Shell title="ECG">
        <Page className="mx-auto max-w-2xl">
          <p className="text-sm text-muted">Cas ECG introuvable.</p>
          <Link to="/ecg" className="mt-4 inline-block text-sm text-primary">← Retour</Link>
        </Page>
      </Shell>
    );
  }

  const data = ecg;
  const current = data.steps[step];
  const revealed = picked !== null;
  const ok = picked === current?.correct;

  function choose(i: number) {
    if (revealed) return;
    setPicked(i);
    if (i === current.correct) setCorrect((n) => n + 1);
  }
  function next() {
    if (step < data.steps.length - 1) { setStep(step + 1); setPicked(null); }
    else navigate({ to: "/ecg" });
  }

  return (
    <Shell title="ECG">
      <Page className="mx-auto max-w-3xl">
        <button onClick={() => navigate({ to: "/ecg" })}
          className="mb-3 inline-flex items-center gap-1 text-xs text-muted hover:text-fg">
          <ArrowLeft className="size-3.5" /> Bibliothèque ECG
        </button>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-xl font-medium tracking-tight">{data.title}</h1>
            <p className="mt-0.5 text-xs text-muted">{data.rhythm} · étape {step + 1}/{data.steps.length}</p>
          </div>
          <span className="font-mono text-xs tabular-nums text-subtle">{correct}/{data.steps.length}</span>
        </div>

        
        {/* Timeline des étapes */}
        <div className="mb-3 flex items-center gap-1.5 overflow-x-auto pb-1">
          {data.steps.map((st, i) => {
            const stDone = i < step;
            const stCurrent = i === step;
            return (
              <button
                key={i}
                type="button"
                onClick={() => { setStep(i); setPicked(null); }}
                className={"flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors " + (stCurrent ? "bg-primary text-primary-fg shadow-[var(--shadow-soft)]" : stDone ? "bg-primary-soft text-primary" : "bg-secondary text-muted hover:text-fg")}
              >
                <span className="font-mono">{i + 1}</span>
                <span className="hidden sm:inline">{st.title}</span>
              </button>
            );
          })}
        </div>

        <div className="relative">
          <EcgMonitor bpm={data.trace?.bpm ?? 75} label="II" secondsWindow={4} autoStart />
          <EcgAnnotations step={step} annotations={data.annotations as never} />
        </div>

        <div className="mt-5 rounded-[var(--radius-lg)] bg-card p-5 shadow-[var(--shadow-border)]">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">{current.title}</p>
          <h2 className="mt-1 font-display text-lg font-medium leading-snug">{current.question}</h2>
          <ul className="mt-4 space-y-2">
            {current.choices.map((c, i) => {
              const isCorrect = i === current.correct;
              const isPicked = i === picked;
              return (
                <li key={i}>
                  <button type="button" disabled={revealed} onClick={() => choose(i)}
                    className={cn(
                      "flex min-h-12 w-full items-start gap-3 rounded-[var(--radius-md)] px-4 py-3 text-left text-sm shadow-[var(--shadow-border)] transition-colors disabled:cursor-default",
                      !revealed && "bg-card hover:bg-secondary",
                      revealed && isCorrect && "bg-primary-soft",
                      revealed && isPicked && !isCorrect && "bg-danger/15",
                      revealed && !isCorrect && !isPicked && "opacity-60",
                    )}>
                    <span className="mt-0.5 font-mono text-xs text-muted">{String.fromCharCode(65 + i)}</span>
                    <span className="flex-1">{c}</span>
                    {revealed && isCorrect ? <Check className="size-4 text-primary" /> : null}
                    {revealed && isPicked && !isCorrect ? <X className="size-4 text-danger" /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
          {revealed ? (
            <div className="mt-4 rounded-[var(--radius-md)] bg-secondary p-4">
              <p className={cn("text-sm font-medium", ok ? "text-primary" : "text-danger")}>
                {ok ? "Correct" : "Incorrect"}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-fg">{current.explanation}</p>
              <Button className="mt-4 w-full" onClick={next}>
                {step === data.steps.length - 1 ? "Terminer" : "Étape suivante"} <ArrowRight className="size-4" />
              </Button>
            </div>
          ) : null}
        </div>
      </Page>
    </Shell>
  );
}
