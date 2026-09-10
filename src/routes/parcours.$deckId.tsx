import type { ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  BrainCircuit,
  Check,
  Lock,
  Play,
  RotateCcw,
  Target,
} from "lucide-react";
import { ContentTrustCard } from "@/components/content-trust";
import { DeckIcon } from "@/components/deck-icon";
import { Page, SectionTitle, Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { YEARS } from "@/content/catalog";
import { LESSONS } from "@/core/quiz-engine";
import { deckMastery, deckProgressPct, masteryBand } from "@/core/mastery";
import { COMPETENCY_LABEL } from "@/core/types";
import { hasAccess, useAllDecks, useOptimus } from "@/state/store";

export const Route = createFileRoute("/parcours/$deckId")({ component: DeckPage });

function DeckPage() {
  const { deckId } = Route.useParams();
  const decks = useAllDecks();
  const deck = decks.find((item) => item.id === deckId);
  const progress = useOptimus((state) => state.progress[deckId]);
  const entitlements = useOptimus((state) => state.entitlements);
  const tier = useOptimus((state) => state.profile.tier);

  if (!deck) {
    return (
      <Shell title="Deck">
        <Page>
          <p className="text-sm text-muted">Deck introuvable.</p>
        </Page>
      </Shell>
    );
  }

  const open = hasAccess(deck, entitlements, tier);
  const progression = deckProgressPct(deck, progress);
  const mastery = deckMastery(deck, progress);
  const completedLessons = progress?.completedLessons ?? [];
  const nextLesson = LESSONS.find((lesson) => !completedLessons.includes(lesson.index));
  const allLessonsDone = nextLesson === undefined;
  const learningGoals =
    deck.chapters.length > 0
      ? deck.chapters.map((chapter) => chapter.title)
      : deck.competencies.map((competency) => COMPETENCY_LABEL[competency]);

  return (
    <Shell title={deck.title}>
      <Page>
        <Link
          to="/parcours"
          className="inline-flex items-center gap-2 text-sm text-muted hover:text-fg"
        >
          <ArrowLeft className="size-4" />
          Tous les parcours
        </Link>

        <section className="premium-hero relative mt-4 overflow-hidden rounded-[var(--radius-xl)] p-5 text-primary-fg shadow-[var(--shadow-md)] md:p-7">
          <span className="pointer-events-none absolute -right-8 -top-8 opacity-[0.08]" aria-hidden>
            <DeckIcon name={deck.icon} className="size-44" />
          </span>

          <div className="relative flex items-start gap-4">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-[18px] bg-bg/90 text-primary shadow-[var(--shadow-soft)]">
              <DeckIcon name={deck.icon} className="size-7" />
            </span>
            <div className="min-w-0 pt-0.5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] opacity-70">
                {deck.specialty}
              </p>
              <h1 className="mt-1 font-display text-3xl font-medium tracking-tight md:text-4xl">
                {deck.title}
              </h1>
              <p className="mt-1 text-sm leading-relaxed opacity-75">{deck.subtitle}</p>
            </div>
          </div>

          <div className="relative mt-5 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-current/10 bg-bg/15 px-3 py-1.5">
              {yearLabel(deck.studyYear)}
            </span>
            <span className="rounded-full border border-current/10 bg-bg/15 px-3 py-1.5">
              {deck.questions.length} questions
            </span>
            <span className="rounded-full border border-current/10 bg-bg/15 px-3 py-1.5">
              {LESSONS.length} étapes
            </span>
          </div>

          {open ? (
            <div className="relative mt-5">
              <div className="grid grid-cols-3 gap-2">
                <DeckMetric
                  icon={<BookOpenCheck className="size-4" />}
                  value={`${progression}%`}
                  label="Parcouru"
                />
                <DeckMetric
                  icon={<BrainCircuit className="size-4" />}
                  value={`${mastery}%`}
                  label={masteryBand(mastery).label}
                />
                <DeckMetric
                  icon={<Target className="size-4" />}
                  value={`${completedLessons.length}/${LESSONS.length}`}
                  label="Étapes"
                />
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <Link
                  to="/learn/$deckId"
                  params={{ deckId: deck.id }}
                  search={
                    allLessonsDone
                      ? { lesson: 0, preview: false, mode: "revue" }
                      : { lesson: nextLesson.index, preview: false, mode: "lesson" }
                  }
                  className={progression > 0 ? "block" : "block sm:col-span-2"}
                >
                  <Button size="lg" className="w-full bg-bg text-fg hover:bg-bg/90">
                    <Play className="size-4 fill-current" />
                    {allLessonsDone
                      ? "Réviser ce Deck"
                      : progression > 0
                        ? `Reprendre · Étape ${nextLesson.index + 1}`
                        : "Commencer ce Deck"}
                  </Button>
                </Link>
                {progression > 0 ? (
                  <Link
                    to="/learn/$deckId"
                    params={{ deckId: deck.id }}
                    search={{ lesson: 0, preview: false, mode: "revue" }}
                    className="block"
                  >
                    <Button size="lg" variant="secondary" className="w-full">
                      <RotateCcw className="size-4" />
                      Réviser mes erreurs
                    </Button>
                  </Link>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="relative mt-5 rounded-[var(--radius-lg)] border border-current/10 bg-bg/15 p-4 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Lock className="size-4 text-primary" />
                Deck Premium
              </div>
              <p className="mt-2 text-sm opacity-75">
                Essayez gratuitement 3 questions avant de choisir votre accès.
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <Link
                  to="/learn/$deckId"
                  params={{ deckId: deck.id }}
                  search={{ lesson: 0, preview: true, mode: "preview" }}
                  className="block"
                >
                  <Button className="w-full bg-bg text-fg hover:bg-bg/90">Essayer l’aperçu</Button>
                </Link>
                <Link to="/pro" className="block">
                  <Button variant="secondary" className="w-full">
                    Voir les offres · dès 3 000 Ar
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </section>

        <section className="mt-8">
          <SectionTitle kicker="Programme" title="Ce que vous allez apprendre" />
          <div className="flex flex-wrap gap-2">
            {learningGoals.map((goal) => (
              <span
                key={goal}
                className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-2 text-sm"
              >
                <Check className="size-3.5 text-primary" />
                {goal}
              </span>
            ))}
          </div>
        </section>

        <section className="mt-8">
          <SectionTitle kicker={`${LESSONS.length} étapes`} title="Avancer pas à pas" />
          <ol className="relative space-y-3 before:absolute before:bottom-6 before:left-[1.125rem] before:top-6 before:w-px before:bg-border-strong">
            {LESSONS.map((lesson) => {
              const done = completedLessons.includes(lesson.index);
              const isNext = nextLesson?.index === lesson.index;
              const content = (
                <>
                  <span
                    className={`flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-medium ${
                      done
                        ? "bg-primary text-primary-fg"
                        : isNext && open
                          ? "bg-primary-soft text-primary"
                          : "bg-secondary text-muted"
                    }`}
                  >
                    {done ? <Check className="size-4" /> : lesson.index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{lesson.title}</span>
                    <span className="mt-0.5 block text-xs text-muted">{lesson.detail}</span>
                  </span>
                  <span className="shrink-0 text-[11px] font-medium uppercase tracking-wider text-subtle">
                    {!open ? "Inclus" : done ? "Terminé" : isNext ? "À suivre" : "À venir"}
                  </span>
                  {open ? <ArrowRight className="size-4 shrink-0 text-subtle" /> : null}
                </>
              );

              return (
                <li key={lesson.index}>
                  {open ? (
                    <Link
                      to="/learn/$deckId"
                      params={{ deckId: deck.id }}
                      search={{ lesson: lesson.index, preview: false, mode: "lesson" }}
                      className={`relative flex items-center gap-3 rounded-[var(--radius-lg)] p-4 transition-all hover:-translate-y-0.5 ${
                        isNext
                          ? "bg-primary-soft shadow-[var(--shadow-md)] ring-1 ring-primary/25"
                          : "bg-card shadow-[var(--shadow-border)] hover:bg-secondary"
                      }`}
                    >
                      {content}
                    </Link>
                  ) : (
                    <div className="flex items-center gap-3 rounded-[var(--radius-lg)] bg-card p-4 shadow-[var(--shadow-border)]">
                      {content}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </section>

        <ContentTrustCard
          sources={deck.sources}
          report={{
            contentType: "deck",
            contentId: deck.id,
            deckId: deck.id,
            deckVersion: deck.version,
            label: `${deck.title} — ${deck.subtitle}`,
          }}
        />
      </Page>
    </Shell>
  );
}

function yearLabel(year: number): string {
  return YEARS.find((item) => item.year === year)?.label ?? "Tous niveaux";
}

function DeckMetric({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-current/10 bg-bg/15 p-3 backdrop-blur-sm">
      <span className="opacity-70">{icon}</span>
      <p className="mt-2 font-display text-xl font-medium leading-none">{value}</p>
      <p className="mt-1 truncate text-[11px] opacity-65">{label}</p>
    </div>
  );
}
