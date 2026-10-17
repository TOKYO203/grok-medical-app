/**
 * `/sujet` — hub des carrefours.
 *
 * Pourquoi cette page existe : le dépôt contenait déjà 46 decks, 1 démarche
 * enrichie, 5 cas, 23 ECG, 10 sons et 78 scores, mais chaque nature vivait dans
 * sa propre route. L'étudiant qui voulait « travailler le SCA » devait deviner
 * qu'il existait aussi un cas clinique, deux tracés et trois scores de risque.
 * Un **sujet** est la réponse à « tout ce qui traite cette maladie ».
 *
 * ⚠️ Cette route est le PARENT de `/sujet/$slug` : elle doit rendre `<Outlet/>`
 * dès que le chemin n'est plus exactement `/sujet`. Sans ce garde, la page
 * détail ne s'affiche jamais (le layout rend le hub à sa place) — c'est le
 * piège déjà rencontré sur `/cas`, `/demarche` et `/ecg`.
 */

import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Page, PageHeader, SectionTitle, Shell } from "@/components/shell";
import { listCurricula } from "@/content/curriculum";
import { ScrollToTopButton } from "@/components/scroll-to-top";
import { specialtyEmoji } from "@/lib/library/specialty-helpers";
import {
  listSujets,
  sujetContentCount,
  sujetHubStats,
  sujetsBySpecialty,
  type Sujet,
} from "@/content/data/sujets";

export const Route = createFileRoute("/sujet")({ component: SujetHubPage });

/**
 * Decks du curriculum qu'aucun sujet ne revendique encore.
 *
 * Compté (et non écrit en dur) : ajouter ou retirer un deck d'une branche doit
 * mettre la phrase à jour tout seul, sinon le hub annonce un chiffre faux.
 */
function unlinkedDeckCount(): number {
  const claimed = new Set(listSujets().flatMap((sujet) => sujet.decks));
  const all = listCurricula().flatMap((specialty) =>
    specialty.branches.flatMap((branch) => branch.decks),
  );
  return all.filter((deckId) => !claimed.has(deckId)).length;
}

/** Pastilles de contenu : natures présentes pour ce sujet, avec leur compte. */
function contentPills(sujet: Sujet): { key: string; label: string; count: number }[] {
  return [
    { key: "decks", label: "decks", count: sujet.decks.length },
    { key: "cases", label: "cas", count: sujet.cases.length },
    { key: "demarches", label: "démarche", count: sujet.demarches.length },
    { key: "ecg", label: "ECG", count: sujet.ecg.length },
    { key: "sons", label: "son", count: sujet.auscultation.length },
    { key: "scores", label: "score", count: sujet.calculateurs.length },
  ].filter((pill) => pill.count > 0);
}

/** « 10 decks transversaux » / « 1 deck transversal » — accord complet. */
function unlinkedLabel(count: number): string {
  return count > 1 ? `${count} decks transversaux` : `${count} deck transversal`;
}

