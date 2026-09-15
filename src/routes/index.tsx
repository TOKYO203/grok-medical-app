import type { ReactNode } from "react";
import { useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Calculator,
  ChevronRight,
  ClipboardCheck,
  Flame,
  Lock,
  RotateCcw,
  Sparkles,
  Trophy,
  Upload,
  Zap,
} from "lucide-react";
import { Onboarding } from "@/components/onboarding";
import { DeckIcon } from "@/components/deck-icon";
import { Page, SectionTitle, Shell } from "@/components/shell";
import { buttonVariants } from "@/components/ui/button-variants";
import { Progress } from "@/components/ui/progress";
import { CLINICAL_CASES } from "@/content/catalog";
import { COMPETENCIES, COMPETENCY_LABEL, STUDY_LEVEL_LABEL } from "@/core/types";
import { competencyMastery, deckProgressPct, globalMastery, masteryBand } from "@/core/mastery";
import { pickTodayQuestions } from "@/core/quiz-engine";
import { isDue } from "@/core/spaced-repetition";
import { levelInfo } from "@/core/scoring";
import { currentLeague, hasAccess, useAllDecks, useOptimus } from "@/state/store";
import { formatInt } from "@/lib/utils";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const onboarded = useOptimus((s) => s.profile.onboarded);
  const hydrated = useOptimus((s) => s.hydrated);
  const finishHydration = useOptimus((s) => s.finishHydration);
  useEffect(() => {
    const fallback = window.setTimeout(() => finishHydration(), 250);
    return () => window.clearTimeout(fallback);
  }, [finishHydration]);
  if (!hydrated) return <HomeSkeleton />;
  if (!onboarded) return <Onboarding />;
  return (
    <Shell title="Aujourd’hui">
      <Dashboard />
    </Shell>
  );
}

