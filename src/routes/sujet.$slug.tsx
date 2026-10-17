/**
 * `/sujet/$slug` — la page carrefour d'un sujet.
 *
 * Elle répond à une seule question : « tout ce qui traite cette maladie, où
 * est-ce ? » — et le répond dans l'ordre où l'étudiant travaille :
 *
 *   1. le parcours de decks (l'escalier des strates de niveau) ;
 *   2. le cas clinique (le raisonnement) ;
 *   3. la démarche enrichie (la fiche, les flashcards, la carte mentale) ;
 *   4. ce qu'il faut savoir reconnaître (ECG, auscultation) ;
 *   5. ce qu'il faut savoir calculer (scores) ;
 *   6. le rattachement au référentiel officiel (items 1 → 240).
 *
 * Aucun contenu n'est dupliqué ici : chaque bloc est un lien vers la route qui
 * détient la donnée. Le gating Premium est celui de la route cible (les cartes
 * de decks et de cas viennent de `buildContentIndex`, donc elles portent le
 * cadenas et le prix exacts).
 */

import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  AudioWaveform,
  BookMarked,
  Compass,
  Sigma,
  Stethoscope,
} from "lucide-react";
import { ContentCard } from "@/components/content/content-card";
import { DeckSeriesCard, type DeckSeriesStepView } from "@/components/content/deck-series-card";
import { Page, PageHeader, SectionTitle, Shell } from "@/components/shell";
import { ScrollToTopButton } from "@/components/scroll-to-top";
import { getSujet, siblingSujets } from "@/content/data/sujets";
import { BUILTIN_DECKS } from "@/content/catalog";
import { deckProgressPct } from "@/core/mastery";
import { buildContentIndex, type ContentItem } from "@/lib/library/content-index";
import { specialtyEmoji } from "@/lib/library/specialty-helpers";
import { buildSujetContent } from "@/lib/sujets/catalog";
import { seedBuiltinDecks } from "@/state/builtin-decks";
import { useAllDecks, useOptimus } from "@/state/store";
import { cn } from "@/lib/utils";

// G51 — code-splitting : le store ne charge plus le catalogue ; cette route
// sème le cache des decks intégrés (évalué côté serveur comme côté client).
seedBuiltinDecks(BUILTIN_DECKS);

export const Route = createFileRoute("/sujet/$slug")({ component: SujetPage });

/** Habillage commun des lignes de contenu (ECG, son, score). */
const ROW_CLASS =
  "group flex items-center gap-3 rounded-[var(--radius-lg)] bg-card px-4 py-3 shadow-[var(--shadow-border)] transition-colors hover:bg-secondary/50 focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:outline-none";

const ICON_TILE_CLASS =
  "flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-primary-soft text-primary";

