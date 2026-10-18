import type { ReactNode } from "react";
import { useEffect, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Calculator, ChevronRight, ClipboardCheck, Flame, Lock, Sparkles, Upload, Zap, Activity, Brain, Stethoscope } from "lucide-react";
import { Onboarding } from "@/components/onboarding";
import { DeckIcon } from "@/components/deck-icon";
import PwaInstallCard from "@/components/pwa-install-card";
import { LevelBar } from "@/components/level-bar";
import { ContentCard } from "@/components/content/content-card";
import { UserAvatar } from "@/components/user-avatar";
import { Page, SectionTitle, Shell } from "@/components/shell";
import { ResumeWhereCard } from "@/components/resume-where-card";
import { buttonVariants } from "@/components/ui/button-variants";
import { Progress } from "@/components/ui/progress";
import { BUILTIN_DECKS, CLINICAL_CASES } from "@/content/catalog";
import { COMPETENCIES, COMPETENCY_LABEL, STUDY_LEVEL_LABEL } from "@/core/types";
import { competencyMastery, deckProgressPct, globalMastery, masteryBand } from "@/core/mastery";
import { pickTodayQuestions } from "@/core/quiz-engine";
import { isDue } from "@/core/spaced-repetition";
import { levelInfo } from "@/core/scoring";
import { buildContentIndex, caseAccessible } from "@/lib/library/content-index";
import { useI18n } from "@/i18n";
import { seedBuiltinDecks } from "@/state/builtin-decks";
import { currentLeague, hasAccess, useAllDecks, useOptimus } from "@/state/store";
import { formatInt } from "@/lib/utils";

// G51 — code-splitting : le store ne charge plus le catalogue ; cette route
// sème le cache des decks intégrés (évalué côté serveur comme côté client).
seedBuiltinDecks(BUILTIN_DECKS);

/**
 * Drapeau produit de la tuile « Signes & Syndromes ».
 *
 * Le module existe et fonctionne (raisonnement inversé sur des actifs
 * statiques). Tant que la banque n'est pas jugée présentable, la tuile reste
 * VISIBLE mais DÉSACTIVÉE (badge « Bientôt », aucun clic) : on annonce la
 * fonction sans envoyer l'étudiant sur une démo. Passer ce drapeau à `true`
 * rend la carte cliquable — la route /signes, elle, est déjà fonctionnelle.
 */
const SIGNES_READY = true;

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const { t } = useI18n();
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
    <Shell title={t("dash.today")}>
      <Dashboard />
    </Shell>
  );
}

