import { createFileRoute, Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { DeckIcon } from "@/components/deck-icon";
import { Page, Shell } from "@/components/shell";
import { Progress } from "@/components/ui/progress";
import { YEARS } from "@/content/catalog";
import { deckMastery, deckProgressPct } from "@/core/mastery";
import { hasAccess, useAllDecks, useOptimus } from "@/state/store";

export const Route = createFileRoute("/parcours")({ component: ParcoursPage });

function ParcoursPage() {
  const decks = useAllDecks();
  const progress = useOptimus((s) => s.progress);
  const entitlements = useOptimus((s) => s.entitlements);
  const tier = useOptimus((s) => s.profile.tier);
  const year = useOptimus((s) => s.profile.studyYear);

  return (
    <Shell title="Parcours">
      <Page>
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Année · matière · deck</p>
        <h1 className="mt-1 font-display text-3xl font-medium tracking-tight">Parcours</h1>
        <p className="mt-2 max-w-lg text-sm text-muted">
          Sémiologie, orientation, diagnostic, prise en charge. La progression compte les cartes vues ; la Mastery, ce que vous retenez.
        </p>
        <div className="mt-8 space-y-8">
          {YEARS.map((y) => {
            const list = decks.filter((d) => d.studyYear === y.year);
            if (list.length === 0) return null;
            const highlight = y.year === year;
            return (
              <section key={y.year}>
                <div className="mb-3 flex items-baseline justify-between">
                  <h2 className="font-display text-xl font-medium tracking-tight">
                    {y.label}
                    {highlight ? <span className="ml-2 text-sm text-primary">votre année</span> : null}
                  </h2>
                  <p className="text-xs text-muted">{y.focus}</p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {list.map((d) => {
                    const open = hasAccess(d, entitlements, tier);
                    const prog = deckProgressPct(d, progress[d.id]);
                    const mast = deckMastery(d, progress[d.id]);
                    return (
                      <Link
                        key={d.id}
                        to="/parcours/$deckId"
                        params={{ deckId: d.id }}
                        className="rounded-[var(--radius-xl)] bg-card p-4 shadow-[var(--shadow-border)]"
                      >
                        <div className="flex items-start gap-3">
                          <span className="flex size-10 items-center justify-center rounded-[var(--radius-sm)] bg-secondary text-primary">
                            {open ? <DeckIcon name={d.icon} /> : <Lock className="size-4" />}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium">{d.title}</p>
                            <p className="truncate text-xs text-muted">{d.subtitle}</p>
                            <p className="mt-1 text-[11px] uppercase tracking-wider text-subtle">
                              {open ? d.access_policy.tier : "Pro"} · {d.questions.length} Q
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-[11px] text-muted">Progression {prog}%</p>
                            <Progress className="mt-1" value={prog} />
                          </div>
                          <div>
                            <p className="text-[11px] text-muted">Mastery {mast}%</p>
                            <Progress className="mt-1" value={mast} barClassName="bg-fg/70" />
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </Page>
    </Shell>
  );
}
