import { useMemo, useState } from "react";
import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, Clock3, Lock, Search } from "lucide-react";
import { Page, Shell } from "@/components/shell";
import diagnosticTopics from "@/content/data/diagnostic-topics.json";
import { DIAGNOSTIC_CASES } from "@/content/catalog";
import { useOptimus } from "@/state/store";

export const Route = createFileRoute("/demarche")({
  component: DemarchePage,
});

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function DemarchePage() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const dxDone = useOptimus((s) => s.diagnosticsCompleted);
  const [query, setQuery] = useState("");

  const visibleTopics = useMemo(() => {
    const q = normalize(query.trim());
    return diagnosticTopics.filter((t) => {
      if (!q) return true;
      return (
        normalize(t.title).includes(q) ||
        normalize(t.specialty).includes(q) ||
        String(t.number).includes(q)
      );
    });
  }, [query]);

  const available = diagnosticTopics.filter((t) => t.routeId).length;
  const total = diagnosticTopics.length;

  // /demarche est le layout parent de /demarche/$id : on laisse l'enfant prendre la main.
  if (pathname !== "/demarche" && pathname !== "/demarche/") {
    return <Outlet />;
  }

  return (
    <Shell title="Orientation diagnostique">
      <Page className="mx-auto max-w-3xl">
        <div className="mb-6">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
            Programme internat
          </p>
          <h1 className="mt-1 font-display text-2xl font-medium tracking-tight">
            Orientation diagnostique
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Du symptôme à la prise en charge, décision par décision. Catalogue des chapitres du
            programme d'orientation diagnostique.
          </p>
          <p className="mt-2 font-mono text-xs tabular-nums text-subtle">
            {available}/{total} chapitres disponibles
          </p>
        </div>

        <label className="relative mb-4 block">
          <Search
            className="pointer-events-none absolute left-3 top-3.5 size-4 text-subtle"
            aria-hidden
          />
          <span className="sr-only">Rechercher une démarche</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher : dyspnée, hématurie, grossesse…"
            className="h-11 w-full rounded-[var(--radius-md)] bg-card pl-10 pr-3 text-sm shadow-[var(--shadow-border)] outline-none transition-shadow placeholder:text-subtle focus-visible:ring-2 focus-visible:ring-ring/70"
          />
        </label>

        <div className="grid gap-2 sm:grid-cols-2">
          {visibleTopics.map((topic) => {
            const dx = topic.routeId
              ? DIAGNOSTIC_CASES.find((d) => d.id === topic.routeId)
              : undefined;
            const completed = dx ? dxDone.includes(dx.id) : false;

            const inner = (
              <>
                <span
                  className={`flex size-9 shrink-0 items-center justify-center rounded-full font-mono text-xs shadow-[var(--shadow-border)] ${
                    completed ? "bg-primary text-primary-fg" : "bg-secondary text-muted"
                  }`}
                >
                  {completed ? <CheckCircle2 className="size-4" /> : topic.number}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-2">
                    <span className="block text-sm font-medium leading-snug">{topic.title}</span>
                    {completed ? (
                      <span className="optimus-status-pill shrink-0 bg-primary-soft text-primary">
                        Terminé
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-1 block text-xs text-muted">{topic.specialty}</span>
                  <span className="mt-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-primary">
                    {dx ? (
                      <>
                        {completed ? (
                          <CheckCircle2 className="size-3" />
                        ) : (
                          <Lock className="size-3" />
                        )}
                        {completed ? "Revoir la démarche" : "Aperçu disponible"}
                      </>
                    ) : (
                      <>
                        <Clock3 className="size-3" />
                        En préparation
                      </>
                    )}
                  </span>
                </span>
                {dx ? <ArrowRight className="size-4 shrink-0 text-subtle" /> : null}
              </>
            );

            return dx ? (
              <Link
                key={topic.id}
                to="/demarche/$id"
                params={{ id: dx.id }}
                className="optimus-card optimus-interactive-card flex min-h-28 touch-manipulation items-start gap-3 p-4 active:scale-[0.99]"
              >
                {inner}
              </Link>
            ) : (
              <div
                key={topic.id}
                className="optimus-card flex min-h-28 items-start gap-3 p-4 opacity-70"
              >
                {inner}
              </div>
            );
          })}
        </div>

        {visibleTopics.length === 0 ? (
          <div className="mt-10 rounded-[var(--radius-lg)] bg-card p-6 text-center shadow-[var(--shadow-border)]">
            <p className="text-sm text-muted">Aucun résultat pour « {query} »</p>
            <button
              type="button"
              onClick={() => setQuery("")}
              className="mt-3 text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Réinitialiser
            </button>
          </div>
        ) : null}
      </Page>
    </Shell>
  );
}