function Dashboard() {
  const profile = useOptimus((s) => s.profile);
  const xp = useOptimus((s) => s.xp);
  const streak = useOptimus((s) => s.streak);
  const daily = useOptimus((s) => s.daily);
  const weeklyXp = useOptimus((s) => s.weeklyXp);
  const progress = useOptimus((s) => s.progress);
  const entitlements = useOptimus((s) => s.entitlements);
  const decks = useAllDecks();
  const unlocked = decks.filter((d) => hasAccess(d, entitlements, profile.tier));
  const lvl = levelInfo(xp);
  const league = currentLeague(weeklyXp);
  const mastery = globalMastery(unlocked, progress);
  const band = masteryBand(mastery);
  const dueCount = unlocked.reduce((n, d) => {
    const seen = progress[d.id]?.seen ?? {};
    return n + d.questions.filter((q) => isDue(seen[q.id])).length;
  }, 0);
  const todayItems = pickTodayQuestions(unlocked, progress, 10);
  const comps = COMPETENCIES.map((c) => ({
    id: c,
    label: COMPETENCY_LABEL[c],
    score: competencyMastery(unlocked, progress, c),
  })).sort((a, b) => a.score - b.score);
  const weak = comps[0];
  const strong = [...comps].reverse()[0];
  const priority = unlocked.filter((d) =>
    profile.prioritySubjects.some(
      (s) => d.subject.toLowerCase().includes(s.toLowerCase()) || d.title.includes(s),
    ),
  );
  const resumed = unlocked
    .map((deck) => ({
      deck,
      lastReview: Math.max(
        0,
        ...Object.values(progress[deck.id]?.seen ?? {}).map((item) => item.lastReview ?? 0),
      ),
    }))
    .sort((a, b) => b.lastReview - a.lastReview)
    .find((item) => item.lastReview > 0)?.deck;
  const featured = resumed ?? priority[0] ?? unlocked[0];
  const featuredProgress = featured ? deckProgressPct(featured, progress[featured.id]) : 0;
  const dailyGoal = 10;
  const dailyPct = Math.min(100, Math.round((daily.answered / dailyGoal) * 100));
  const remaining = Math.max(0, dailyGoal - daily.answered);

  return (
    <Page>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
            {profile.tier === "guest" ? "Invité" : profile.optimusId}
          </p>
          <h1 className="mt-1 truncate font-display text-3xl font-medium tracking-tight">
            Bonjour
            {profile.displayName && profile.displayName !== "Invité"
              ? `, ${profile.displayName}`
              : ""}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {(profile.studyLevel && STUDY_LEVEL_LABEL[profile.studyLevel]) ??
              YEARS_SHORT[profile.studyYear] ??
              "Cursus"}{" "}
            · {band.label} · ligue {league.label}
          </p>
        </div>
        <Link
          to="/profil"
          aria-label="Ouvrir mon profil"
          className="optimus-interactive-card flex size-12 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-primary-soft font-display text-lg text-primary shadow-[var(--shadow-border)]"
        >
          {initials(profile.displayName)}
        </Link>
      </div>

      <section className="premium-hero mt-6 overflow-hidden rounded-[var(--radius-xl)] p-5 text-primary-fg shadow-[var(--shadow-md)]">
        <div className="flex items-center gap-5">
          <DailyProgress value={dailyPct} answered={daily.answered} goal={dailyGoal} />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-[0.14em] opacity-75">
              Session du jour
            </p>
            <h2 className="mt-1 font-display text-2xl font-medium tracking-tight">
              {remaining === 0
                ? "Objectif atteint"
                : daily.answered > 0
                  ? `${remaining} question${remaining > 1 ? "s" : ""} restante${remaining > 1 ? "s" : ""}`
                  : "Prêt pour 10 minutes ?"}
            </h2>
            <p className="mt-1 text-sm opacity-75">
              {daily.xp > 0
                ? `${daily.xp} XP gagnés aujourd’hui`
                : "Une courte session, puis c’est fait."}
            </p>
          </div>
        </div>
        {todayItems.length > 0 ? (
          <Link
            to="/revue"
            search={{ mode: "today" }}
            className={buttonVariants({ className: "mt-4 w-full bg-bg text-fg hover:bg-bg/90" })}
          >
            {daily.answered > 0
              ? "Continuer la session"
              : `Commencer · ${todayItems.length} questions`}
            <ChevronRight className="size-4" />
          </Link>
        ) : (
          <Link
            to="/parcours"
            className={buttonVariants({ className: "mt-4 w-full bg-bg text-fg hover:bg-bg/90" })}
          >
            Explorer un Deck
          </Link>
        )}
      </section>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <StatChip
          icon={<Flame className="size-4 text-primary" />}
          label="Série"
          value={`${streak} j`}
        />
        <StatChip
          icon={<Zap className="size-4 text-primary" />}
          label="Aujourd’hui"
          value={`${daily.xp} XP`}
        />
        <StatChip
          icon={<Sparkles className="size-4 text-primary" />}
          label="Niveau"
          value={`${lvl.level}`}
        />
      </div>

      {featured ? (
        <section className="mt-7">
          <SectionTitle
            kicker="Prochaine étape"
            title={resumed ? "Reprendre votre Deck" : "Deck conseillé"}
            action={
              <Link to="/parcours" className="text-sm text-muted hover:text-fg">
                Tout voir
              </Link>
            }
          />
          <Link
            to="/parcours/$deckId"
            params={{ deckId: featured.id }}
            className="optimus-interactive-card group block rounded-[var(--radius-xl)] bg-card p-4 shadow-[var(--shadow-border)]"
          >
            <span className="flex items-center gap-4">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-primary-soft text-primary shadow-[var(--shadow-border)]">
                <DeckIcon name={featured.icon} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate font-medium">{featured.title}</span>
                  <span className="optimus-status-pill shrink-0 bg-primary-soft text-primary">
                    {featuredProgress >= 100
                      ? "Terminé"
                      : featuredProgress > 0
                        ? "En cours"
                        : "Conseillé"}
                  </span>
                </span>
                <span className="mt-0.5 block truncate text-sm text-muted">
                  {featured.subtitle}
                </span>
              </span>
              <ChevronRight className="size-5 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
            </span>
            <span className="mt-4 flex items-center gap-3">
              <Progress
                className="h-1.5 flex-1"
                value={featuredProgress}
                barClassName="optimus-progress-fill"
              />
              <span className="font-mono text-xs tabular-nums text-muted">{featuredProgress}%</span>
            </span>
          </Link>
        </section>
      ) : null}

      <section className="mt-8">
        <SectionTitle kicker="Accès rapide" title="Que voulez-vous faire ?" />
        <div className="grid grid-cols-2 gap-3">
          <QuickAction
            to="/revue"
            icon={<RotateCcw className="size-5" />}
            label="Réviser"
            detail={`${dueCount} carte${dueCount > 1 ? "s" : ""} due${dueCount > 1 ? "s" : ""}`}
          />
          <QuickAction
            to="/cas"
            icon={<Sparkles className="size-5" />}
            label="Cas cliniques"
            detail={`${CLINICAL_CASES.length} dossiers`}
          />
          <QuickAction
            to="/examen"
            icon={<ClipboardCheck className="size-5" />}
            label="Examen blanc"
            detail="Se tester"
          />
          <QuickAction
            to="/calculateurs"
            icon={<Calculator className="size-5" />}
            label="Calculateurs"
            detail="Outils cliniques"
          />
        </div>
      </section>

      <section className="mt-8">
        <SectionTitle kicker="Progression" title="Votre niveau clinique" />
        <div className="rounded-[var(--radius-xl)] bg-card p-4 shadow-[var(--shadow-border)]">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">
              Niveau {lvl.level} · {lvl.title}
            </span>
            <span className="font-mono text-xs tabular-nums text-muted">{formatInt(xp)} XP</span>
          </div>
          <Progress className="mt-2" value={lvl.progress} barClassName="optimus-progress-fill" />
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-muted">Maîtrise globale</span>
            <span className="font-mono tabular-nums">{mastery}%</span>
          </div>
          <Progress
            className="mt-2"
            value={mastery}
            barClassName="optimus-progress-fill bg-fg/70"
          />

          {mastery > 0 && weak && strong ? (
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-[var(--radius-md)] bg-secondary p-3">
                <p className="text-[11px] uppercase tracking-wider text-muted">À renforcer</p>
                <p className="mt-1 truncate text-sm font-medium">{weak.label}</p>
              </div>
              <div className="rounded-[var(--radius-md)] bg-secondary p-3">
                <p className="text-[11px] uppercase tracking-wider text-muted">Point fort</p>
                <p className="mt-1 truncate text-sm font-medium">{strong.label}</p>
              </div>
            </div>
          ) : (
            <p className="mt-4 rounded-[var(--radius-md)] bg-secondary p-3 text-sm text-muted">
              Votre profil de maîtrise apparaîtra après votre première session.
            </p>
          )}
        </div>
      </section>

      <section className="mt-8">
        <SectionTitle kicker="Plus" title="Outils et accès" />
        <div className="flex flex-wrap gap-2">
          <Link to="/classement" className={buttonVariants({ variant: "secondary", size: "sm" })}>
            <Trophy className="size-4" />
            Classement
          </Link>
          <Link to="/import" className={buttonVariants({ variant: "secondary", size: "sm" })}>
            <Upload className="size-4" />
            Importer un Deck
          </Link>
          {decks.some((d) => !hasAccess(d, entitlements, profile.tier)) ? (
            <Link to="/pro" className={buttonVariants({ variant: "secondary", size: "sm" })}>
              <Lock className="size-4" />
              Offres Premium
            </Link>
          ) : null}
        </div>
      </section>
    </Page>
  );
}

