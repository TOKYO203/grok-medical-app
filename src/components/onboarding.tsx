import { useState } from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import { GOALS } from "@/content/catalog";
import type { StudyLevel } from "@/core/types";
import { SUBJECT_CATEGORIES, DAILY_GOALS } from "@/data/onboarding";
import { MadagascarMark, Wordmark } from "@/components/brand/marks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/i18n";
import { useOptimus } from "@/state/store";
import { requestNotificationPermission } from "@/lib/notifications/daily-reminder";

const MAX_SUBJECTS = 6;
const TOTAL_STEPS = 4;

const LEVEL_GROUPS: { id: string; labelKey: string; focusKey: string; value: StudyLevel }[] = [
  { id: "l1-2", labelKey: "onb.levelL12", focusKey: "onb.levelL12Focus", value: 2 },
  { id: "l3-4", labelKey: "onb.levelL34", focusKey: "onb.levelL34Focus", value: 4 },
  { id: "l5-6", labelKey: "onb.levelL56", focusKey: "onb.levelL56Focus", value: 5 },
  { id: "interne", labelKey: "onb.levelIntern", focusKey: "onb.levelInternFocus", value: 6 },
];

const SUBJECT_SUGGESTIONS: Record<string, string[]> = {
  "l1-2":    ["Anatomie", "Physiologie", "Biostatistiques"],
  "l3-4":    ["Sémiologie", "Pharmacologie", "Infectiologie"],
  "l5-6":    ["Cardiologie", "Urgences", "Pneumologie"],
  "interne": ["Urgences", "Cardiologie", "Infectiologie"],
};

