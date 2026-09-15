import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, Layers3, Lock, PlayCircle } from "lucide-react";
import { DeckIcon } from "@/components/deck-icon";
import { Page, SectionTitle, Shell } from "@/components/shell";
import { buttonVariants } from "@/components/ui/button-variants";
import { Progress } from "@/components/ui/progress";
import { YEARS } from "@/content/catalog";
import { deckMastery, deckProgressPct } from "@/core/mastery";
import { STUDY_LEVEL_LABEL } from "@/core/types";
import { hasAccess, useAllDecks, useOptimus } from "@/state/store";

export const Route = createFileRoute("/parcours")({ component: ParcoursPage });

function ParcoursPage() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const decks = useAllDecks();
  const progress = useOptimus((s) => s.progress);
  const entitlements = useOptimus((s) => s.entitlements);
  const profile = useOptimus((s) => s.profile);

  if (pathname !== "/parcours" && pathname !== "/parcours/") {
    return <Outlet />;
  }

  const available = decks
    .filter((deck) => hasAccess(deck, entitlements, profile.tier))
    .sort((a, b) => relevance(b) - relevance(a) || a.title.localeCompare(b.title));
  const premium = decks.filter((deck) => !hasAccess(deck, entitlements, profile.tier));
  const started = available
    .filter((deck) => {
      const value = deckProgressPct(deck, progress[deck.id]);
      return value > 0 && value < 100;
    })
    .sort((a, b) => deckProgressPct(b, progress[b.id]) - deckProgressPct(a, progress[a.id]));
  const completed = available.filter((deck) => deckProgressPct(deck, progress[deck.id]) >= 100);
  const current = started[0] ?? available[0];
  const currentProgress = current ? deckProgressPct(current, progress[current.id]) : 0;
  const currentMastery = current ? deckMastery(current, progress[current.id]) : 0;
  const studyLabel =
    (profile.studyLevel && STUDY_LEVEL_LABEL[profile.studyLevel]) ?? yearLabel(profile.studyYear);

  function relevance(deck: (typeof decks)[number]) {
    const priority = profile.prioritySubjects.some(
      (subject) =>
        deck.subject.toLowerCase().includes(subject.toLowerCase()) ||
        deck.title.toLowerCase().includes(subject.toLowerCase()),
    );
    return (
      (priority ? 3 : 0) + (profile.studyYear > 0 && deck.studyYear === profile.studyYear ? 2 : 0)
    );
  }

  return (
    <Shell title="Parcours">
      <Page>
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
          Votre apprentissage
        </p>
        <h1 className="mt-1 font-display text-3xl font-medium tracking-tight">Parcours</h1>
        <p className="mt-2 max-w-lg text-sm text-muted">
          Une suggestion pour {studyLabel.toLowerCase()}, puis toutes les spécialités disponibles.
        </p>

        <div className="mt-5 grid grid-cols-3 gap-2" aria-label="Résumé des parcours">
          <SummaryChip label="Disponibles" value={available.length} />
          <SummaryChip label="En cours" value={started.length} accent />
          <SummaryChip label="Terminés" value={completed.length} />
        </div>

        {current ? (
          <section className="mt-8">
            <SectionTitle
              kicker={currentProgress > 0 ? "En cours" : "Recommandé pour vous"}
              title={currentProgress > 0 ? "Reprendre où vous étiez" : "Bien commencer"}
            />
            <Link
              to="/parcours/$deckId"
              params={{ deckId: current.id }}
              className="optimus-interactive-card block rounded-[var(--radius-xl)] bg-primary-soft p-5 shadow-[var(--shadow-border)] active:scale-[0.99]"
            >
              <div className="flex items-start gap-4">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-primary text-primary-fg shadow-[var(--shadow-border)]">
                  <DeckIcon name={current.icon} className="size-6" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="block font-display text-2xl font-medium tracking-tight">
                      {current.title}
                    </span>
                    <DeckStatus progress={currentProgress} />
                  </span>
                  <span className="mt-1 block text-sm text-muted">{current.subtitle}</span>
                  <span className="mt-2 block text-[11px] font-medium uppercase tracking-wider text-primary">
                    {yearLabel(current.studyYear)} · {current.questions.length} questions
                  </span>
                </span>
              </div>
              <div className="mt-5 flex items-center justify-between text-xs text-muted">
                <span>Progression {currentProgress}%</span>
                <span>Maîtrise {currentMastery}%</span>
              </div>
              <Progress
                className="mt-2 bg-bg/50"
                value={currentProgress}
                barClassName="optimus-progress-fill"
              />
              <span className="mt-4 flex items-center justify-between rounded-[var(--radius-md)] bg-primary px-4 py-3 text-sm font-medium text-primary-fg">
                {currentProgress > 0 ? "Reprendre ce Deck" : "Commencer ce Deck"}
                <ArrowRight className="size-4" />
              </span>
            </Link>
          </section>
        ) : null}

        <section className="mt-10">
          <SectionTitle
            kicker="Spécialités"
            title="Explorer les Decks"
            action={<span className="text-xs text-muted">{available.length} disponibles</span>}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            {available
              .filter((deck) => deck.id !== current?.id)
              .map((deck) => {
                const deckProgress = deckProgressPct(deck, progress[deck.id]);
                const mastery = deckMastery(deck, progress[deck.id]);
                return (
                  <Link
                    key={deck.id}
                    to="/parcours/$deckId"
                    params={{ deckId: deck.id }}
                    className="optimus-interactive-card min-w-0 touch-manipulation rounded-[var(--radius-xl)] bg-card p-4 shadow-[var(--shadow-border)] active:scale-[0.99]"
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-secondary text-primary shadow-[var(--shadow-border)]">
                        <DeckIcon name={deck.icon} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="block truncate font-medium">{deck.title}</span>
                          <DeckStatus progress={deckProgress} compact />
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-muted">
                          {deck.subtitle}
                        </span>
                        <span className="mt-2 block text-[11px] uppercase tracking-wider text-subtle">
                          {yearLabel(deck.studyYear)} · {deck.questions.length} questions
                        </span>
                      </span>
                      <ArrowRight className="mt-1 size-4 shrink-0 text-subtle" />
                    </div>
                    {deckProgress > 0 ? (
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-[11px] text-muted">
                          <span>Progression {deckProgress}%</span>
                          <span>Maîtrise {mastery}%</span>
                        </div>
                        <Progress
                          className="mt-1.5"
                          value={deckProgress}
                          barClassName="optimus-progress-fill"
                        />
                      </div>
                    ) : (
                      <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-primary">
                        <PlayCircle className="size-3.5" /> Nouveau Deck
                      </p>
                    )}
                  </Link>
                );
              })}
          </div>
        </section>

        {premium.length > 0 ? (
          <section className="mt-10">
            <SectionTitle kicker="Premium" title="Aller plus loin" />
            <div className="premium-hero overflow-hidden rounded-[var(--radius-xl)] p-5 text-primary-fg shadow-[var(--shadow-md)]">
              <div className="flex items-start gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-bg/20 text-primary-fg shadow-[var(--shadow-border)]">
                  <Layers3 className="size-5" />
                </span>
                <div>
                  <h3 className="font-display text-xl font-medium tracking-tight">
                    Une spécialité, étape par étape
                  </h3>
                  <p className="mt-1 text-sm opacity-80">
                    1 Deck à 3 000 Ar ou les 10 Decks progressifs à 27 000 Ar.
                  </p>
                </div>
              </div>
              <Link
                to="/pro"
                className={buttonVariants({ className: "mt-4 w-full bg-bg text-fg hover:bg-bg/90" })}
              >
                Voir les offres Premium
              </Link>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {premium.map((deck) => (
                <Link
                  key={deck.id}
                  to="/parcours/$deckId"
                  params={{ deckId: deck.id }}
                  className="optimus-interactive-card min-w-0 touch-manipulation flex items-start gap-3 rounded-[var(--radius-xl)] bg-card p-4 shadow-[var(--shadow-border)] active:scale-[0.99]"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-secondary text-muted shadow-[var(--shadow-border)]">
                    <Lock className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="block truncate font-medium">{deck.title}</span>
                      <span className="optimus-status-pill shrink-0 bg-secondary text-muted">Premium</span>
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted">
                      {deck.subtitle}
                    </span>
                    <span className="mt-2 block text-[11px] font-medium uppercase tracking-wider text-primary">
                      Aperçu disponible
                    </span>
                  </span>
                  <ArrowRight className="mt-1 size-4 shrink-0 text-subtle" />
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </Page>
    </Shell>
  );
}

function SummaryChip({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return (
    <div
      className={`rounded-[var(--radius-lg)] px-3 py-3 text-center shadow-[var(--shadow-border)] ${
        accent ? "bg-primary-soft" : "bg-card"
      }`}
    >
      <p className={`font-display text-xl font-medium ${accent ? "text-primary" : "text-fg"}`}>
        {value}
      </p>
      <p className="mt-0.5 truncate text-[10px] font-medium uppercase tracking-wider text-muted sm:text-[11px]">
        {label}
      </p>
    </div>
  );
}

function DeckStatus({ progress, compact = false }: { progress: number; compact?: boolean }) {
  const completed = progress >= 100;
  const started = progress > 0 && !completed;
  const label = completed ? "Terminé" : started ? "En cours" : "Nouveau";
  return (
    <span
      className={`optimus-status-pill shrink-0 ${
        completed
          ? "bg-primary-soft text-primary"
          : started
            ? "bg-warn/15 text-warn"
            : "bg-secondary text-muted"
      } ${compact ? "hidden sm:inline-flex" : ""}`}
    >
      {completed ? <CheckCircle2 className="mr-1 size-3" /> : null}
      {label}
    </span>
  );
}

function yearLabel(year: number): string {
  return YEARS.find((item) => item.year === year)?.label ?? "Tous niveaux";
}
