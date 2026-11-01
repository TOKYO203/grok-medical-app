/**
 * Mode examen — Auscultation
 * ─────────────────────────
 * Écoute à l'aveugle : un son cardiaque ou pulmonaire est joué, l'étudiant
 * identifie le diagnostic parmi 4 propositions, feedback pédagogique,
 * score final. Complète le triptyque « entraînement mesurable » de l'app :
 * auto-évaluation en histologie (#341), score A→H en imagerie (#343),
 * quiz d'oreille en auscultation.
 *
 * Aucune donnée audio : tout passe par le moteur de synthèse existant
 * (playSound / playLungSound), donc offline et sans fichier embarqué.
 */
import { useEffect, useMemo, useState } from "react";
import { Check, GraduationCap, RotateCcw, Square, Trophy, Volume2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getFiche,
  getPulmonaireFiche,
  listFiches,
  listPulmonaireFiches,
} from "@/lib/auscultation/catalog";
import { playLungSound, playSound, stop } from "@/lib/auscultation/engine";

type Question = {
  id: string;
  label: string;
  lung: boolean;
  preset: string;
  params: Record<string, number>;
  /** Explication affichée après la réponse (timing de la fiche). */
  hint: string;
};

const QUESTIONS_PER_SESSION = 10;

/** Tire une session : 5 sons cardiaques + 5 pulmonaires, mélangés. */
function buildSession(): Question[] {
  const cardio = listFiches();
  const pulmo = listPulmonaireFiches();
  const pick = (arr: typeof cardio, n: number, lung: boolean): Question[] =>
    [...arr].sort(() => Math.random() - 0.5).slice(0, n).map((entry) => {
      const fiche = lung ? getPulmonaireFiche(entry.id) : getFiche(entry.id);
      const audio = fiche?.audio;
      const hint = lung
        ? `${fiche?.timing.moment ?? ""} — ${(fiche as { timing?: { caractere?: string } })?.timing?.caractere ?? ""}`
        : (fiche?.timing.description ?? "");
      return {
        id: entry.id,
        label: entry.label,
        lung,
        preset: audio?.preset ?? (lung ? "normal_vesicular" : "normal_s1s2"),
        params: (audio?.params as Record<string, number>) ?? {},
        hint,
      };
    });
  return [...pick(cardio, 5, false), ...pick(pulmo, 5, true)].sort(
    () => Math.random() - 0.5,
  );
}

/** 4 options : la bonne + 3 distracteurs du même module (cardio vs pulmo). */
function buildOptions(q: Question, all: Question[]): string[] {
  const pool = all.filter((x) => x.lung === q.lung && x.id !== q.id);
  const distract = pool.sort(() => Math.random() - 0.5).slice(0, 3).map((x) => x.label);
  return [q.label, ...distract].sort(() => Math.random() - 0.5);
}

export function ExamenMode() {
  const [started, setStarted] = useState(false);
  const [session, setSession] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState<string | null>(null);
  const [validated, setValidated] = useState(false);
  const [results, setResults] = useState<boolean[]>([]);
  const [playing, setPlaying] = useState(false);

  // Coupe tout son au démontage du mode examen (navigation, etc.).
  useEffect(() => () => stop(), []);

  const question = session[index];
  const done = started && index >= session.length;
  const score = results.filter(Boolean).length;

  const options = useMemo(
    () => (question ? buildOptions(question, session) : []),
    // Les options sont stables pour une question donnée : on les calcule
    // au changement de question uniquement (index & identité de session).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [question?.id, session],
  );

  function start() {
    stop();
    setSession(buildSession());
    setIndex(0);
    setAnswer(null);
    setValidated(false);
    setResults([]);
    setStarted(true);
  }

  function replay(q: Question) {
    if (playing) {
      stop();
      setPlaying(false);
      return;
    }
    if (q.lung) playLungSound(q.preset, q.params);
    else playSound(q.preset, q.params);
    setPlaying(true);
  }

  function validate() {
    if (!answer || !question) return;
    setValidated(true);
    stop();
    setPlaying(false);
    setResults((prev) => {
      const next = [...prev];
      next[index] = answer === question.label;
      return next;
    });
  }

  function next() {
    if (index >= session.length - 1) {
      stop();
      setPlaying(false);
      setIndex(session.length);
    } else {
      stop();
      setPlaying(false);
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
          <p className="font-medium">Mode examen</p>
          <p className="mt-0.5 text-sm leading-relaxed text-muted">
            {QUESTIONS_PER_SESSION} sons à l'aveugle (5 cardiaques + 5 pulmonaires) : identifiez
            chaque bruit à l'oreille, sans indice. Score à la clé.
          </p>
        </div>
        <Button onClick={start} className="shrink-0">
          <Volume2 className="mr-1.5 size-4" aria-hidden />
          Commencer
        </Button>
      </div>
    );
  }

  /* ─── Écran final ─── */
  if (done) {
    const pct = Math.round((score / session.length) * 100);
    return (
      <div className="optimus-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
              Session terminée · Oreille clinique
            </p>
            <h3 className="mt-1 font-display text-xl font-medium">
              {score} / {session.length} bruits reconnus
            </h3>
            <p className="mt-1 text-sm text-muted">
              {pct === 100
                ? "Oreille parfaite — bravo !"
                : pct >= 75
                  ? "Très bonne oreille — continuez."
                  : pct >= 50
                    ? "Correct — réécoutez les fiches manquées."
                    : "À retravailler — réécoutez les fiches en boucle."}
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
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={start}>
            <RotateCcw className="mr-1.5 size-4" aria-hidden />
            Refaire une session
          </Button>
          <Button variant="secondary" onClick={() => { setStarted(false); stop(); }}>
            Quitter le mode examen
          </Button>
        </div>
      </div>
    );
  }

  /* ─── Question en cours ─── */
  const isCorrect = validated && answer === question.label;
  const isWrong = validated && answer !== question.label;
  const isLast = index === session.length - 1;

  return (
    <div className="optimus-card p-5" data-examen-question={index + 1}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
          Mode examen · Question {index + 1} / {session.length}
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
        Écoutez le son (boucle jusqu'à l'arrêt), puis identifiez le bruit :
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button onClick={() => replay(question)} aria-pressed={playing}>
          {playing ? (
            <>
              <Square className="size-4" aria-hidden /> Arrêter l'écoute
            </>
          ) : (
            <>
              <Volume2 className="size-4" aria-hidden /> Écouter
            </>
          )}
        </Button>
        <span className="optimus-type-badge bg-secondary text-muted">
          {question.lung ? "Poumon" : "Cœur"}
        </span>
      </div>

      <div className="mt-4 space-y-2">
        {options.map((opt) => {
          const selected = answer === opt;
          const correct = validated && opt === question.label;
          const wrong = validated && selected && opt !== question.label;
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
          <div className="flex items-center gap-2 font-medium">
            {isCorrect ? <Check className="size-4" /> : <X className="size-4" />}
            {isCorrect ? "Bonne réponse" : `Réponse incorrecte — c'était : ${question.label}`}
          </div>
          {question.hint ? (
            <p className="mt-2 text-fg">{question.hint}</p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4">
        {!validated ? (
          <Button onClick={validate} disabled={!answer} className="w-full">
            Valider
          </Button>
        ) : (
          <Button onClick={next} className="w-full">
            {isLast ? "Voir le score" : "Question suivante"}
          </Button>
        )}
      </div>
    </div>
  );
}
