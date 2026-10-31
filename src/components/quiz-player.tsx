import { useEffect, useMemo, useRef, useState } from "react";
import {ArrowRight, Check, Flame, Maximize2, Minimize2, X, Lightbulb } from "lucide-react";
import { MedicalSources, ReportContentError } from "@/components/content-trust";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { Question } from "@/core/types";
import { comboBonus } from "@/core/quiz-engine";
import { track } from "@/lib/analytics/client";
import { emitExperienceFeedback } from "@/lib/experience-feedback";
import { useI18n } from "@/i18n";
import { useExperiencePreferences } from "@/lib/use-experience-preferences";
import { cn } from "@/lib/utils";
import { useOptimus } from "@/state/store";

export type QuizItem = {
  question: Question;
  deckTitle?: string;
  deckId?: string;
  deckVersion?: string;
};

const QUESTION_ARM_DELAY_MS = 500;

const FOCUS_MODE_STORAGE_KEY = "optimus.focusMode";

/*
 * D33 — mode focus (Session 16) : masque l'en-tête mobile et la barre de
 * navigation le temps de la session de quiz. Le choix est mémorisé dans
 * localStorage et réappliqué à la prochaine session ; l'attribut sur <html>
 * est retiré au démontage pour ne pas fuiter sur les autres pages.
 */
function useFocusMode() {
  const [focus, setFocus] = useState(false);

  useEffect(() => {
    let stored = false;
    try {
      stored = window.localStorage.getItem(FOCUS_MODE_STORAGE_KEY) === "on";
    } catch {
      /* stockage indisponible — mode focus non mémorisé */
    }
    if (stored) {
      setFocus(true);
      if (typeof document !== "undefined") {
        document.documentElement.dataset.optimusFocus = "on";
      }
    }
    return () => {
      if (typeof document !== "undefined") {
        delete document.documentElement.dataset.optimusFocus;
      }
    };
  }, []);

  const toggle = () => {
    setFocus((prev) => {
      const next = !prev;
      if (typeof document !== "undefined") {
        document.documentElement.dataset.optimusFocus = next ? "on" : "off";
      }
      try {
        window.localStorage.setItem(FOCUS_MODE_STORAGE_KEY, next ? "on" : "off");
      } catch {
        /* stockage indisponible — le mode reste actif pour cette session */
      }
      return next;
    });
  };

  return { focus, toggle };
}

