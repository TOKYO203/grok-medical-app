import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useSyncExternalStore } from "react";
import { AlertTriangle, CheckCircle2, ChevronRight, Info, Lock, ShieldAlert } from "lucide-react";
import { Shell } from "@/components/shell";
import { ContentLocked } from "@/components/premium/content-locked";
import { buttonVariants } from "@/components/ui/button-variants";
import { track } from "@/lib/analytics/client";
import {
  awaitContentSessionIfLikely,
  getContentServerSnapshot,
  getContentSessionSnapshot,
  subscribeContentSession,
} from "@/lib/cloud/content-session";
import {
  NEURO_LESSONS,
  NEURO_SYSTEM,
  loadLesson,
  previousLessonId,
  type LessonLoad,
} from "@/lib/examen-clinique/catalog";
import {
  bestScore,
  getUnlockThreshold,
  isLessonComplete,
  isLessonUnlocked,
  isUnlockAllActive,
  markLessonComplete,
  setUnlockAll,
} from "@/lib/examen-clinique/progression";
import type { ContentBlock, Lesson } from "@/lib/examen-clinique/types";

/**
 * EXAMEN CLINIQUE — parcours guidé par système (phase 1 : Neurologie).
 *
 * Modèle ECG : une route plate, la leçon choisie via le paramètre ?lesson=,
 * une progression locale (localStorage) et un déblocage progressif
 * (leçon N'ouverte quand la leçon N-1 atteint 80 %).
 *
 * Le verrou PREMIUM est SERVER-side : la leçon 1 est un actif public
 * (public/content/examen-clinique/neuro-01.json), les leçons 2 à 10 vivent dans
 * private/content/examen-clinique/ et ne sortent que contre un jeton de
 * contenu — sans licence, aucun octet de leçon n'arrive dans le navigateur,
 * la page affiche le bandeau ContentLocked.
 */
export const Route = createFileRoute("/examen-clinique")({
  validateSearch: (search: Record<string, unknown>) => {
    const lesson = typeof search.lesson === "string" ? search.lesson : undefined;
    return { lesson };
  },
  component: ExamenCliniquePage,
});

function ExamenCliniquePage() {
  const { lesson } = Route.useSearch();
  const [, setProgressTick] = useState(0);
  const bump = () => setProgressTick((t) => t + 1);
  const meta = lesson ? NEURO_LESSONS.find((m) => m.id === lesson) : undefined;

  return (
    <Shell title="Examen clinique">
      <div className="mx-auto max-w-2xl" data-examen-clinique={lesson ?? "index"}>
        {lesson && meta ? (
          <div>
            <Link to="/examen-clinique" search={{ lesson: undefined }} className="text-sm text-muted">
              ← Retour au parcours
            </Link>
            <LessonView id={lesson} onDone={bump} />
          </div>
        ) : (
          <LessonList onToggleUnlockAll={bump} />
        )}
      </div>
    </Shell>
  );
}

/**
 * Liste du parcours : progression, états de déblocage. Les fonctions de
 * progression relisent le localStorage à chaque rendu du parent, donc un
 * retour depuis une leçon suffit à rafraîchir les états.
 */