export function Onboarding() {
  const complete = useOptimus((s) => s.completeOnboarding);
  const { t } = useI18n();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [levelGroup, setLevelGroup] = useState<string>("l5-6");
  const [goal, setGoal] = useState("edn");
  const [subjects, setSubjects] = useState<string[]>(SUBJECT_SUGGESTIONS["l5-6"]);
  const [dailyGoal, setDailyGoal] = useState<string>("30min");
  const [showAllRhythms, setShowAllRhythms] = useState(false);

  function toggle(sub: string) {
    setSubjects((cur) =>
      cur.includes(sub)
        ? cur.filter((s) => s !== sub)
        : cur.length >= MAX_SUBJECTS
          ? cur
          : [...cur, sub],
    );
  }

  function selectLevel(id: string) {
    setLevelGroup(id);
    setSubjects(SUBJECT_SUGGESTIONS[id] ?? []);
  }

  function finish() {
    const group = LEVEL_GROUPS.find((g) => g.id === levelGroup) ?? LEVEL_GROUPS[2];
    if (typeof window !== "undefined") {
      window.localStorage.setItem("optimus.dailyGoal", dailyGoal);
    }
    void requestNotificationPermission();
    complete({
      displayName: name.trim() || "Nouveau",
      studyYear: typeof group.value === "number" ? group.value : 0,
      studyLevel: group.value,
      goal,
      prioritySubjects: subjects,
      onboarded: true,
    });
  }

  function skip() {
    complete({
      displayName: "Nouveau",
      studyYear: 5,
      studyLevel: 5 as StudyLevel,
      goal: "edn",
      prioritySubjects: ["Cardiologie"],
      onboarded: true,
    });
  }

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="flex min-h-dvh flex-col bg-bg px-5 py-8 text-fg outline-none"
    >
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <div className="flex items-center justify-between">
          <Wordmark />
          {step < TOTAL_STEPS - 1 ? (
            <button
              type="button"
              onClick={skip}
              className="text-xs text-muted underline-offset-4 hover:underline"
            >
              {t("onb.skip")}
            </button>
          ) : null}
        </div>

        {/* Barre de progression */}
        <div className="mt-6 flex items-center gap-1.5" aria-hidden>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <span
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= step ? "bg-primary" : "bg-secondary"
              }`}
            />
          ))}
        </div>
        <p className="optimus-kicker mt-2 text-[11px] uppercase tracking-[0.16em]">
          {t("onb.step", { current: step + 1, total: TOTAL_STEPS })}
        </p>

        {/* Écran 1 — Bienvenue + nom */}
        {step === 0 ? (
          <div className="mt-10 flex flex-1 flex-col">
            <MadagascarMark className="mb-6 h-14 w-9 text-primary/80" />
            <h1 className="font-display text-3xl font-medium tracking-tight">
              {t("onb.welcomeTitle")}
            </h1>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">
              {t("onb.pitch")}
            </p>
            <label className="mt-8 text-xs font-medium text-muted" htmlFor="name">
              {t("onb.nameLabel")}
            </label>
            <Input
              id="name"
              className="mt-2"
              placeholder={t("onb.namePlaceholder")}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <p className="mt-2 text-[11px] text-subtle">{t("onb.nameHint")}</p>
            <Button className="mt-auto" size="lg" onClick={() => setStep(1)}>
              {t("onb.continue")}
            </Button>
          </div>
        ) : null}

        {/* Écran 2 — Niveau */}
        {step === 1 ? (
          <div className="mt-10 flex flex-1 flex-col">
            <h2 className="font-display text-2xl font-medium tracking-tight">
              {t("onb.levelTitle")}
            </h2>
            <p className="mt-2 text-sm text-muted">{t("onb.levelHint")}</p>
            <div className="mt-6 grid gap-2">
              {LEVEL_GROUPS.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => selectLevel(g.id)}
                  aria-pressed={levelGroup === g.id}
                  className={`flex w-full flex-col items-start rounded-[var(--radius-md)] px-4 py-3 text-left shadow-[var(--shadow-border)] ${
                    levelGroup === g.id ? "bg-primary-soft" : "bg-card"
                  }`}
                >
                  <span className="text-sm font-medium">{t(g.labelKey)}</span>
                  <span className="text-xs text-muted">{t(g.focusKey)}</span>
                </button>
              ))}
            </div>
            <Button className="mt-auto" onClick={() => setStep(2)}>
              {t("onb.continue")}
            </Button>
          </div>
        ) : null}

        {/* Écran 3 — Objectif + matières */}
        {step === 2 ? (
          <div className="mt-10 flex flex-1 flex-col">
            <h2 className="font-display text-2xl font-medium tracking-tight">
              {t("onb.goalTitle")}
            </h2>
            <p className="mt-2 text-sm text-muted">{t("onb.goalHint")}</p>
            <div className="mt-5 space-y-2">
              {GOALS.slice(0, 4).map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setGoal(g.id)}
                  aria-pressed={goal === g.id}
                  className={`flex h-12 w-full items-center rounded-[var(--radius-md)] px-4 text-sm shadow-[var(--shadow-border)] ${
                    goal === g.id ? "bg-primary-soft" : "bg-card"
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>

            <div className="mt-8 flex items-center gap-2">
              <Sparkles className="size-3.5 text-primary" />
              <p className="optimus-kicker text-[11px] font-medium uppercase tracking-[0.16em]">
                {t("onb.suggested")}
              </p>
              <span className="ml-auto text-[11px] text-subtle">
                {subjects.length}/{MAX_SUBJECTS}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(SUBJECT_CATEGORIES)
                .flatMap(([, list]) => list)
                .map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggle(s)}
                    className={`h-9 rounded-full px-3 text-xs shadow-[var(--shadow-border)] ${
                      subjects.includes(s) ? "bg-primary text-primary-fg" : "bg-card text-fg"
                    }`}
                  >
                    {s}
                  </button>
                ))}
            </div>
            <p className="mt-3 text-[11px] text-subtle">
              {t("onb.subjectsHint", { max: MAX_SUBJECTS })}
            </p>
            <Button className="mt-auto" onClick={() => setStep(3)}>
              {t("onb.continue")}
            </Button>
          </div>
        ) : null}

        {/* Écran 4 — Rythme + fin */}
        {step === 3 ? (
          <div className="mt-10 flex flex-1 flex-col">
            <h2 className="font-display text-2xl font-medium tracking-tight">
              {t("onb.rhythmTitle")}
            </h2>
            <p className="mt-2 text-sm text-muted">{t("onb.rhythmHint")}</p>
            <div className="mt-6 space-y-2">
              {DAILY_GOALS.slice(0, showAllRhythms ? DAILY_GOALS.length : 3).map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setDailyGoal(g.id)}
                  aria-pressed={dailyGoal === g.id}
                  className={`flex w-full flex-col items-start gap-1 rounded-[var(--radius-md)] px-4 py-3 text-left shadow-[var(--shadow-border)] ${
                    dailyGoal === g.id ? "bg-primary-soft" : "bg-card"
                  }`}
                >
                  <span className="text-sm font-medium">{g.label}</span>
                  <span className="text-xs text-muted">{g.description}</span>
                </button>
              ))}
            </div>
            {!showAllRhythms ? (
              <button
                type="button"
                onClick={() => setShowAllRhythms(true)}
                className="mt-3 flex items-center gap-1 text-xs text-muted"
              >
                <ChevronDown className="size-3.5" />
                {t("onb.moreOptions")}
              </button>
            ) : null}
            <Button className="mt-auto" size="lg" onClick={finish}>
              {t("onb.start")}
            </Button>
          </div>
        ) : null}
      </div>
    </main>
  );
}
