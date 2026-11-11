import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check, Lock, X } from "lucide-react";
import { Page, Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Progress } from "@/components/ui/progress";
import { getDiagnostic, hydrateProtectedDiagnostics, useCatalogVersion } from "@/content/catalog";
import { PRICES_MGA, formatPrice } from "@/content/pricing";
import { loadDemarcheContent } from "@/lib/demarches/catalog";
import type { DemarcheContent } from "@/core/demarche";
import { FlashcardsView } from "@/components/demarche/flashcards-view";
import { FicheView } from "@/components/demarche/fiche-view";
import { MindmapView } from "@/components/demarche/mindmap-view";
import { isDemarcheView, viewPanelId, ViewTabs, type DemarcheView } from "@/components/demarche/view-tabs";
import { specialtyPackProduct } from "@/lib/library/content-index";
import { hasEntitlement, useOptimus } from "@/state/store";
import { premiumSpecialtyIdFor, type PremiumSpecialtyId } from "@/content/purchase-order";
import { isTrialActive, trialRemainingDays } from "@/lib/premium-trial";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/demarche/$id")({
  component: DemarchePage,
  validateSearch: (search: Record<string, unknown>): { vue?: DemarcheView } => ({
    vue: isDemarcheView(search.vue) ? search.vue : undefined,
  }),
});