function LessonList({ onToggleUnlockAll }: { onToggleUnlockAll: () => void }) {
  const [unlockAll, setUnlockAllState] = useState(false);
  useEffect(() => {
    setUnlockAllState(isUnlockAllActive());
  }, []);

  const doneCount = NEURO_LESSONS.filter((m) => isLessonComplete(m.id)).length;
  const pct = Math.round((doneCount / NEURO_LESSONS.length) * 100);

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-subtle">Parcours guidé</p>
      <h1 className="mt-1 font-display text-3xl font-medium">Examen clinique</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        {NEURO_SYSTEM.subtitle} — inspection, palpation, percussion, auscultation, puis le geste précis :
        la neurologie en {NEURO_LESSONS.length} leçons guidées, avec quiz.
      </p>

      <div className="optimus-card mt-5 p-5" data-examen-progress={doneCount}>
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-medium">Progression · {NEURO_SYSTEM.title}</p>
          <p className="text-sm text-muted">{doneCount} / {NEURO_LESSONS.length}</p>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
          <div className="h-full rounded-full bg-primary" style={{ width: pct + "%" }} />
        </div>
        <p className="mt-2 text-xs text-subtle">
          La leçon suivante s'ouvre quand la précédente est validée à au moins {getUnlockThreshold()} %.
        </p>
      </div>

      <ul className="mt-4 space-y-2">
        {NEURO_LESSONS.map((meta) => {
          const progressLocked = !isLessonUnlocked(meta.order, previousLessonId(meta.order));
          const done = isLessonComplete(meta.id);
          const badge = meta.isFree ? "Gratuite" : meta.isExam ? "Examen final" : "Premium";
          if (progressLocked) {
            return (
              <li key={meta.id} className="optimus-card flex items-center gap-3 p-4 opacity-60" data-examen-row={meta.id} data-locked="progress">
                <Lock className="size-5 shrink-0 text-subtle" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{meta.order}. {meta.title}</p>
                  <p className="mt-0.5 text-xs text-subtle">{meta.durationMin} min · {badge}</p>
                </div>
                <span className="text-xs text-subtle">Validez la leçon {meta.order - 1} d'abord</span>
              </li>
            );
          }
          return (
            <li key={meta.id} data-examen-row={meta.id} data-locked="false">
              <Link to="/examen-clinique" search={{ lesson: meta.id }} className="optimus-card flex items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{meta.order}. {meta.title}</p>
                  <p className="mt-0.5 text-xs text-subtle">
                    {meta.durationMin} min · {badge}{done ? " · validée " + bestScore(meta.id) + " %" : ""}
                  </p>
                </div>
                {done ? (
                  <CheckCircle2 className="size-5 shrink-0" style={{ color: "#059669" }} aria-hidden />
                ) : (
                  <ChevronRight className="size-5 shrink-0 text-subtle" aria-hidden />
                )}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="mt-6 text-center">
        <button
          type="button"
          className="px-4 py-2 text-xs text-subtle underline underline-offset-4"
          data-examen-unlock-all={unlockAll}
          onClick={() => {
            const next = !unlockAll;
            setUnlockAll(next);
            setUnlockAllState(next);
            onToggleUnlockAll();
          }}
        >
          {unlockAll
            ? "Restreindre le parcours (revenir au déblocage progressif)"
            : "Déverrouiller tout le parcours (démo, formation)"}
        </button>
      </div>
    </div>
  );
}

type LessonState = { status: "loading" } | LessonLoad;

/** Leçon active : chargement client, sous jeton pour les leçons premium. */
function LessonView({ id, onDone }: { id: string; onDone: () => void }) {
  const contentSession = useSyncExternalStore(
    subscribeContentSession,
    getContentSessionSnapshot,
    getContentServerSnapshot,
  );
  const [state, setState] = useState<LessonState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    void (async () => {
      await awaitContentSessionIfLikely();
      if (cancelled) return;
      try {
        const loaded = await loadLesson(id);
        if (cancelled) return;
        setState(loaded);
        if (loaded.status === "ok") track("first_content_viewed", { surface: "examen-clinique" });
      } catch {
        if (!cancelled) setState({ status: "missing" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, contentSession.generation]);

  if (state.status === "loading") {
    return <div className="optimus-card mt-4 h-40 animate-pulse p-5" aria-busy="true" data-examen-lesson="loading" />;
  }
  if (state.status === "locked") {
    return (
      <div className="mt-4" data-examen-lesson="locked">
        <ContentLocked />
      </div>
    );
  }
  if (state.status === "missing") {
    return (
      <div className="optimus-card mt-4 p-6 text-center" data-examen-lesson="missing">
        <p className="font-display text-lg">Leçon en préparation</p>
        <p className="mt-2 text-sm text-muted">Cette leçon n'est pas encore publiée.</p>
      </div>
    );
  }
  return <LessonReader lesson={state.data} />;
}

/** Rendu de la leçon : objectifs, contenu, points clés, quiz, validation. */
function LessonReader({ lesson }: { lesson: Lesson }) {
  const [answers, setAnswers] = useState<(number | null)[]>(() => lesson.checkQuiz.map(() => null));
  const [submitted, setSubmitted] = useState(false);
  const [scoreSaved, setScoreSaved] = useState<number | null>(null);

  const total = lesson.checkQuiz.length;
  const correctCount = lesson.checkQuiz.reduce(
    (acc, q, i) => acc + (answers[i] === q.correct ? 1 : 0),
    0,
  );
  const allAnswered = answers.every((a) => a !== null);
  const passLine = lesson.isExam ? lesson.passThreshold ?? 80 : getUnlockThreshold();

  function submit() {
    if (!allAnswered || submitted) return;
    const score = total === 0 ? 100 : Math.round((correctCount / total) * 100);
    markLessonComplete(lesson.id, score);
    setScoreSaved(score);
    setSubmitted(true);
  }

  return (
    <article className="mt-4" data-examen-lesson="ok">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-subtle">
        Leçon {lesson.order} · {lesson.durationMin} min
      </p>
      <h1 className="mt-1 font-display text-2xl font-medium">{lesson.title}</h1>

      <div className="optimus-card mt-4 p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-subtle">Objectifs</p>
        <ul className="mt-2 space-y-1">
          {lesson.objectives.map((objective, i) => (
            <li key={i} className="text-sm leading-relaxed">· {objective}</li>
          ))}
        </ul>
      </div>

      <div className="mt-4 space-y-4">
        {lesson.content.map((block, i) => (
          <ContentBlockView key={i} block={block} />
        ))}
      </div>

      <div className="optimus-card mt-6 p-5" data-examen-key-points>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-subtle">À retenir</p>
        <ul className="mt-3 space-y-2">
          {lesson.keyPoints.map((point, i) => (
            <li key={i} className="flex items-start gap-2 text-sm leading-relaxed">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <span><Emphasis text={point} /></span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6">
        <h2 className="font-display text-xl font-medium">Quiz de contrôle</h2>
        <p className="mt-1 text-sm text-muted">
          {total} questions. Il faut au moins {passLine} % pour valider.
        </p>
        <div className="mt-3 space-y-3">
          {lesson.checkQuiz.map((q, qi) => (
            <div key={qi} className="optimus-card p-4" data-examen-q={qi}>
              <p className="text-sm font-medium">{qi + 1}. {q.question}</p>
              <div className="mt-2 space-y-1">
                {q.choices.map((choice, ci) => {
                  const selected = answers[qi] === ci;
                  const style = submitted
                    ? ci === q.correct
                      ? ({ color: "#059669", fontWeight: 600 } as const)
                      : selected
                        ? ({ color: "#dc2626" } as const)
                        : undefined
                    : undefined;
                  return (
                    <label
                      key={ci}
                      className="flex items-start gap-2 text-sm"
                      style={{ opacity: submitted && !selected && ci !== q.correct ? 0.6 : 1 }}
                    >
                      <input
                        type="radio"
                        className="mt-1"
                        checked={selected}
                        disabled={submitted}
                        name={"examen-clinique-q-" + qi}
                        onChange={() => setAnswers((prev) => prev.map((v, i) => (i === qi ? ci : v)))}
                      />
                      <span style={style}>{choice}</span>
                    </label>
                  );
                })}
              </div>
              {submitted ? <p className="mt-2 text-xs text-muted">{q.explanation}</p> : null}
            </div>
          ))}
        </div>
        <div className="mt-4">
          {!submitted ? (
            <button
              type="button"
              onClick={submit}
              disabled={!allAnswered}
              className={buttonVariants({ size: "lg", className: "w-full" })}
              data-examen-submit
            >
              Valider mes réponses
            </button>
          ) : (
            <div className="optimus-card p-4 text-center" data-examen-score={scoreSaved ?? 0}>
              <p className="font-display text-2xl">{scoreSaved ?? 0} %</p>
              <p className="mt-1 text-sm text-muted">
                {(scoreSaved ?? 0) >= passLine
                  ? "Validé — la leçon suivante est débloquée."
                  : "Seuil non atteint — refaites le quiz pour progresser."}
              </p>
            </div>
          )}
          <Link to="/examen-clinique" search={{ lesson: undefined }} className="mt-3 block text-center text-sm text-muted underline underline-offset-4">
            Retour au parcours
          </Link>
        </div>
      </div>
    </article>
  );
}

/** Rendu des gras simples (**mot**) ; le reste est affiché tel quel. */
function Emphasis({ text }: { text: string }) {
  const parts = text.split("**");
  return (
    <>
      {parts.map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : part))}
    </>
  );
}

/** Texte découpé en paragraphes aérés sur les lignes vides : moins de bloc
 * compact, plus lisible sur mobile. */
function Paragraphs({ text }: { text: string }) {
  const paragraphs = text.split("\n\n").filter((p) => p.trim().length > 0);
  return (
    <div className="space-y-3">
      {paragraphs.map((paragraph, i) => (
        <p key={i} className="text-sm leading-relaxed"><Emphasis text={paragraph.replace(/\n/g, " ")} /></p>
      ))}
    </div>
  );
}

function CalloutIcon({ tone }: { tone: "info" | "warning" | "danger" | "success" }) {
  if (tone === "danger") return <ShieldAlert className="size-4 shrink-0" aria-hidden />;
  if (tone === "warning") return <AlertTriangle className="size-4 shrink-0" aria-hidden />;
  if (tone === "success") return <CheckCircle2 className="size-4 shrink-0" aria-hidden />;
  return <Info className="size-4 shrink-0" aria-hidden />;
}

function ContentBlockView({ block }: { block: ContentBlock }) {
  if (block.type === "text") {
    return <Paragraphs text={block.markdown} />;
  }
  if (block.type === "steps") {
    return (
      <div className="grid gap-2 sm:grid-cols-2" data-examen-steps>
        {block.items.map((item, i) => (
          <div key={i} className="optimus-card p-4">
            <div className="flex items-center gap-2">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-soft font-display text-sm font-semibold text-primary">{item.n}</span>
              <p className="text-sm font-semibold">{item.title}</p>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted"><Emphasis text={item.text} /></p>
          </div>
        ))}
      </div>
    );
  }
  if (block.type === "callout") {
    const colors: Record<string, string> = {
      info: "#2563eb",
      success: "#059669",
      warning: "#d97706",
      danger: "#dc2626",
    };
    const color = colors[block.tone] ?? "#2563eb";
    return (
      <div
        className="rounded-[var(--radius-lg)] p-4"
        style={{ backgroundColor: color + "14", borderLeft: "4px solid " + color }}
        data-examen-callout={block.tone}
      >
        {block.title ? (
          <p className="flex items-center gap-2 text-sm font-semibold" style={{ color }}>
            <CalloutIcon tone={block.tone} />
            {block.title}
          </p>
        ) : null}
        <p className="text-sm leading-relaxed"><Emphasis text={block.markdown} /></p>
      </div>
    );
  }
  if (block.type === "list") {
    const items = block.items.map((item, i) => (
      <li key={i} className="text-sm leading-relaxed"><Emphasis text={item} /></li>
    ));
    return block.ordered ? (
      <ol className="ml-5 list-decimal space-y-1">{items}</ol>
    ) : (
      <ul className="ml-5 list-disc space-y-1">{items}</ul>
    );
  }
  if (block.type === "table") {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              {block.headers.map((header, i) => (
                <th key={i} className="border-b p-2 text-left font-semibold">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci} className="border-b p-2 align-top">{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return (
    <figure>
      <img src={block.src} alt={block.alt ?? ""} className="w-full rounded-[var(--radius-lg)]" loading="lazy" />
      {block.caption ? <figcaption className="mt-1 text-xs text-subtle">{block.caption}</figcaption> : null}
    </figure>
  );
}
