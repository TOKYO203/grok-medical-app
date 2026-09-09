import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check, Lock, Play } from "lucide-react";
import { DeckIcon } from "@/components/deck-icon";
import { Page, SectionTitle, Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { YEARS } from "@/content/catalog";
import { LESSONS } from "@/core/quiz-engine";
import { deckMastery, deckProgressPct } from "@/core/mastery";
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

        <section className="mt-4 rounded-[var(--radius-xl)] bg-card p-5 shadow-[var(--shadow-border)]">
          <div className="flex items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-primary-soft text-primary">
              <DeckIcon name={deck.icon} className="size-6" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-primary">
                {deck.specialty}
              </p>
              <h1 className="mt-1 font-display text-3xl font-medium tracking-tight">
                {deck.title}
              </h1>
              <p className="mt-1 text-sm text-muted">{deck.subtitle}</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted">
            <span className="rounded-full bg-secondary px-3 py-1.5">
              {yearLabel(deck.studyYear)}
            </span>
            <span className="rounded-full bg-secondary px-3 py-1.5">
              {deck.questions.length} questions
            </span>
            <span className="rounded-full bg-secondary px-3 py-1.5">{LESSONS.length} étapes</span>
          </div>

          {open ? (
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
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
                <Button size="lg" className="w-full">
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
                    Réviser mes erreurs
                  </Button>
                </Link>
              ) : null}
            </div>
          ) : (
            <div className="mt-5 rounded-[var(--radius-lg)] bg-secondary p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Lock className="size-4 text-primary" />
                Deck Premium
              </div>
              <p className="mt-2 text-sm text-muted">
                Essayez gratuitement 3 questions avant de choisir votre accès.
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <Link
                  to="/learn/$deckId"
                  params={{ deckId: deck.id }}
                  search={{ lesson: 0, preview: true, mode: "preview" }}
                  className="block"
                >
                  <Button className="w-full">Essayer l’aperçu</Button>
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

        {open ? (
          <section className="mt-8">
            <SectionTitle kicker="Résultats" title="Votre progression" />
            <div className="rounded-[var(--radius-xl)] bg-card p-4 shadow-[var(--shadow-border)]">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">Questions découvertes</span>
                <span className="font-mono tabular-nums">{progression}%</span>
              </div>
              <Progress className="mt-2" value={progression} />
              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="text-muted">Maîtrise estimée</span>
                <span className="font-mono tabular-nums">{mastery}%</span>
              </div>
              <Progress className="mt-2" value={mastery} barClassName="bg-fg/70" />
            </div>
          </section>
        ) : null}

        <section className="mt-8">
          <SectionTitle kicker={`${LESSONS.length} étapes`} title="Avancer pas à pas" />
          <ol className="space-y-2">
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
                      className="flex items-center gap-3 rounded-[var(--radius-lg)] bg-card p-4 shadow-[var(--shadow-border)] transition-colors hover:bg-secondary"
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

        {deck.sources.length > 0 ? (
          <details className="mt-8 rounded-[var(--radius-lg)] bg-secondary p-4">
            <summary className="cursor-pointer text-sm font-medium">
              Sources médicales vérifiées ({deck.sources.length})
            </summary>
            <ul className="mt-3 space-y-2">
              {deck.sources.map((source, index) => (
                <li key={index} className="text-xs leading-relaxed text-muted">
                  <span className="font-medium text-fg/80">{source.title}</span> — {source.citation}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </Page>
    </Shell>
  );
}

function yearLabel(year: number): string {
  return YEARS.find((item) => item.year === year)?.label ?? "Tous niveaux";
}