function Dashboard() {
  const { t } = useI18n();
  const profile = useOptimus((s) => s.profile);
  const xp = useOptimus((s) => s.xp);
  const streak = useOptimus((s) => s.streak);
  const daily = useOptimus((s) => s.daily);
  const weeklyXp = useOptimus((s) => s.weeklyXp);
  const progress = useOptimus((s) => s.progress);
  const entitlements = useOptimus((s) => s.entitlements);
  const badges = useOptimus((s) => s.badges);
  const decks = useAllDecks();
  const unlocked = decks.filter((d) => hasAccess(d, entitlements, profile.tier));
  const lvl = levelInfo(xp);
  const league = currentLeague(weeklyXp);
  const mastery = globalMastery(unlocked, progress);
  const band = masteryBand(mastery);
  // Session 11 — teaser « Garde de 7 jours » : prévenir avant le but, pas après.
  const streakToGo = !badges.includes("streak7") && streak >= 5 && streak < 7 ? 7 - streak : 0;
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
  const freeCasesCount = CLINICAL_CASES.filter((clinical) =>
    caseAccessible(clinical, entitlements),
  ).length;
  const dailyGoal = 10;
  const dailyPct = Math.min(100, Math.round((daily.answered / dailyGoal) * 100));
  const remaining = Math.max(0, dailyGoal - daily.answered);

  const index = useMemo(
    () => buildContentIndex({ decks, entitlements, tier: profile.tier, includeTools: false }),
    [decks, entitlements, profile.tier],
  );
  const progressById = useMemo(() => {
    const map = new Map<string, number>();
    for (const deck of decks) {
      const pct = deckProgressPct(deck, progress[deck.id]);
      if (pct > 0) map.set(`deck:${deck.id}`, pct);
    }
    return map;
  }, [decks, progress]);

  const deckRail = useMemo(() => {
    const rows = index.filter((i) => i.kind === "deck" && !i.locked);
    const priorityNames = profile.prioritySubjects.map((s) => s.toLowerCase());
    return rows
      .map((item) => {
        let score = progressById.get(item.id) ? 1 : 0;
        if (priorityNames.some((p) => item.specialty.toLowerCase().includes(p))) score += 2;
        if (profile.studyYear > 0 && item.year === profile.studyYear) score += 2;
        if (profile.studyYear > 0 && item.year !== null && item.year !== profile.studyYear) {
          score -= Math.abs(item.year - profile.studyYear);
        }
        return { item, score };
      })
      .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title))
      .slice(0, 3)
      .map((row) => row.item);
  }, [index, progressById, profile.prioritySubjects, profile.studyYear]);

  const caseRail = useMemo(() => index.filter((i) => i.kind === "case").slice(0, 3), [index]);

  const yearDeck =
    profile.studyYear > 0
      ? unlocked.find((deck) => deck.studyYear === profile.studyYear)
      : undefined;
  const featured = resumed ?? priority[0] ?? yearDeck ?? unlocked[0];
  const featuredProgress = featured ? deckProgressPct(featured, progress[featured.id]) : 0;

  return (
    <Page>
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p
            className="optimus-kicker text-[11px] font-medium uppercase tracking-[0.16em]"
            title={profile.tier === "guest" ? undefined : t("dash.idTooltip")}
          >
            {profile.tier === "guest" ? t("dash.new") : profile.optimusId}
          </p>
          <h1 className="mt-1 truncate font-display text-3xl font-medium tracking-tight">
            {t("dash.hello", {
              name:
                profile.displayName && profile.displayName !== "Nouveau"
                  ? profile.displayName
                  : "",
            })}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {(profile.studyLevel && STUDY_LEVEL_LABEL[profile.studyLevel]) ??
              t("dash.yearShort", { year: profile.studyYear })}
            {t("dash.levelSep")}
            {band.label}
            {t("dash.levelSep")}
            {t("dash.league", { label: league.label })}
          </p>
        </div>
        <Link
          to="/profil"
          aria-label={t("dash.openProfile")}
          className="optimus-interactive-card flex size-12 shrink-0 items-center justify-center rounded-[var(--radius-md)] shadow-[var(--shadow-border)]"
        >
          <UserAvatar className="size-full rounded-[var(--radius-md)]" iconClassName="size-6" />
        </Link>
      </header>

      <LevelBar />

      {/* Action principale du jour */}
      <section className="premium-hero mt-5 overflow-hidden rounded-[var(--radius-xl)] p-5 text-primary-fg shadow-[var(--shadow-md)]">
        <div className="flex items-center gap-5">
          <DailyProgress value={dailyPct} answered={daily.answered} goal={dailyGoal} />
          <div className="min-w-0 flex-1">
            <p className="optimus-kicker--hero text-xs font-medium uppercase tracking-[0.14em] opacity-75">
              {t("dash.sessionToday")}
            </p>
            <h2 className="mt-1 font-display text-2xl font-medium tracking-tight">
              {remaining === 0
                ? t("dash.goalReached")
                : daily.answered > 0
                  ? t("dash.questionsLeft", { count: remaining })
                  : t("dash.ready")}
            </h2>
            <p className="mt-1 text-sm opacity-75">
              {daily.xp > 0 ? t("dash.xpToday", { xp: daily.xp }) : t("dash.noXpYet")}
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
              ? t("dash.continueSession")
              : t("dash.startWith", { count: todayItems.length })}
            <ChevronRight className="size-4" />
          </Link>
        ) : (
          <Link
            to="/bibliotheque"
            className={buttonVariants({ className: "mt-4 w-full bg-bg text-fg hover:bg-bg/90" })}
          >
            {t("dash.exploreLibrary")}
          </Link>
        )}
      </section>

      {/* Reprendre où vous étiez (Session 10 — UX navigation) */}
      <ResumeWhereCard />

      <div className="mt-3 grid grid-cols-1 gap-2 min-[560px]:grid-cols-3">
        <StatChip
          icon={<Flame className="size-4 text-primary" />}
          label={t("dash.streak")}
          value={`${streak} j`}
        />
        <StatChip
          icon={<Zap className="size-4 text-primary" />}
          label={t("dash.todayLabel")}
          value={`${daily.xp} XP`}
        />
        <StatChip
          icon={<Sparkles className="size-4 text-primary" />}
          label={t("dash.level")}
          value={`${lvl.level}`}
        />
      </div>

      {featured ? (
        <section className="mt-7">
          <SectionTitle
            kicker={t("dash.nextStep")}
            title={resumed ? t("dash.resumeDeck") : t("dash.suggestedDeck")}
            action={
              <Link to="/bibliotheque" className="text-sm text-muted hover:text-accent">
                {t("dash.viewAll")}
              </Link>
            }
          />
          <Link
            to="/parcours/$deckId"
            params={{ deckId: featured.id }}
            className="optimus-card optimus-interactive-card group block p-4"
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
                      ? t("dash.done")
                      : featuredProgress > 0
                        ? t("dash.inProgress")
                        : t("dash.recommended")}
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
              <span className="optimus-kpi font-mono text-xs tabular-nums">{featuredProgress}%</span>
            </span>
          </Link>
        </section>
      ) : null}

      {/* Rails de contenu */}
      <section className="mt-8">
        <SectionTitle
          kicker={t("dash.forYou")}
          title={t("dash.recommendedDecks")}
          action={
            <Link to="/bibliotheque" className="text-sm text-muted hover:text-accent">
              {t("nav.library")}
            </Link>
          }
        />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {deckRail.map((item) => (
            <ContentCard key={item.id} item={item} progress={progressById.get(item.id)} />
          ))}
        </div>
      </section>

      <section className="mt-8">
        <SectionTitle
          kicker={t("dash.reasoning")}
          title={t("dash.clinicalCases")}
          action={
            <Link to="/cas" className="text-sm text-muted hover:text-accent">
              {t("dash.allCases")}
            </Link>
          }
        />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {caseRail.map((item) => (
            <ContentCard key={item.id} item={item} />
          ))}
        </div>
      </section>

      {/* Accès rapide */}
      <section className="mt-8">
        <SectionTitle kicker={t("dash.quickAccess")} title={t("dash.tools")} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <QuickAction
            to="/revue"
            icon={<DeckIcon name="book" />}
            label={t("nav.review")}
            detail={t("dash.cardsDue", { count: dueCount })}
          />
          <QuickAction
            to="/examen"
            icon={<ClipboardCheck className="size-5" />}
            label={t("nav.mockExam")}
            detail={t("dash.testYourself")}
          />
          <QuickAction
            to="/calculateurs"
            icon={<Calculator className="size-5" />}
            label={t("nav.calculators")}
            detail={t("dash.clinicalTools")}
          />
          <QuickAction
            to="/ecg"
            icon={<Activity className="size-5" />}
            label="ECG"
            detail={t("dash.interpretation")}
          />
          <QuickAction
            to="/auscultation"
            icon={<Stethoscope className="size-5" />}
            label={t("nav.auscultation")}
            detail={t("dash.cardioPulmo")}
          />
          <QuickAction
            to="/signes"
            icon={<Brain className="size-5" />}
            label={t("nav.signes")}
            detail={t("dash.signesDetail")}
            signesState={SIGNES_READY ? "ready" : "soon"}
            soonLabel={t("dash.soon")}
          />
        </div>
      </section>

      <section className="mt-8">
        {/* streak-dashboard */}
        <section className="mb-4 flex items-center gap-3 rounded-[var(--radius-lg)] bg-card p-3 shadow-[var(--shadow-border)]">
          <span className="flex size-10 items-center justify-center rounded-full bg-warn/15 text-warn">
            <Flame className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="optimus-kicker text-[11px] font-medium uppercase tracking-[0.16em]">
              {t("dash.dailyStreak")}
            </p>
            <p className="mt-0.5 text-sm font-medium">
              {streak > 0 ? t("dash.streakDays", { count: streak }) : t("dash.startStreak")}
            </p>
            {streakToGo > 0 ? (
              <p className="mt-1 text-xs text-warn">{t("dash.streakTeaser", { days: streakToGo })}</p>
            ) : null}
          </div>
          <span className="optimus-kpi font-mono text-xs tabular-nums">
            {t("dash.streakBonus")}
          </span>
        </section>

        <SectionTitle kicker={t("dash.progression")} title={t("dash.clinicalLevel")} />
        <div className="optimus-card p-4">
          {/* Session 11 — indicateur unique : la maîtrise globale porte la barre,
              le niveau/XP devient une lecture secondaire sans barre dédiée. */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">{t("dash.globalMastery")}</span>
            <span className="optimus-kpi font-mono tabular-nums">{mastery}%</span>
          </div>
          <Progress
            className="mt-2"
            value={mastery}
            barClassName="optimus-progress-fill bg-fg/70"
          />
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-muted">
              {t("dash.levelWithTitle", { level: lvl.level, title: lvl.title })}
            </span>
            <span className="optimus-kpi font-mono text-xs tabular-nums">{formatInt(xp)} XP</span>
          </div>

          {mastery > 0 && weak && strong ? (
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-[var(--radius-md)] bg-secondary p-3">
                <p className="optimus-kicker text-[11px] uppercase tracking-wider">
                  {t("dash.toStrengthen")}
                </p>
                <p className="mt-1 truncate text-sm font-medium">{weak.label}</p>
              </div>
              <div className="rounded-[var(--radius-md)] bg-secondary p-3">
                <p className="optimus-kicker text-[11px] uppercase tracking-wider">
                  {t("dash.strongPoint")}
                </p>
                <p className="mt-1 truncate text-sm font-medium">{strong.label}</p>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-[var(--radius-md)] bg-secondary p-3 text-sm text-muted">
              {t("dash.masteryPending")}
              <div className="mt-3">
                {todayItems.length > 0 ? (
                  <Link
                    to="/revue"
                    search={{ mode: "today" }}
                    className={buttonVariants({ variant: "default", size: "sm" })}
                  >
                    {t("dash.startFirstSession")}
                  </Link>
                ) : (
                  <Link
                    to="/bibliotheque"
                    className={buttonVariants({ variant: "default", size: "sm" })}
                  >
                    {t("dash.exploreLibrary")}
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="mt-8">
        <SectionTitle kicker={t("dash.more")} title={t("dash.toolsAccess")} />
        <div className="flex flex-wrap gap-2">
          <Link to="/revue" className={buttonVariants({ variant: "secondary", size: "sm" })}>
            <DeckIcon name="book" />
            {t("nav.review")} {dueCount > 0 ? `(${dueCount})` : ""}
          </Link>
          <Link to="/import" className={buttonVariants({ variant: "secondary", size: "sm" })}>
            <Upload className="size-4" />
            {t("nav.importDeck")}
          </Link>
          <Link to="/cas" className={buttonVariants({ variant: "secondary", size: "sm" })}>
            <Sparkles className="size-4" />
            {t("dash.clinicalCases")} ({CLINICAL_CASES.length} ·{" "}
            {t("dash.freeCases", { count: freeCasesCount })})
          </Link>
          {decks.some((d) => !hasAccess(d, entitlements, profile.tier)) ? (
            <Link to="/pro" className={buttonVariants({ variant: "secondary", size: "sm" })}>
              <Lock className="size-4" />
              {t("dash.premiumOffers")}
            </Link>
          ) : null}
        </div>
      </section>

      {/* Comparateur Gratuit vs Premium (vague business) */}
      <section className="mt-8">
        <SectionTitle title={t("dash.compareTitle")} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="optimus-card p-4">
            <p className="optimus-kicker text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
              {t("dash.compareFree")}
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">
              {t("dash.compareFreeLine")}
            </p>
          </div>
          <div className="premium-hero rounded-[var(--radius-xl)] p-4 text-primary-fg shadow-[var(--shadow-md)]">
            <p className="optimus-kicker--hero text-[11px] font-medium uppercase tracking-[0.16em] opacity-75">
              {t("dash.comparePremium")}
            </p>
            <p className="mt-1.5 text-sm leading-relaxed opacity-80">
              {t("dash.comparePremiumLine")}
            </p>
          </div>
        </div>
        <Link
          to="/tarifs"
          className={buttonVariants({ variant: "secondary", size: "sm", className: "mt-3" })}
        >
          {t("dash.compareCta")}
          <ChevronRight className="size-4" />
        </Link>
      </section>

      <div className="mt-8">
        <PwaInstallCard />
      </div>
    </Page>
  );
}

function QuickAction({
  to,
  icon,
  label,
  detail,
  signesState,
  soonLabel,
}: {
  to: "/revue" | "/ecg" | "/auscultation" | "/cas" | "/examen" | "/calculateurs" | "/classement" | "/signes";
  icon: ReactNode;
  label: string;
  detail: string;
  /**
   * Une tuile annoncée mais pas encore ouverte : on la garde dans la grille
   * (l'utilisateur voit la fonction arriver) sans lien cliquable. Le clic ne
   * peut RIEN faire, par construction : ce n'est pas un <Link>.
   */
  signesState?: "soon" | "ready";
  soonLabel?: string;
}) {
  const body = (
    <>
      <span className="flex size-10 items-center justify-center rounded-[var(--radius-sm)] bg-secondary text-primary shadow-[var(--shadow-border)]">
        {icon}
      </span>
      <span className="mt-3 block truncate text-sm font-medium">{label}</span>
      <span className="mt-0.5 block truncate text-xs text-muted">{detail}</span>
    </>
  );

  if (signesState === "soon") {
    return (
      <div
        data-signes-card="soon"
        aria-disabled="true"
        className="optimus-card relative min-w-0 cursor-not-allowed select-none p-4 opacity-60 saturate-0"
      >
        <span className="absolute right-2.5 top-2.5 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
          {soonLabel}
        </span>
        {body}
      </div>
    );
  }

  return (
    <Link to={to} data-signes-card={signesState} className="optimus-card optimus-interactive-card min-w-0 p-4 active:scale-[0.99]">
      {body}
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
        <p className="optimus-kicker truncate text-[11px] font-medium uppercase tracking-wider">
          {label}
        </p>
        <p className="optimus-kpi truncate font-mono text-sm tabular-nums">{value}</p>
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
  const { t } = useI18n();
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div
      className="relative size-[4.5rem] shrink-0"
      role="progressbar"
      aria-label={t("dash.dailyGoalAria", { answered, goal })}
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
        <strong className="font-display text-xl font-medium">{answered}/{goal}</strong>
        <span className="mt-1 text-[11px] opacity-70">{t("dash.questionsUnit")}</span>
      </span>
    </div>
  );
}

function HomeSkeleton() {
  const { t } = useI18n();
  return (
    <div className="min-h-dvh bg-bg" aria-busy="true" aria-label={t("dash.skeletonLoading")}>
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
        <span className="sr-only">{t("dash.skeletonSr")}</span>
      </div>
    </div>
  );
}