function SujetPage() {
  const { slug } = Route.useParams();
  const sujet = getSujet(slug) ?? null;

  const decks = useAllDecks();
  const entitlements = useOptimus((s) => s.entitlements);
  const tier = useOptimus((s) => s.profile.tier);
  const progress = useOptimus((s) => s.progress);

  const content = useMemo(
    () => (sujet ? buildSujetContent(sujet, decks) : null),
    [sujet, decks],
  );

  const items = useMemo(
    () => buildContentIndex({ decks, entitlements, tier }),
    [decks, entitlements, tier],
  );
  const itemById = useMemo(() => {
    const map = new Map<string, ContentItem>();
    for (const item of items) map.set(item.id, item);
    return map;
  }, [items]);

  const progressById = useMemo(() => {
    const map = new Map<string, number>();
    for (const deck of decks) {
      const pct = deckProgressPct(deck, progress[deck.id]);
      if (pct > 0) map.set(`deck:${deck.id}`, pct);
    }
    return map;
  }, [decks, progress]);

  const stepViews: DeckSeriesStepView[] = useMemo(() => {
    if (!content?.series) return [];
    const owned = new Set(content.sujet.decks);
    return content.series.steps
      .filter((step) => owned.has(step.deckId))
      .flatMap((step) => {
        const item = itemById.get(`deck:${step.deckId}`);
        return item ? [{ step, item }] : [];
      });
  }, [content, itemById]);

  if (!sujet || !content) {
    return (
      <Shell title="Sujet introuvable">
        <Page className="mx-auto max-w-2xl">
          <PageHeader
            kicker="Sujets"
            title="Sujet introuvable"
            description={`Aucun sujet ne porte le nom « ${slug} ».`}
          />
          <Link
            to="/sujet"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-fg"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Tous les sujets
          </Link>
        </Page>
      </Shell>
    );
  }

  const { counts } = content;
  const caseItems = content.cases.flatMap((clinical) => {
    const item = itemById.get(`case:${clinical.id}`);
    return item ? [item] : [];
  });
  const singleDeckItems = content.series
    ? []
    : content.decks.flatMap((deck) => {
        const item = itemById.get(`deck:${deck.id}`);
        return item ? [item] : [];
      });
  const neighbours = siblingSujets(sujet);

  return (
    <Shell title={sujet.label}>
      <Page className="mx-auto max-w-5xl">
        <ScrollToTopButton />

        <Link
          to="/sujet"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted transition-colors hover:text-fg"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          Tous les sujets
        </Link>

        <div className="mt-3">
          <PageHeader
            kicker={`Sujet · ${sujet.specialty}`}
            title={sujet.label}
            description={descriptionOf(content.counts, content.questionCount)}
            action={
              <span
                className="optimus-type-badge bg-secondary text-muted"
                data-sujet-total={counts.total}
              >
                <span aria-hidden>{specialtyEmoji(sujet.specialty)}</span>
                {counts.total} contenus
              </span>
            }
          />
        </div>

        <div
          className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4"
          aria-label="Ce que contient ce sujet"
        >
          <Stat label="Decks" value={counts.decks} accent />
          <Stat label="Questions" value={content.questionCount} />
          <Stat label="Contenus liés" value={counts.total - counts.decks} />
          <Stat label="Items officiels" value={counts.officialItems} />
        </div>

        {/* 1 — Le parcours de decks */}
        {content.series && stepViews.length > 0 ? (
          <section className="mt-8" data-sujet-section="decks">
            <SectionTitle
              kicker="Progression"
              title="Le parcours"
              action={
                <span className="text-xs text-muted">
                  {stepViews.length} étapes · {content.questionCount} questions
                </span>
              }
            />
            <DeckSeriesCard
              series={content.series}
              steps={stepViews}
              progressById={progressById}
              className="max-w-2xl"
            />
          </section>
        ) : singleDeckItems.length > 0 ? (
          <section className="mt-8" data-sujet-section="decks">
            <SectionTitle kicker="Progression" title="Le deck" />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {singleDeckItems.map((item) => (
                <ContentCard key={item.id} item={item} progress={progressById.get(item.id)} />
              ))}
            </div>
          </section>
        ) : null}

        {/* 2 — Le cas clinique */}
        {caseItems.length > 0 ? (
          <section className="mt-8" data-sujet-section="cases">
            <SectionTitle
              kicker="Raisonnement"
              title={caseItems.length > 1 ? "Les cas cliniques" : "Le cas clinique"}
            />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {caseItems.map((item) => (
                <ContentCard key={item.id} item={item} />
              ))}
            </div>
          </section>
        ) : null}

        {/* 3 — La démarche enrichie */}
        {content.demarches.length > 0 ? (
          <section className="mt-8" data-sujet-section="demarches">
            <SectionTitle kicker="Méthode" title="La démarche" />
            <div className="grid gap-3">
              {content.demarches.map((demarche) => (
                <Link
                  key={demarche.diagnosticId}
                  to="/demarche/$id"
                  params={{ id: demarche.diagnosticId }}
                  data-sujet-demarche={demarche.diagnosticId}
                  className={ROW_CLASS}
                >
                  <span className={ICON_TILE_CLASS} aria-hidden>
                    <Compass className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-fg">
                      {demarche.title}
                    </span>
                    <span className="block text-xs text-muted">
                      Fiche · mnémoniques · flashcards · carte mentale
                    </span>
                  </span>
                  <ArrowRight
                    className="size-4 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {/* 4 — Reconnaître : ECG + auscultation */}
        {content.ecg.length > 0 || content.sounds.length > 0 ? (
          <section className="mt-8" data-sujet-section="reconnaitre">
            <SectionTitle kicker="Sémiologie" title="À reconnaître" />
            <div className="grid gap-3 lg:grid-cols-2">
              {content.ecg.length > 0 ? (
                <div className="grid gap-2">
                  {content.ecg.map((ecg) => (
                    <Link
                      key={ecg.id}
                      to="/ecg/$id"
                      params={{ id: ecg.id }}
                      data-sujet-ecg={ecg.id}
                      className={ROW_CLASS}
                    >
                      <span className={cn(ICON_TILE_CLASS, "bg-danger/10 text-danger")} aria-hidden>
                        <Activity className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-fg">
                          {ecg.title}
                        </span>
                        <span className="block text-xs text-muted">
                          Tracé ECG · {difficultyLabel(ecg.difficulty)}
                          {ecg.rhythm ? ` · ${ecg.rhythm}` : ""}
                        </span>
                      </span>
                      <ArrowRight
                        className="size-4 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5"
                        aria-hidden
                      />
                    </Link>
                  ))}
                </div>
              ) : null}

              {content.sounds.length > 0 ? (
                <div className="grid gap-2">
                  {content.sounds.map((sound) => (
                    <Link
                      key={sound.id}
                      to="/auscultation"
                      search={{ son: sound.id }}
                      data-sujet-son={sound.id}
                      className={ROW_CLASS}
                    >
                      <span className={cn(ICON_TILE_CLASS, "bg-accent/12 text-accent")} aria-hidden>
                        <AudioWaveform className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-fg">
                          {sound.label}
                        </span>
                        <span className="block text-xs text-muted">
                          Auscultation · {sound.categorie}
                          {sound.available ? " · écouter" : " · bientôt"}
                        </span>
                      </span>
                      <ArrowRight
                        className="size-4 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5"
                        aria-hidden
                      />
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {/* 5 — Calculer */}
        {content.calculators.length > 0 ? (
          <section className="mt-8" data-sujet-section="calculateurs">
            <SectionTitle kicker="Décision" title="À calculer" />
            <div className="grid gap-2 sm:grid-cols-2">
              {content.calculators.map((calculator) => (
                <Link
                  key={calculator.id}
                  to="/calculateurs"
                  search={{ score: calculator.id }}
                  data-sujet-score={calculator.id}
                  className={ROW_CLASS}
                >
                  <span className={ICON_TILE_CLASS} aria-hidden>
                    <Sigma className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-fg">
                      {calculator.label}
                    </span>
                    <span className="block text-xs text-muted">
                      Score clinique · calcul instantané
                    </span>
                  </span>
                  <ArrowRight
                    className="size-4 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {/* 6 — Le référentiel officiel */}
        {content.officialItems.length > 0 ? (
          <section className="mt-8" data-sujet-section="referentiel">
            <SectionTitle kicker="Référentiel 2025" title="Au programme" />
            <ul className="grid gap-2">
              {content.officialItems.map((item) => (
                <li
                  key={item.ordinal}
                  data-sujet-item={item.ordinal}
                  className="flex items-start gap-3 rounded-[var(--radius-lg)] bg-card px-4 py-3 shadow-[var(--shadow-border)]"
                >
                  <span className="mt-0.5 shrink-0 rounded-full bg-secondary px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-muted">
                    Item {item.ordinal}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium leading-snug text-fg">
                      {item.title}
                    </span>
                    <span className="block text-xs text-muted">
                      {item.sectionLabel} · {item.specialty}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted">
              Numérotation globale du référentiel national (1 → 240) ; le numéro local de section
              reste affiché sur{" "}
              <Link to="/programme" className="font-medium text-primary underline-offset-2 hover:underline">
                le programme
              </Link>
              .
            </p>
          </section>
        ) : null}

        {/* 7 — Voisins de spécialité */}
        {neighbours.length > 0 ? (
          <section className="mt-8" data-sujet-section="voisins">
            <SectionTitle kicker={sujet.specialty} title="Sujets voisins" />
            <div className="flex flex-wrap gap-2">
              {neighbours.map((neighbour) => (
                <Link
                  key={neighbour.slug}
                  to="/sujet/$slug"
                  params={{ slug: neighbour.slug }}
                  data-sujet-neighbour={neighbour.slug}
                  className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-xs font-medium text-fg shadow-[var(--shadow-border)] transition-colors hover:bg-secondary/60"
                >
                  {neighbour.label}
                  <ArrowRight className="size-3 text-subtle" aria-hidden />
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-8 flex flex-col gap-3 rounded-[var(--radius-xl)] bg-card p-5 shadow-[var(--shadow-border)] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <BookMarked className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
            <div>
              <p className="text-sm font-medium text-fg">Voir tout le catalogue</p>
              <p className="text-xs text-muted">
                Bibliothèque filtrable, parcours par spécialité et cas cliniques.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/bibliotheque"
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-fg"
            >
              Bibliothèque
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
            <Link
              to="/cas"
              className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-4 py-2 text-xs font-semibold text-fg"
            >
              <Stethoscope className="size-3.5" aria-hidden />
              Cas cliniques
            </Link>
          </div>
        </section>
      </Page>
    </Shell>
  );
}

/** Phrase de description construite sur ce que le sujet contient réellement. */
function descriptionOf(
  counts: {
    decks: number;
    cases: number;
    demarches: number;
    ecg: number;
    sounds: number;
    calculators: number;
  },
  questionCount: number,
): string {
  const parts = [
    `${counts.decks} deck${counts.decks > 1 ? "s" : ""} (${questionCount} question${questionCount > 1 ? "s" : ""})`,
    counts.cases > 0 ? `${counts.cases} cas clinique${counts.cases > 1 ? "s" : ""}` : "",
    counts.demarches > 0 ? `${counts.demarches} démarche` : "",
    counts.ecg > 0 ? `${counts.ecg} tracé${counts.ecg > 1 ? "s" : ""} ECG` : "",
    counts.sounds > 0 ? `${counts.sounds} son${counts.sounds > 1 ? "s" : ""}` : "",
    counts.calculators > 0 ? `${counts.calculators} score${counts.calculators > 1 ? "s" : ""}` : "",
  ].filter(Boolean);
  return `Tout ce qui traite ce sujet dans l’app : ${parts.join(", ")}.`;
}

function difficultyLabel(difficulty: string): string {
  if (difficulty === "intro") return "Découverte";
  if (difficulty === "advanced") return "Avancé";
  return "Consolidation";
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
