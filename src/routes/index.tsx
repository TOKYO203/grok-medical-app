import type { ReactNode } from "react";
import { useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Flame, Lock, RotateCcw, Sparkles, Zap } from "lucide-react";
import { Onboarding } from "@/components/onboarding";
import { DeckIcon } from "@/components/deck-icon";
import { Page, SectionTitle, Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CLINICAL_CASES } from "@/content/catalog";
import { COMPETENCIES, COMPETENCY_LABEL } from "@/core/types";
import { competencyMastery, globalMastery, masteryBand } from "@/core/mastery";
import { pickTodayQuestions } from "@/core/quiz-engine";
import { isDue } from "@/core/spaced-repetition";
import { levelInfo } from "@/core/scoring";
import { currentLeague, hasAccess, useAllDecks, useOptimus } from "@/state/store";
import { formatInt } from "@/lib/utils";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const onboarded = useOptimus((s) => s.profile.onboarded);
  const hydrated = useOptimus((s) => s.hydrated);
  const markHydrated = useOptimus((s) => s.markHydrated);
  useEffect(() => {
    const t = window.setTimeout(() => markHydrated(), 80);
    return () => window.clearTimeout(t);
  }, [markHydrated]);
  if (!hydrated) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg text-muted">
        <p className="text-sm">Optimus</p>
      </div>
    );
  }
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
  const featured = priority[0] ?? unlocked[0];
  const dailyGoal = 10;
  const dailyPct = Math.min(100, Math.round((daily.answered / dailyGoal) * 100));

  return (
    <Page>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
            {profile.tier === "guest" ? "Invité" : profile.optimusId}
          </p>
          <h1 className="mt-1 font-display text-3xl font-medium tracking-tight">
            Bonjour{profile.displayName && profile.displayName !== "Invité" ? `, ${profile.displayName}` : ""}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {YEARS_SHORT[profile.studyYear] ?? "Cursus"} · {band.label} · ligue {league.label}
          </p>
        </div>
        <Link
          to="/profil"
          className="flex size-12 items-center justify-center rounded-[var(--radius-md)] bg-primary-soft font-display text-lg text-primary"
        >
          {initials(profile.displayName)}
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-2">
        <StatChip icon={<Flame className="size-4 text-primary" />} label="Série" value={String(streak)} />
        <StatChip icon={<Zap className="size-4 text-primary" />} label="XP" value={formatInt(xp)} />
        <StatChip icon={<Sparkles className="size-4 text-primary" />} label="Niv." value={`${lvl.level}`} />
      </div>

      <div className="mt-3 rounded-[var(--radius-xl)] bg-card p-4 shadow-[var(--shadow-border)]">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">
            Niveau {lvl.level} · {lvl.title}
          </span>
          <span className="font-mono text-xs tabular-nums text-muted">
            {lvl.xpInto}/{lvl.xpForNext}
          </span>
        </div>
        <Progress className="mt-2" value={lvl.progress} />
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-muted">Mastery globale</span>
          <span className="font-mono tabular-nums">{mastery}%</span>
        </div>
        <Progress className="mt-2" value={mastery} barClassName="bg-fg/70" />
      </div>

      <div className="mt-8">
        <SectionTitle kicker="Aujourd’hui" title="Questions du jour" />
        <div className="rounded-[var(--radius-xl)] bg-card p-4 shadow-[var(--shadow-border)]">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted">
              {daily.answered}/{dailyGoal} · {daily.xp} XP
            </p>
            <span className="text-xs text-subtle">Objectif quotidien</span>
          </div>
          <Progress className="mt-3" value={dailyPct} />
          <Link to="/revue" search={{ mode: "today" }} className="mt-4 block">
            <Button className="w-full" disabled={todayItems.length === 0}>
              {todayItems.length === 0 ? "Rien de dû — explorer un deck" : `Session adaptative · ${todayItems.length} items`}
            </Button>
          </Link>
        </div>
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <Link
          to="/revue"
          className="flex items-center justify-between rounded-[var(--radius-xl)] bg-card p-4 shadow-[var(--shadow-border)]"
        >
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Révisions</p>
            <p className="mt-1 font-display text-2xl tabular-nums">{dueCount}</p>
            <p className="text-sm text-muted">cartes dues</p>
          </div>
          <RotateCcw className="size-5 text-primary" />
        </Link>
        <Link
          to="/cas"
          className="flex items-center justify-between rounded-[var(--radius-xl)] bg-card p-4 shadow-[var(--shadow-border)]"
        >
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Cas cliniques</p>
            <p className="mt-1 font-display text-2xl tabular-nums">{CLINICAL_CASES.length}</p>
            <p className="text-sm text-muted">dossiers à raisonner</p>
          </div>
          <Sparkles className="size-5 text-primary" />
        </Link>
      </div>

      {weak && strong ? (
        <div className="mt-8">
          <SectionTitle kicker="Compétences" title="Forces et faiblesses" />
          <div className="space-y-2">
            {comps.map((c) => (
              <div key={c.id} className="flex items-center gap-3">
                <p className="w-32 shrink-0 text-sm text-muted">{c.label}</p>
                <Progress className="flex-1" value={c.score} />
                <span className="w-10 text-right font-mono text-xs tabular-nums text-muted">{c.score}</span>
              </div>
            ))}
          </div>
          {weak.score < 70 && featured ? (
            <div className="mt-4 rounded-[var(--radius-lg)] bg-secondary p-4">
              <p className="text-sm font-medium">Mission du jour</p>
              <p className="mt-1 text-sm text-muted">
                Point faible : {weak.label.toLowerCase()}. Une session ciblée sur {featured.title}.
              </p>
              <Link
                to="/learn/$deckId"
                params={{ deckId: featured.id }}
                search={{ lesson: 3 }}
                className="mt-3 inline-block"
              >
                <Button size="sm">Lancer la mission</Button>
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-8">
        <SectionTitle
          kicker="Parcours"
          title="Continuer"
          action={
            <Link to="/parcours" className="text-sm text-muted hover:text-fg">
              Tous
            </Link>
          }
        />
        <div className="grid gap-2 sm:grid-cols-2">
          {unlocked.slice(0, 4).map((d) => (
            <Link
              key={d.id}
              to="/parcours/$deckId"
              params={{ deckId: d.id }}
              className="flex items-center gap-3 rounded-[var(--radius-lg)] bg-card p-3 shadow-[var(--shadow-border)]"
            >
              <span className="flex size-10 items-center justify-center rounded-[var(--radius-sm)] bg-secondary text-primary">
                <DeckIcon name={d.icon} />
              </span>
              <span className="min-w-0">
                <p className="truncate text-sm font-medium">{d.title}</p>
                <p className="truncate text-xs text-muted">{d.subtitle}</p>
              </span>
            </Link>
          ))}
          {decks.some((d) => !hasAccess(d, entitlements, profile.tier)) ? (
            <Link
              to="/pro"
              className="flex items-center gap-3 rounded-[var(--radius-lg)] bg-card p-3 text-muted shadow-[var(--shadow-border)]"
            >
              <span className="flex size-10 items-center justify-center rounded-[var(--radius-sm)] bg-secondary">
                <Lock className="size-4" />
              </span>
              <span>
                <p className="text-sm font-medium text-fg">Decks Pro</p>
                <p className="text-xs">Cardiologie, cas avancés, examens blancs</p>
              </span>
            </Link>
          ) : null}
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-2">
        <Link to="/examen">
          <Button variant="secondary" size="sm">
            Examen blanc
          </Button>
        </Link>
        <Link to="/calculateurs">
          <Button variant="secondary" size="sm">
            Calculateurs
          </Button>
        </Link>
        <Link to="/classement">
          <Button variant="secondary" size="sm">
            Classement
          </Button>
        </Link>
        <Link to="/import">
          <Button variant="secondary" size="sm">
            Importer un deck
          </Button>
        </Link>
      </div>
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

function StatChip({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-[var(--radius-lg)] bg-card px-3 py-3 shadow-[var(--shadow-border)]">
      {icon}
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted">{label}</p>
        <p className="truncate font-mono text-sm tabular-nums">{value}</p>
      </div>
    </div>
  );
}
