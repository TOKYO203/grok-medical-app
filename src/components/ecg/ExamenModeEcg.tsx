/**
 * Mode examen — ECG
 * ──────────────
 * Lecture à l'aveugle : un tracé 12 dérivations est affiché SANS titre, SANS
 * badge de rythme, SANS panneau d'analyse — l'étudiant identifie le
 * diagnostic parmi 4 propositions. Le diagnostic et le rythme ne sont
 * révélés qu'après la validation, avec le rappel pédagogique de la fiche.
 *
 * Complète le triptyque « entraînement mesurable » :
 * auto-évaluation histologie (#341), score A→H imagerie (#343),
 * quiz d'oreille auscultation (#348) — quiz d'œil ECG (cette PR).
 *
 * Aucun signal supplémentaire : le tracé passe par EcgMonitor et le moteur
 * de déformation existant (buildDeformation, partagé avec la page d'un cas).
 */
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, GraduationCap, RotateCcw, Trophy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EcgMonitor } from "@/components/ecg/EcgMonitor";
import { getEcg, listEcg } from "@/lib/ecg/catalog";
import { buildDeformation } from "@/lib/ecg/build-deformation";
import { cn } from "@/lib/utils";

const QUESTIONS_PER_SESSION = 10;

type Entry = ReturnType<typeof listEcg>[number];

/** Tire une session : 10 cas au hasard parmi les 23 fiches. */
function buildSession(): Entry[] {
  return [...listEcg()].sort(() => Math.random() - 0.5).slice(0, QUESTIONS_PER_SESSION);
}

/** 4 options : le bon diagnostic + 3 distracteurs pris dans la session. */
function buildOptions(q: Entry, all: Entry[]): string[] {
  const distract = all
    .filter((x) => x.id !== q.id)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3)
    .map((x) => x.title);
  return [q.title, ...distract].sort(() => Math.random() - 0.5);
}

