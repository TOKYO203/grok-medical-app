import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check, Lock, X } from "lucide-react";
import { Page, Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Progress } from "@/components/ui/progress";
import { getDiagnostic, useCatalogVersion } from "@/content/catalog";
import { PRICES_MGA, formatPrice } from "@/content/pricing";
import { loadDemarcheContent } from "@/lib/demarches/catalog";
import type { DemarcheContent } from "@/core/demarche";
import { fetchWithAuth } from "@/lib/auth/session";
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
  // Fiche enrichie : actif statique public chargé à la demande (migration du
  // 2026-11-08 — le contenu ne vit plus dans le bundle client ni serveur).
  const [enriched, setEnriched] = useState<DemarcheContent | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    void loadDemarcheContent(id).then((content) => {
      if (!cancelled) setEnriched(content);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);
  const navigate = useNavigate();
  const complete = useOptimus((s) => s.completeDiagnostic);
  const entitlements = useOptimus((s) => s.entitlements);
  const premiumTrial = useOptimus((s) => s.premiumTrial);
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);
  // Pentest P2 — étapes premium sanitisées : la clé de correction vient du
  // serveur (POST /api/quiz/answer) APRÈS le choix, jamais avant.
  const [stepAnswer, setStepAnswer] = useState<{ correctIndex: number; explanation: string } | null>(null);
  const [stepCheck, setStepCheck] = useState<"idle" | "checking" | "error">("idle");
  const pendingStepChoice = useRef<number | null>(null);

  useEffect(() => {
    setStepAnswer(null);
    setStepCheck("idle");
    pendingStepChoice.current = null;
  }, [step]);

  if (!dx) {
    return (
      <Shell>
        <Page>
          <p className="text-sm text-muted">Démarche introuvable.</p>
        </Page>
      </Shell>
    );
  }

  const view: DemarcheView = enriched && vue ? vue : "demarche";
  const trialActive = isTrialActive(premiumTrial);
  const open =
    hasEntitlement("OPTIMUS_PRO", entitlements) ||
    hasEntitlement(specialtyPackProduct(dx.specialty), entitlements) ||
    trialActive;
  // Même résolution que le pack qui débloque réellement la démarche.
  const premiumSpecialty = diagnosticSpecialty(dx.specialty);
  const current = dx.steps[step];
  const done = step >= dx.steps.length;

  function goToView(next: DemarcheView) {
    void navigate({ to: "/demarche/$id", params: { id }, search: { vue: next } });
  }

  function retryStep() {
    const i = pendingStepChoice.current;
    if (i === null || !current) return;
    pendingStepChoice.current = null;
    void chooseStep(i);
  }

  async function chooseStep(i: number) {
    // Narrowing local : TS ne propage pas le garde `if (!dx)` dans cette closure.
    const diagnostic = dx;
    if (!diagnostic || !current) return;
    if (current.correct !== undefined) {
      // Projection non sanitisée (aperçu/essai sans sanitisation) : chemin local.
      setPicked(i);
      if (i === current.correct) setCorrect((n) => n + 1);
      return;
    }
    // Pentest P2 — étape premium sanitisée : le serveur corrige.
    setPicked(i);
    setStepCheck("checking");
    try {
      const response = await fetchWithAuth("/api/quiz/answer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          family: "diagnostics",
          itemId: diagnostic.id,
          questionId: current.id,
          choice: i,
        }),
      });
      if (!response.ok) throw new Error(`http_${response.status}`);
      const data = (await response.json()) as {
        correctIndex?: unknown;
        explanation?: unknown;
      };
      if (typeof data.correctIndex !== "number") throw new Error("bad_payload");
      setStepAnswer({
        correctIndex: data.correctIndex,
        explanation: typeof data.explanation === "string" ? data.explanation : "",
      });
      setStepCheck("idle");
      if (i === data.correctIndex) setCorrect((n) => n + 1);
    } catch {
      // Échec réseau/serveur : ni faux ni juste, l'utilisateur peut réessayer.
      setStepCheck("error");
      pendingStepChoice.current = i;
      setPicked(null);
    }
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

        {enriched ? (
          <div className="mt-5">
            <ViewTabs value={view} onChange={goToView} />
          </div>
        ) : null}

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
                      const revealed = picked !== null && stepCheck === "idle";
                      const effectiveCorrect =
                        current.correct !== undefined ? current.correct : stepAnswer?.correctIndex;
                      const isCorrect = i === effectiveCorrect;
                      const isPicked = i === picked;
                      return (
                        <li key={i}>
                          <button
                            type="button"
                            disabled={revealed || stepCheck === "checking"}
                            onClick={() => {
                              if (picked !== null || stepCheck !== "idle") return;
                              void chooseStep(i);
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
                  {stepCheck === "checking" ? (
                    <div className="mt-4 rounded-[var(--radius-lg)] bg-card p-4 shadow-[var(--shadow-border)]">
                      <p className="text-sm font-medium text-muted">Vérification de la décision…</p>
                    </div>
                  ) : null}
                  {stepCheck === "error" ? (
                    <div className="mt-4 rounded-[var(--radius-lg)] bg-card p-4 shadow-[var(--shadow-border)]">
                      <p className="text-sm font-medium text-danger">
                        Impossible de vérifier la décision (réseau ou session expirée).
                      </p>
                      <Button className="mt-4 w-full" onClick={retryStep}>
                        Réessayer
                      </Button>
                    </div>
                  ) : null}
                  {picked !== null && stepCheck === "idle" ? (
                    <div className="mt-4 rounded-[var(--radius-lg)] bg-card p-4 shadow-[var(--shadow-border)]">
                      <p className="text-sm leading-relaxed">
                        {current.correct !== undefined
                          ? current.explanation
                          : stepAnswer?.explanation ?? ""}
                      </p>
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

        {enriched && view === "fiche" ? <FicheView content={enriched} /> : null}

        {enriched && view === "flashcards" ? (
          open ? (
            <FlashcardsView content={enriched} trackId={enriched.diagnosticId} />
          ) : (
            <LockedPanel
              title="Collez les cartes en mémoire"
              body="Les flashcards Q/R et la carte mentale font partie du contenu Premium de la spécialité."
              premiumSpecialty={premiumSpecialty}
            />
          )
        ) : null}

        {enriched && view === "mindmap" ? (
          open ? (
            <MindmapView content={enriched} />
          ) : (
            <LockedPanel
              title="Visualisez le raisonnement"
              body="La carte mentale interactive (démarche complète) fait partie du contenu Premium de la spécialité."
              premiumSpecialty={premiumSpecialty}
            />
          )
        ) : null}
      </Page>
    </Shell>
  );
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