export function QuizPlayer({
  items,
  onAnswer,
  onFinish,
  finishLabel,
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
  // Session 11 — compteur de temps d'étude : point de départ du lecteur.
  const studyStartedAt = useRef(Date.now());
  const { preferences } = useExperiencePreferences();
  const { t } = useI18n();
  const focusMode = useFocusMode();
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

  // Session 11 — compteur de temps d'étude : le temps passé sur le quiz est
  // crédité à la sortie du lecteur (seules les visites > 1 s comptent).
  useEffect(
    () => () => {
      const elapsedMs = Date.now() - studyStartedAt.current;
      if (elapsedMs > 1000) useOptimus.getState().logStudyTime(elapsedMs);
    },
    [],
  );

  if (sessionItems.length === 0) {
    return <p className="text-sm text-muted">{t("quiz.empty")}</p>;
  }

  if (done || !item) {
    return (
      <div
        className={cn(
          "mx-auto max-w-lg py-8 text-center",
          preferences.enhancedMotion && "optimus-session-complete",
        )}
      >
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
          {t("quiz.session")}
        </p>
        <h2 className="mt-2 font-display text-3xl font-medium tracking-tight">
          {correctCount}/{sessionItems.length}
        </h2>
        <p className="mt-2 text-sm text-muted">{t("quiz.summary", { max: maxCombo })}</p>
        <Button
          className="mt-6"
          onClick={() => {
            // MESURE-1 : une session terminée est l'unité d'engagement. Le
            // déclencheur est le clic sur « Terminer », jamais le rendu.
            track("session_completed", {
              surface: "qcm",
              count: sessionItems.length,
              minutes: Math.max(1, Math.round((Date.now() - studyStartedAt.current) / 60_000)),
            });
            onFinish({ correct: correctCount, total: sessionItems.length, maxCombo });
          }}
        >
          {finishLabel ?? t("quiz.finish")}
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
    emitExperienceFeedback(isOk ? "correct" : "incorrect", preferences);
    onAnswer(item, isOk, nextCombo);
  }

  function next() {
    if (advanceLocked.current) return;
    advanceLocked.current = true;
    answerLocked.current = true;
    setAnswerReady(false);
    if (index === sessionItems.length - 1) {
      emitExperienceFeedback("complete", preferences);
    }
    setPicked(null);
    setIndex((n) => n + 1);
    unlockTimer.current = setTimeout(() => {
      answerLocked.current = false;
      advanceLocked.current = false;
      setAnswerReady(true);
    }, QUESTION_ARM_DELAY_MS);
  }

  /*
   * Oxford Signature — raccourcis clavier (desktop) :
   * · 1…n ou A/B/C/D : choisir la réponse correspondante ;
   * · Entrée / Espace / → : passer à la question suivante une fois la
   *   réponse révélée.
   * Les gardes existantes (answerLocked / advanceLocked / picked) rendent
   * tout double déclenchement inoffensif : le second appel est un no-op.
   * Les frappes dans un champ de saisie (palette de commandes, signalement)
   * sont ignorées pour ne jamais voler une saisie utilisateur.
   */
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (revealed) {
        if (event.key === "Enter" || event.key === " " || event.key === "ArrowRight") {
          event.preventDefault();
          next();
        }
        return;
      }
      if (!answerReady) return;
      const key = event.key.toLowerCase();
      let choiceIdx = -1;
      const digit = Number.parseInt(key, 10);
      if (!Number.isNaN(digit) && digit >= 1 && digit <= q.choices.length) {
        choiceIdx = digit - 1;
      } else if (/^[a-z]$/.test(key)) {
        const letterIdx = key.charCodeAt(0) - 97; /* a = 0 */
        if (letterIdx < q.choices.length) choiceIdx = letterIdx;
      }
      if (choiceIdx >= 0) {
        event.preventDefault();
        choose(choiceIdx);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className={cn("mx-auto w-full", focusMode.focus ? "max-w-xl" : "max-w-lg")}>
      <div className="mb-5 flex items-center gap-3">
        <Progress value={((index + (revealed ? 1 : 0)) / sessionItems.length) * 100} />
        {combo >= 2 ? (
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-full bg-warn/10 px-2 py-1 font-mono text-[11px] font-medium text-warn shadow-[var(--shadow-border)]",
              preferences.enhancedMotion && revealed && ok && "optimus-combo-pulse",
            )}
            aria-label={t("quiz.comboAria", { count: combo })}
          >
            <Flame className="size-3.5" />
            x{combo}
          </span>
        ) : null}
        <span className="shrink-0 font-mono text-xs tabular-nums text-muted">
          {index + 1}/{sessionItems.length}
        </span>
        <button
          type="button"
          onClick={focusMode.toggle}
          aria-pressed={focusMode.focus}
          aria-label={focusMode.focus ? t("quiz.exitFocus") : t("quiz.focus")}
          title={focusMode.focus ? t("quiz.exitFocus") : t("quiz.focus")}
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-muted transition-colors active:scale-95",
            focusMode.focus && "bg-primary-soft text-primary",
          )}
        >
          {focusMode.focus ? (
            <Minimize2 className="size-4" aria-hidden />
          ) : (
            <Maximize2 className="size-4" aria-hidden />
          )}
        </button>
      </div>
      {item.deckTitle ? (
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
          {item.deckTitle}
        </p>
      ) : null}
      <h2
        className={cn(
          "font-display text-2xl font-medium leading-snug tracking-tight text-fg",
          focusMode.focus && "text-3xl",
        )}
      >
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
                  "flex min-h-14 w-full items-start gap-3 rounded-[var(--radius-lg)] px-4 py-3 text-left text-sm shadow-[var(--shadow-border)] transition-[background-color,color,transform,box-shadow] duration-150 disabled:cursor-default",
                  !revealed && "bg-card hover:bg-surface active:scale-[0.99]",
                  revealed && isCorrect && "bg-primary-soft text-fg",
                  revealed && isPicked && !isCorrect && "bg-danger/15 text-fg",
                  revealed && !isCorrect && !isPicked && "bg-card opacity-60",
                  preferences.enhancedMotion && revealed && isCorrect && "optimus-answer-correct",
                  preferences.enhancedMotion && revealed && isPicked && !isCorrect && "optimus-answer-incorrect",
                )}
              >
                {/* Oxford Signature — pastille circulaire : la lettre devient un
                    badge, plus lisible et plus « fini » qu'un simple texte mono. */}
                <span
                  aria-hidden="true"
                  className={cn(
                    "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-semibold",
                    revealed && isCorrect
                      ? "bg-primary-soft text-primary"
                      : revealed && isPicked
                        ? "bg-danger/15 text-danger"
                        : "bg-secondary text-muted",
                  )}
                >
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
        <div
          className={cn(
            "mt-5 rounded-[var(--radius-lg)] bg-card p-4 shadow-[var(--shadow-border)]",
            preferences.enhancedMotion && "optimus-feedback-panel",
          )}
        >
          <p className={cn("text-sm font-medium", ok ? "text-primary" : "text-danger")}>
            {ok
              ? t("quiz.correct", { count: combo, xp: comboBonus(combo) })
              : t("quiz.incorrect")}
          </p>

          <div className="mt-4 flex items-center gap-2 border-t border-border/40 pt-4">

            <Lightbulb className="size-3.5 text-warn" aria-hidden />

            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
              {t("quiz.why")}
            </p>

          </div>

          <p className="mt-2 text-sm leading-relaxed text-fg">{q.explanation}</p>
          <MedicalSources sources={q.sources} compact />
          <ReportContentError
            target={{
              contentType: "question",
              contentId: q.id,
              deckId: item.deckId,
              deckVersion: item.deckVersion,
              label: q.prompt,
            }}
            className="mt-2 w-full"
          />
          <Button className="mt-4 w-full" onClick={next}>
            {index === sessionItems.length - 1 ? t("quiz.results") : t("quiz.next")}
            <ArrowRight className="size-4" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