export function ExamenModeEcg() {
  const [started, setStarted] = useState(false);
  const [session, setSession] = useState<Entry[]>([]);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState<string | null>(null);
  const [validated, setValidated] = useState(false);
  const [results, setResults] = useState<boolean[]>([]);

  const entry = session[index];
  const done = started && index >= session.length;
  const score = results.filter(Boolean).length;
  // La fiche complète (trace, son, déformation) — chargée côté client,
  // jamais affichée avant la validation : c'est toute la valeur du mode.
  // entryId extrait : la fiche ne se recharge qu'au changement de cas, et
  // le memo ne dépend que d'un scalaire (react-hooks/exhaustive-deps OK).
  const entryId = entry?.id;
  const fiche = useMemo(() => (entryId ? getEcg(entryId) : undefined), [entryId]);
  const deformation = useMemo(
    () => (fiche ? buildDeformation(fiche) : undefined),
    [fiche],
  );

  const options = useMemo(
    () => (entry ? buildOptions(entry, session) : []),
    [entry, session],
  );

  function start() {
    setSession(buildSession());
    setIndex(0);
    setAnswer(null);
    setValidated(false);
    setResults([]);
    setStarted(true);
  }

  function validate() {
    if (!answer || !entry) return;
    setValidated(true);
    setResults((prev) => {
      const next = [...prev];
      next[index] = answer === entry.title;
      return next;
    });
  }

  function next() {
    if (index >= session.length - 1) {
      setIndex(session.length);
    } else {
      setIndex((i) => i + 1);
      setAnswer(null);
      setValidated(false);
    }
  }

  /* ─── Écran d'accueil du mode examen ─── */
  if (!started) {
    return (
      <div className="optimus-card flex flex-wrap items-center gap-4 p-5">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-secondary text-primary">
          <GraduationCap className="size-6" strokeWidth={1.7} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium">Mode examen — lecture à l'aveugle</p>
          <p className="mt-0.5 text-sm leading-relaxed text-muted">
            {QUESTIONS_PER_SESSION} tracés 12 dérivations, sans titre ni indice de
            rythme : lisez le tracé, identifiez le diagnostic. Score à la clé.
          </p>
        </div>
        <Button onClick={start} className="shrink-0">
          Commencer
        </Button>
      </div>
    );
  }

  /* ─── Écran final ─── */
  if (done) {
    const pct = Math.round((score / session.length) * 100);
    const missed = session.filter((_, i) => results[i] === false);
    return (
      <div className="optimus-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
              Session terminée Œil clinique
            </p>
            <h3 className="mt-1 font-display text-xl font-medium">
              {score} / {session.length} tracés reconnus
            </h3>
            <p className="mt-1 text-sm text-muted">
              {pct === 100
                ? "Œil parfait — bravo !"
                : pct >= 75
                  ? "Très bonne lecture — continuez."
                  : pct >= 50
                    ? "Correct — relisez les fiches manquées."
                    : "À retravailler — reprenez les fiches depuis le début."}
            </p>
          </div>
          <div
            className={cn(
              "flex size-20 shrink-0 flex-col items-center justify-center rounded-full border-4",
              pct >= 75
                ? "border-green-600/70 bg-green-600/10 text-green-700 dark:text-green-400"
                : pct >= 50
                  ? "border-amber-500/70 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                  : "border-red-500/70 bg-red-500/10 text-red-700 dark:text-red-400",
            )}
          >
            <span className="font-display text-xl font-bold leading-none">{pct}%</span>
          </div>
        </div>
        {missed.length > 0 ? (
          <div className="mt-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
              À revoir
            </p>
            <ul className="mt-2 space-y-1.5">
              {missed.map((m) => (
                <li key={m.id}>
                  <Link
                    to="/ecg/$id"
                    params={{ id: m.id }}
                    className="text-sm text-primary underline-offset-2 hover:underline"
                  >
                    {m.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={start}>
            <RotateCcw className="mr-1.5 size-4" aria-hidden />
            Refaire une session
          </Button>
          <Button variant="secondary" onClick={() => setStarted(false)}>
            Quitter le mode examen
          </Button>
        </div>
      </div>
    );
  }

  /* ─── Question en cours ─── */
  const isCorrect = validated && answer === entry.title;
  const isLast = index === session.length - 1;

  return (
    <div className="optimus-card p-5" data-examen-ecg-question={index + 1}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
          Mode examen · Tracé {index + 1} / {session.length}
        </p>
        <div className="flex items-center gap-1.5">
          {session.map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 w-3 rounded-full transition-colors",
                results[i] === true && "bg-green-600",
                results[i] === false && "bg-red-500",
                results[i] === undefined && i === index && "bg-primary",
                results[i] === undefined && i !== index && "bg-border",
              )}
            />
          ))}
          <span className="ml-1.5 inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold">
            <Trophy className="size-3 text-primary" aria-hidden />
            {score}
          </span>
        </div>
      </div>

      <p className="mt-3 text-sm text-muted">
        Lisez le tracé ci-dessous (12 dérivations + pléthysmogramme), puis
        identifiez le diagnostic :
      </p>

      <div className="mt-3">
        <EcgMonitor
          bpm={fiche?.trace?.bpm ?? 75}
          soundType={fiche?.sound ?? "bip_normal"}
          deformation={deformation}
          autoStart
        />
      </div>

      <div className="mt-4 space-y-2">
        {options.map((opt) => {
          const selected = answer === opt;
          const correct = validated && opt === entry.title;
          const wrong = validated && selected && opt !== entry.title;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => !validated && setAnswer(opt)}
              disabled={validated}
              className={cn(
                "w-full rounded-[var(--radius-md)] border p-3 text-left text-sm transition-colors",
                correct && "border-green-500 bg-green-500/10",
                wrong && "border-red-500 bg-red-500/10",
                !validated && selected && "border-primary bg-primary-soft",
                !validated && !selected && "border-border bg-card hover:bg-secondary",
                validated && !correct && !wrong && "border-border opacity-60",
              )}
            >
              {opt}
            </button>
          );
        })}
      </div>

      {validated ? (
        <div
          className={cn(
            "mt-4 rounded-[var(--radius-md)] p-3 text-sm",
            isCorrect
              ? "bg-green-500/10 text-green-700 dark:text-green-400"
              : "bg-red-500/10 text-red-700 dark:text-red-400",
          )}
        >
          <div className="flex flex-wrap items-center gap-2 font-medium">
            {isCorrect ? <Check className="size-4" /> : <X className="size-4" />}
            {isCorrect ? "Bonne réponse" : `Réponse incorrecte — c'était : ${entry.title}`}
            <span className="rounded-full bg-[#A67C1E]/20 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-[#E8C97A] ring-1 ring-[#A67C1E]/40">
              {entry.rhythm}
            </span>
          </div>
          {fiche?.steps?.[0]?.explanation ? (
            <p className="mt-2 text-fg">{fiche.steps[0].explanation}</p>
          ) : null}
          <Link
            to="/ecg/$id"
            params={{ id: entry.id }}
            className="mt-2 inline-block text-sm text-primary underline-offset-2 hover:underline"
          >
            Ouvrir la fiche complète →
          </Link>
        </div>
      ) : null}

      <div className="mt-4">
        {!validated ? (
          <Button onClick={validate} disabled={!answer} className="w-full">
            Valider
          </Button>
        ) : (
          <Button onClick={next} className="w-full">
            {isLast ? "Voir le score" : "Tracé suivant"}
          </Button>
        )}
      </div>
    </div>
  );
}