const YEARS_SHORT: Record<number, string> = {
  1: "1re année",
  2: "2e année",
  3: "3e année",
  4: "4e année",
  5: "5e année",
  6: "6e année",
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0 || name === "Invité") return "O";
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function QuickAction({
  to,
  icon,
  label,
  detail,
}: {
  to: "/revue" | "/cas" | "/examen" | "/calculateurs";
  icon: ReactNode;
  label: string;
  detail: string;
}) {
  return (
    <Link
      to={to}
      className="optimus-interactive-card min-w-0 rounded-[var(--radius-xl)] bg-card p-4 shadow-[var(--shadow-border)] active:scale-[0.99]"
    >
      <span className="flex size-10 items-center justify-center rounded-[var(--radius-sm)] bg-secondary text-primary shadow-[var(--shadow-border)]">
        {icon}
      </span>
      <span className="mt-3 block truncate text-sm font-medium">{label}</span>
      <span className="mt-0.5 block truncate text-xs text-muted">{detail}</span>
    </Link>
  );
}

function StatChip({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-[var(--radius-lg)] bg-card px-2.5 py-3 shadow-[var(--shadow-border)] sm:px-3">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-soft">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="truncate text-[10px] font-medium uppercase tracking-wider text-muted sm:text-[11px]">
          {label}
        </p>
        <p className="truncate font-mono text-sm tabular-nums">{value}</p>
      </div>
    </div>
  );
}

function DailyProgress({
  value,
  answered,
  goal,
}: {
  value: number;
  answered: number;
  goal: number;
}) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div
      className="relative size-[4.5rem] shrink-0"
      role="progressbar"
      aria-label="Objectif quotidien"
      aria-valuemin={0}
      aria-valuemax={goal}
      aria-valuenow={Math.min(answered, goal)}
    >
      <svg className="size-full -rotate-90" viewBox="0 0 72 72" aria-hidden="true">
        <circle
          cx="36"
          cy="36"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          className="opacity-20"
        />
        <circle
          cx="36"
          cy="36"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="optimus-progress-fill"
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <strong className="font-display text-xl font-medium">{answered}</strong>
        <span className="mt-1 text-[11px] opacity-70">sur {goal}</span>
      </span>
    </div>
  );
}

function HomeSkeleton() {
  return (
    <div className="min-h-dvh bg-bg" aria-busy="true" aria-label="Chargement d’Optimus">
      <div className="mx-auto max-w-2xl px-5 py-6">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="optimus-skeleton h-3 w-20 rounded-full" />
            <div className="optimus-skeleton h-8 w-48 rounded-[var(--radius-sm)]" />
            <div className="optimus-skeleton h-4 w-36 rounded-full" />
          </div>
          <div className="optimus-skeleton size-12 rounded-[var(--radius-md)]" />
        </div>
        <div className="optimus-skeleton mt-6 h-44 rounded-[var(--radius-xl)]" />
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="optimus-skeleton h-16 rounded-[var(--radius-lg)]" />
          <div className="optimus-skeleton h-16 rounded-[var(--radius-lg)]" />
          <div className="optimus-skeleton h-16 rounded-[var(--radius-lg)]" />
        </div>
        <div className="optimus-skeleton mt-8 h-28 rounded-[var(--radius-xl)]" />
        <span className="sr-only">Chargement de votre progression…</span>
      </div>
    </div>
  );
}