function SujetHubPage() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const groups = sujetsBySpecialty();
  const stats = sujetHubStats();
  const unlinked = unlinkedDeckCount();

  // Route parente : le détail `/sujet/<slug>` doit rendre son propre écran.
  if (pathname !== "/sujet" && pathname !== "/sujet/") {
    return <Outlet />;
  }

  return (
    <Shell title="Sujets">
      <Page className="mx-auto max-w-5xl">
        <ScrollToTopButton />
        <PageHeader
          kicker="Carrefours"
          title="Sujets"
          description="Un sujet rassemble tout ce qui traite la même maladie : les cinq strates de decks, le cas clinique, le tracé ECG, le son, les scores. On ne cherche plus six fois la même chose."
        />

        <div className="mt-5 grid grid-cols-3 gap-2" aria-label="Contenus reliés par sujet">
          <Stat label="Sujets" value={stats.sujets} />
          <Stat label="Decks reliés" value={stats.decks} accent />
          <Stat label="Contenus croisés" value={stats.linked} />
        </div>

        <p className="mt-3 text-xs leading-relaxed text-muted">
          {stats.items} items du référentiel national sont rattachés à ces sujets — {stats.decks}{" "}
          decks, {stats.linked} contenus croisés.
        </p>

        {groups.map((group) => (
          <section key={group.specialty} className="mt-8" data-sujet-group={group.specialty}>
            <SectionTitle
              kicker="Spécialité"
              title={`${specialtyEmoji(group.specialty)} ${group.specialty}`}
              action={
                <span className="font-mono text-[11px] tabular-nums text-subtle">
                  {group.sujets.length}
                </span>
              }
            />
            <div className="grid gap-3 sm:grid-cols-2">
              {group.sujets.map((sujet) => (
                <Link
                  key={sujet.slug}
                  to="/sujet/$slug"
                  params={{ slug: sujet.slug }}
                  data-sujet-card={sujet.slug}
                  className="optimus-card optimus-interactive-card optimus-interactive-card--premium group flex h-full flex-col p-4 focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:outline-none"
                >
                  <div className="flex items-start gap-3">
                    <span className="optimus-card-icon optimus-card-icon--gold flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-lg shadow-[var(--shadow-border)]">
                      <span aria-hidden>{specialtyEmoji(sujet.specialty)}</span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-display text-lg font-medium leading-snug tracking-tight text-fg">
                        {sujet.label}
                      </h3>
                      <p className="mt-0.5 text-xs text-muted">
                        {sujet.itemsOfficiels.length > 0
                          ? `Item${sujet.itemsOfficiels.length > 1 ? "s" : ""} ${sujet.itemsOfficiels.join(" · ")}`
                          : "Hors référentiel nominal"}
                        {" · "}
                        {sujetContentCount(sujet)} contenus
                      </p>
                    </div>
                    <ArrowRight
                      className="mt-1 size-4 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-fg"
                      aria-hidden
                    />
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {contentPills(sujet).map((pill) => (
                      <span
                        key={pill.key}
                        data-sujet-pill={pill.key}
                        className="optimus-type-badge bg-secondary text-muted"
                      >
                        <span className="font-mono tabular-nums">{pill.count}</span>
                        {pill.label}
                      </span>
                    ))}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}

        <section className="mt-8 rounded-[var(--radius-xl)] bg-card p-5 text-sm leading-relaxed text-muted shadow-[var(--shadow-border)]">
          <h2 className="font-display text-base font-medium text-fg">Et les autres decks ?</h2>
          <p className="mt-1">
            {unlinkedLabel(unlinked)} (anatomie, physiologie, sémiologie, pharmaco, médecine
            tropicale…) ne {unlinked > 1 ? "sont" : "est"} pas encore rattaché
            {unlinked > 1 ? "s" : ""} à un sujet : {unlinked > 1 ? "leur" : "son"} découpage
            éditorial reste{unlinked > 1 ? "nt" : ""} à valider.
            {unlinked > 1 ? " Ils restent accessibles" : " Il reste accessible"} depuis la{" "}
            <Link to="/bibliotheque" className="font-medium text-primary underline-offset-2 hover:underline">
              bibliothèque
            </Link>{" "}
            et le{" "}
            <Link to="/parcours" className="font-medium text-primary underline-offset-2 hover:underline">
              parcours
            </Link>
            .
          </p>
        </section>
      </Page>
    </Shell>
  );
}

function Stat({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-[var(--radius-lg)] bg-card px-3 py-2.5 shadow-[var(--shadow-border)]">
      <p
        className={
          accent
            ? "font-display text-xl font-medium tabular-nums text-primary"
            : "font-display text-xl font-medium tabular-nums text-fg"
        }
      >
        {value}
      </p>
      <p className="mt-0.5 text-[11px] uppercase tracking-[0.12em] text-subtle">{label}</p>
    </div>
  );
}
