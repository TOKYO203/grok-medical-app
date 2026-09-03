import { useState } from "react";
import { GOALS, YEARS } from "@/content/catalog";
import { MadagascarMark, Wordmark } from "@/components/brand/marks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useOptimus } from "@/state/store";

const SUBJECTS = ["Cardiologie", "Neurologie", "Infectiologie", "Urgences", "Sémiologie", "Pharmacologie"];

export function Onboarding() {
  const complete = useOptimus((s) => s.completeOnboarding);
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [year, setYear] = useState(5);
  const [goal, setGoal] = useState("edn");
  const [subjects, setSubjects] = useState<string[]>(["Cardiologie"]);

  function toggle(sub: string) {
    setSubjects((cur) => (cur.includes(sub) ? cur.filter((s) => s !== sub) : [...cur, sub].slice(0, 3)));
  }

  function finish() {
    complete({
      displayName: name.trim() || "Invité",
      studyYear: year,
      goal,
      prioritySubjects: subjects,
      onboarded: true,
    });
  }

  return (
    <div className="flex min-h-dvh flex-col bg-bg px-5 py-8 text-fg">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <Wordmark />
        {step === 0 ? (
          <div className="mt-12 flex flex-1 flex-col">
            <MadagascarMark className="mb-6 h-16 w-10 text-primary/80" />
            <h1 className="font-display text-4xl font-medium tracking-tight">
              Apprendre.
              <br />
              Raisonner.
              <br />
              Progresser.
            </h1>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted">
              Coach de formation médicale, hors-ligne d’abord. Pas un simple QCM — un parcours, une Mastery, des cas.
            </p>
            <p className="mt-6 text-xs uppercase tracking-[0.16em] text-subtle">Développé à Madagascar</p>
            <Button className="mt-auto" size="lg" onClick={() => setStep(1)}>
              Commencer
            </Button>
          </div>
        ) : null}
        {step === 1 ? (
          <div className="mt-10 flex flex-1 flex-col">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Année d’étude</p>
            <h2 className="mt-2 font-display text-2xl font-medium tracking-tight">Où en êtes-vous ?</h2>
            <div className="mt-6 grid grid-cols-2 gap-2">
              {YEARS.map((y) => (
                <button
                  key={y.year}
                  type="button"
                  onClick={() => setYear(y.year)}
                  className={`rounded-[var(--radius-lg)] px-3 py-3 text-left shadow-[var(--shadow-border)] ${year === y.year ? "bg-primary-soft" : "bg-card"}`}
                >
                  <p className="text-sm font-medium">{y.label}</p>
                  <p className="mt-1 text-xs text-muted">{y.focus}</p>
                </button>
              ))}
            </div>
            <Button className="mt-auto" onClick={() => setStep(2)}>
              Continuer
            </Button>
          </div>
        ) : null}
        {step === 2 ? (
          <div className="mt-10 flex flex-1 flex-col">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Objectif</p>
            <h2 className="mt-2 font-display text-2xl font-medium tracking-tight">Pourquoi Optimus ?</h2>
            <div className="mt-6 space-y-2">
              {GOALS.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setGoal(g.id)}
                  className={`flex h-12 w-full items-center rounded-[var(--radius-md)] px-4 text-sm shadow-[var(--shadow-border)] ${goal === g.id ? "bg-primary-soft" : "bg-card"}`}
                >
                  {g.label}
                </button>
              ))}
            </div>
            <p className="mt-8 text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Matières prioritaires</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {SUBJECTS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggle(s)}
                  className={`h-10 rounded-full px-4 text-sm shadow-[var(--shadow-border)] ${subjects.includes(s) ? "bg-primary text-primary-fg" : "bg-card text-fg"}`}
                >
                  {s}
                </button>
              ))}
            </div>
            <Button className="mt-auto" onClick={() => setStep(3)}>
              Continuer
            </Button>
          </div>
        ) : null}
        {step === 3 ? (
          <div className="mt-10 flex flex-1 flex-col">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Identité</p>
            <h2 className="mt-2 font-display text-2xl font-medium tracking-tight">Comment vous appeler ?</h2>
            <p className="mt-2 text-sm text-muted">Aucun compte obligatoire. Un Optimus ID sera créé en local.</p>
            <label className="mt-6 text-xs font-medium text-muted" htmlFor="name">
              Nom affiché
            </label>
            <Input
              id="name"
              className="mt-2"
              placeholder="Ex. Fetra"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Button className="mt-auto" size="lg" onClick={finish}>
              Entrer dans Optimus
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
