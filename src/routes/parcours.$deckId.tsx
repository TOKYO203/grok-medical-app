import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Lock } from "lucide-react";
import { DeckIcon } from "@/components/deck-icon";
import { Page, Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { LESSONS } from "@/core/quiz-engine";
import { deckMastery, deckProgressPct } from "@/core/mastery";
import { hasAccess, useAllDecks, useOptimus } from "@/state/store";

export const Route = createFileRoute("/parcours/$deckId")({ component: DeckPage });

function DeckPage() {
  const { deckId } = Route.useParams();
  const decks = useAllDecks();
  const deck = decks.find((d) => d.id === deckId);
  const progress = useOptimus((s) => s.progress[deckId]);
  const entitlements = useOptimus((s) => s.entitlements);
  const tier = useOptimus((s) => s.profile.tier);

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
  const prog = deckProgressPct(deck, progress);
  const mast = deckMastery(deck, progress);

  return (
    <Shell title={deck.title}>
      <Page>
        <Link to="/parcours" className="inline-flex items-center gap-2 text-sm text-muted hover:text-fg">
          <ArrowLeft className="size-4" />
          Parcours
        </Link>
        <div className="mt-4 flex items-start gap-3">
          <span className="flex size-12 items-center justify-center rounded-[var(--radius-md)] bg-secondary text-primary">
            <DeckIcon name={deck.icon} className="size-6" />
          </span>
          <div>
            <h1 className="font-display text-3xl font-medium tracking-tight">{deck.title}</h1>
            <p className="mt-1 text-sm text-muted">
              {deck.subtitle} · {deck.studyYear}e année · v{deck.version}
            </p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-[var(--radius-lg)] bg-card p-3 shadow-[var(--shadow-border)]">
            <p className="text-xs text-muted">Progression</p>
            <p className="font-display text-2xl tabular-nums">{prog}%</p>
            <Progress className="mt-2" value={prog} />
          </div>
          <div className="rounded-[var(--radius-lg)] bg-card p-3 shadow-[var(--shadow-border)]">
            <p className="text-xs text-muted">Mastery</p>
            <p className="font-display text-2xl tabular-nums">{mast}%</p>
            <Progress className="mt-2" value={mast} barClassName="bg-fg/70" />
          </div>
        </div>
        {!open ? (
          <div className="mt-6 rounded-[var(--radius-xl)] bg-secondary p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Lock className="size-4" /> Deck Pro
            </div>
            <p className="mt-2 text-sm text-muted">
              Aperçu de 3 questions, puis entitlement {deck.access_policy.entitlement}. Pas de blocage artificiel du
              hors-ligne une fois le droit acquis.
            </p>
            <div className="mt-3 flex gap-2">
              <Link to="/learn/$deckId" params={{ deckId: deck.id }} search={{ lesson: 0, preview: true }}>
                <Button size="sm">Aperçu</Button>
              </Link>
              <Link to="/pro">
                <Button size="sm" variant="secondary">
                  Optimus Pro
                </Button>
              </Link>
            </div>
          </div>
        ) : null}
        <h2 className="mt-8 font-display text-xl font-medium tracking-tight">Leçons</h2>
        <ol className="mt-3 space-y-2">
          {LESSONS.map((l) => {
            const done = progress?.completedLessons.includes(l.index);
            return (
              <li key={l.index}>
                <Link
                  to="/learn/$deckId"
                  params={{ deckId: deck.id }}
                  search={{ lesson: l.index, preview: !open }}
                  className="flex items-start justify-between gap-3 rounded-[var(--radius-lg)] bg-card p-4 shadow-[var(--shadow-border)]"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {l.index + 1}. {l.title}
                    </p>
                    <p className="mt-1 text-xs text-muted">{l.detail}</p>
                  </div>
                  <span className="text-[11px] uppercase tracking-wider text-subtle">{done ? "vu" : "nouveau"}</span>
                </Link>
              </li>
            );
          })}
        </ol>
        <div className="mt-4 flex gap-2">
          <Link to="/learn/$deckId" params={{ deckId: deck.id }} search={{ lesson: 0, preview: !open, mode: "revue" }}>
            <Button variant="secondary" size="sm">
              Réviser les erreurs
            </Button>
          </Link>
        </div>
        {deck.sources.length > 0 ? (
          <div className="mt-8">
            <h2 className="font-display text-lg font-medium">Sources</h2>
            <ul className="mt-2 space-y-1">
              {deck.sources.map((s, i) => (
                <li key={i} className="text-xs text-muted">
                  <span className="text-fg/80">{s.title}</span> — {s.citation}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Page>
    </Shell>
  );
}