function DemarchePage() {
  // Re-render dès que le catalogue distant arrive (accès direct à l'URL).
  useCatalogVersion();
  const { id } = Route.useParams();
  const { vue } = Route.useSearch();
  const dx = getDiagnostic(id);
  const navigate = useNavigate();
  const complete = useOptimus((s) => s.completeDiagnostic);
  const entitlements = useOptimus((s) => s.entitlements);
  const premiumTrial = useOptimus((s) => s.premiumTrial);
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);
  // Fiche enrichie : contenu PROTÉGÉ (§15), chargé sous jeton à la demande —
  // jamais dans le bundle, jamais dans un actif statique public.
  const [enriched, setEnriched] = useState<DemarcheContent | undefined>(undefined);

  const trialActive = isTrialActive(premiumTrial);
  const open = dx
    ? hasEntitlement("OPTIMUS_PRO", entitlements) ||
      hasEntitlement(specialtyPackProduct(dx.specialty), entitlements) ||
      trialActive
    : false;

  useEffect(() => {
    // Un chapitre verrouillé ne demande rien : le garde répondrait 401.
    if (!open) {
      setEnriched(undefined);
      return;
    }
    let cancelled = false;
    void loadDemarcheContent(id).then((content) => {
      if (!cancelled) setEnriched(content);
    });
    return () => {
      cancelled = true;
    };
  }, [id, open]);

  /** Réessai manuel : session de contenu relancée puis fiche redemandée. */
  function retryProtectedContent() {
    void hydrateProtectedDiagnostics();
    if (!open) return;
    void loadDemarcheContent(id).then((content) => setEnriched(content));
  }

  if (!dx) {
    return (
      <Shell>
        <Page>
          <p className="text-sm text-muted">Démarche introuvable.</p>
        </Page>
      </Shell>
    );
  }

  const view: DemarcheView = vue ?? "demarche";
  // Même résolution que le pack qui débloque réellement la démarche.
  const premiumSpecialty = diagnosticSpecialty(dx.specialty);
  const current = dx.steps[step];
  const done = step >= dx.steps.length;
  // Un chapitre ouvert dont les corrigés n'ont pas pu être chargés (hors ligne,
  // session expirée) ne doit pas compter chaque réponse comme fausse.
  const answersMissing = current !== undefined && current.correct === undefined;

  function goToView(next: DemarcheView) {
    void navigate({ to: "/demarche/$id", params: { id }, search: { vue: next } });
  }

  return (
    <Shell title="Démarche">
      <Page className="mx-auto max-w-lg">
        <Link
          to="/demarche"
          className="inline-flex items-center gap-2 text-sm text-muted hover:text-fg"
        >
          <ArrowLeft className="size-4" />
          Orientation diagnostique
        </Link>
        <h1 className="mt-4 font-display text-3xl font-medium tracking-tight">{dx.title}</h1>
        <p className="mt-2 text-sm text-muted">{dx.vignette}</p>

        {/* Les vues existent pour tout le monde : un chapitre fermé montre un
            encart Premium par vue, jamais un onglet mort. */}
        <div className="mt-5">
          <ViewTabs value={view} onChange={goToView} />
        </div>

        <div
          data-demarche-view={view}
          id={viewPanelId("demarche")}
          {...(view === "demarche"
            ? { role: "tabpanel" as const, "aria-labelledby": "vue-tab-demarche" }
            : { hidden: true })}
        >
          {view === "demarche" ? (
            <>
              <Progress
                className="mt-5"
                value={(Math.min(step, dx.steps.length) / dx.steps.length) * 100}
              />

              {!open ? (
                <p className="mt-3 text-xs font-medium text-primary">
                  Aperçu Premium · première décision offerte
                </p>
              ) : trialActive ? (
                <p className="mt-3 text-xs font-medium text-primary">
                  Essai Premium · {trialRemainingDays(premiumTrial)} jour
                  {trialRemainingDays(premiumTrial) > 1 ? "s" : ""} restants — démarche complète
                  ouverte
                </p>
              ) : null}

              {!open && step >= 1 ? (
                <LockedPanel
                  title={`Maîtrisez les ${dx.steps.length} étapes`}
                  body="Interrogatoire, examen, syndrome, hypothèses, examens, interprétation, diagnostic et prise en charge — avec correction à chaque décision."
                  premiumSpecialty={premiumSpecialty}
                />
              ) : answersMissing ? (
                <ContentUnavailable onRetry={retryProtectedContent} />
              ) : done && dx.synthesis === undefined ? (
                <ContentUnavailable onRetry={retryProtectedContent} />
              ) : done ? (
                <div className="mt-8">
                  <p className="text-sm text-muted">
                    {correct}/{dx.steps.length} étapes justes
                  </p>
                  <h2 className="mt-4 font-display text-xl font-medium">Synthèse</h2>
                  <p className="mt-2 text-sm leading-relaxed">{dx.synthesis}</p>
                  <Button
                    className="mt-6 w-full"
                    onClick={() => {
                      complete(dx.id, 50 + correct * 8);
                      void navigate({ to: "/demarche" });
                    }}
                  >
                    Enregistrer
                  </Button>
                </div>
              ) : current ? (
                <div className="mt-8">
                  <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
                    {current.title}
                  </p>
                  <p className="mt-2 text-sm text-muted">{current.lead}</p>
                  <p className="mt-4 font-display text-xl font-medium leading-snug">
                    {current.prompt}
                  </p>
                  <ul className="mt-4 space-y-2">
                    {current.choices.map((choice, i) => {
                      const revealed = picked !== null;
                      const isCorrect = i === current.correct;
                      const isPicked = i === picked;
                      return (
                        <li key={i}>
                          <button
                            type="button"
                            onClick={() => {
                              if (picked !== null) return;
                              setPicked(i);
                              if (i === current.correct) setCorrect((n) => n + 1);
                            }}
                            className={cn(
                              "flex min-h-14 w-full items-start gap-3 rounded-[var(--radius-lg)] px-4 py-3 text-left text-sm shadow-[var(--shadow-border)]",
                              !revealed && "bg-card hover:bg-surface",
                              revealed && isCorrect && "bg-primary-soft",
                              revealed && isPicked && !isCorrect && "bg-danger/15",
                              revealed && !isCorrect && !isPicked && "bg-card opacity-60",
                            )}
                          >
                            <span className="font-mono text-xs text-muted">
                              {String.fromCharCode(65 + i)}
                            </span>
                            <span className="flex-1">{choice}</span>
                            {revealed && isCorrect ? <Check className="size-4 text-primary" /> : null}
                            {revealed && isPicked && !isCorrect ? (
                              <X className="size-4 text-danger" />
                            ) : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  {picked !== null ? (
                    <div className="mt-4 rounded-[var(--radius-lg)] bg-card p-4 shadow-[var(--shadow-border)]">
                      <p className="text-sm leading-relaxed">{current.explanation}</p>
                      <Button
                        className="mt-4 w-full"
                        onClick={() => {
                          setPicked(null);
                          setStep((s) => s + 1);
                        }}
                      >
                        Étape suivante
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : null}
        </div>

        {view === "fiche" ? (
          !open ? (
            <LockedPanel
              title="La fiche d'orientation"
              body="Sections rédigées, encadrés d'urgence et de piège, sources vérifiables — la fiche complète fait partie du contenu Premium de la spécialité."
              premiumSpecialty={premiumSpecialty}
            />
          ) : enriched ? (
            <FicheView content={enriched} />
          ) : (
            <LoadingPanel label="Chargement de la fiche…" />
          )
        ) : null}

        {view === "flashcards" ? (
          !open ? (
            <LockedPanel
              title="Collez les cartes en mémoire"
              body="Les flashcards Q/R et la carte mentale font partie du contenu Premium de la spécialité."
              premiumSpecialty={premiumSpecialty}
            />
          ) : enriched ? (
            <FlashcardsView content={enriched} trackId={enriched.diagnosticId} />
          ) : (
            <LoadingPanel label="Chargement des flashcards…" />
          )
        ) : null}

        {view === "mindmap" ? (
          !open ? (
            <LockedPanel
              title="Visualisez le raisonnement"
              body="La carte mentale interactive (démarche complète) fait partie du contenu Premium de la spécialité."
              premiumSpecialty={premiumSpecialty}
            />
          ) : enriched ? (
            <MindmapView content={enriched} />
          ) : (
            <LoadingPanel label="Chargement de la carte mentale…" />
          )
        ) : null}
      </Page>
    </Shell>
  );
}

/**
 * État « le contenu protégé n'a pas pu être chargé » — distinct du verrou
 * Premium : l'utilisateur a l'accès, c'est la session de contenu qui manque
 * (hors ligne, jeton expiré). Sans cet état, chaque réponse serait comptée
 * fausse, ce qui est pire qu'un message d'erreur.
 */
function ContentUnavailable({ onRetry }: { onRetry: () => void }) {
  return (
    <section className="mt-8 rounded-[var(--radius-lg)] bg-card p-5 shadow-[var(--shadow-border)]">
      <p className="text-sm font-medium">Contenu du chapitre indisponible</p>
      <p className="mt-1 text-sm leading-relaxed text-muted">
        Les corrigés n'ont pas pu être récupérés (hors ligne ou session de contenu expirée). Votre
        accès reste valable : réessayez dans un instant.
      </p>
      <Button className="mt-4 w-full" onClick={onRetry}>
        Réessayer
      </Button>
    </section>
  );
}

function LoadingPanel({ label }: { label: string }) {
  return <p className="mt-6 text-sm text-muted">{label}</p>;
}

function LockedPanel({
  title,
  body,
  premiumSpecialty,
}: {
  title: string;
  body: string;
  premiumSpecialty: PremiumSpecialtyId | null;
}) {
  return (
    <section className="mt-8 overflow-hidden rounded-[var(--radius-xl)] bg-card shadow-[var(--shadow-md)]">
      <div className="premium-hero p-5 text-primary-fg">
        <Lock className="size-6" />
        <h2 className="mt-3 font-display text-2xl font-medium">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed opacity-80">{body}</p>
      </div>
      <div className="p-5">
        <Link
          to="/pro"
          search={{ ...(premiumSpecialty ? { specialty: premiumSpecialty } : {}) }}
          className={buttonVariants({ size: "lg", className: "w-full" })}
        >
          {premiumSpecialty
            ? `Débloquer cette spécialité · ${formatPrice(PRICES_MGA.specialty, "MGA")}`
            : "Voir les offres et les tarifs"}
          <ArrowRight className="size-4" />
        </Link>
        <p className="mt-2 text-center text-xs text-muted">
          Abonnement Trimestriel · tout le contenu Premium : bientôt disponible
        </p>
        <Link to="/demarche" className="mt-3 block text-center text-sm text-muted">
          Retour aux démarches
        </Link>
      </div>
    </section>
  );
}

/** Spécialité Premium à proposer — même résolution que l'accès réel (pack). */
function diagnosticSpecialty(specialty: string): PremiumSpecialtyId | null {
  return premiumSpecialtyIdFor(specialty);
}
