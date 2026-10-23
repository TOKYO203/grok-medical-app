import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  FileText,
  History,
  Lightbulb,
  Lock,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import { MedicalSources, ReportContentError } from "@/components/content-trust";
import { OptimusAnalysisPanel } from "@/components/ai/OptimusAnalysisPanel";
import { Page, Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { CLINICAL_CASES, getBuiltinDeck, getCase } from "@/content/catalog";
import { PRICES_MGA, formatPrice } from "@/content/pricing";
import { caseXp } from "@/core/quiz-engine";
import { hasEntitlement, useOptimus } from "@/state/store";
import { specialtyPackProduct } from "@/lib/library/content-index";
import type { ClinicalCase } from "@/core/types";
import { premiumSpecialtyIdFor, type PremiumSpecialtyId } from "@/content/purchase-order";
import { isTrialActive, trialRemainingDays } from "@/lib/premium-trial";
import { pathologyEntry } from "@/lib/pathologies/manifest";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/cas/$caseId")({ component: CasePlay });

/** Étiquettes de calibration : issue déclarée face au diagnostic révélé. */
const OUTCOME_LABEL: Record<string, string> = {
  correct: "✔ dans le vrai",
  partial: "≈ en partie",
  wrong: "✘ à côté",
};

/** Options d'auto-évaluation présentées après la révélation du diagnostic. */
const OUTCOMES = [
  { value: "correct", label: "Dans le vrai" },
  { value: "partial", label: "En partie" },
  { value: "wrong", label: "À côté" },
] as const;

/**
 * Calibration de confiance : trois niveaux, assez pour se situer sans figer
 * la réponse. L’étiquette choisie est rejouée dans le débrief final.
 */
const CONFIDENCE = [
  { value: "hesitant", label: "Peu sûr" },
  { value: "sure", label: "Plutôt sûr" },
  { value: "certain", label: "Très sûr" },
] as const;

/**
 * Durée estimée du dossier : environ 30 s par révélation et 1 min par
 * décision, plancher de 2 min — de quoi choisir son cas selon son temps.
 */
function caseDurationMinutes(clinical: ClinicalCase): number {
  const decisions = clinical.steps.filter((step) => step.kind === "question").length;
  const reveals = clinical.steps.length - decisions;
  return Math.max(2, Math.ceil(reveals * 0.5 + decisions));
}

function CasePlay() {
  const { caseId } = Route.useParams();
  const clinical = getCase(caseId);
  const navigate = useNavigate();
  const completeCase = useOptimus((s) => s.completeCase);
  const done = useOptimus((s) => s.casesCompleted);
  const entitlements = useOptimus((s) => s.entitlements);
  const premiumTrial = useOptimus((s) => s.premiumTrial);
  const hydrated = useOptimus((s) => s.hydrated);
  const caseHypotheses = useOptimus((s) => s.caseHypotheses);
  const saveCaseSession = useOptimus((s) => s.saveCaseSession);
  const recordCaseHypothesis = useOptimus((s) => s.recordCaseHypothesis);
  const assessCaseHypothesis = useOptimus((s) => s.assessCaseHypothesis);
  const [cursor, setCursor] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);
  const [asked, setAsked] = useState(0);
  const [hypothesis, setHypothesis] = useState("");
  const [confidence, setConfidence] = useState<(typeof CONFIDENCE)[number] | null>(null);
  const [committed, setCommitted] = useState(false);
  const [appliedResume, setAppliedResume] = useState(false);
  const [resumedCursor, setResumedCursor] = useState<number | null>(null);

  const qCount = useMemo(
    () => clinical?.steps.filter((s) => s.kind === "question").length ?? 0,
    [clinical],
  );

  /**
   * Phase 2 — reprise : le store s'hydrate APRÈS le premier rendu ; la session
   * sauvegardée n'est donc appliquée qu'une fois, quand elle existe. Un dossier
   * déjà terminé n'a pas de session (elle est nettoyée par completeCase).
   */
  useEffect(() => {
    if (!hydrated || appliedResume) return;
    setAppliedResume(true);
    const saved = useOptimus.getState().caseSessions[caseId];
    if (!saved) return;
    setCursor(saved.cursor);
    setCorrect(saved.correct);
    setAsked(saved.asked);
    setHypothesis(saved.hypothesis);
    setConfidence(CONFIDENCE.find((level) => level.value === saved.confidence) ?? null);
    setCommitted(saved.committed);
    if (saved.cursor > 0 && !saved.committed) setResumedCursor(saved.cursor);
  }, [hydrated, appliedResume, caseId]);

  /**
   * Phase 2 — persistance : chaque étape, décision, hypothèse et engagement est
   * sauvegardé au fil de l'eau pour permettre la reprise après un refresh.
   * Stop dès que le dossier est terminé : la session est nettoyée par le store.
   */
  useEffect(() => {
    if (!appliedResume || done.includes(caseId)) return;
    saveCaseSession({
      caseId,
      cursor,
      correct,
      asked,
      hypothesis,
      confidence: confidence?.value ?? null,
      committed,
      updatedAt: Date.now(),
    });
  }, [
    appliedResume,
    done,
    caseId,
    cursor,
    correct,
    asked,
    hypothesis,
    confidence,
    committed,
    saveCaseSession,
  ]);

  /** Historique des hypothèses engagées sur CE dossier, la plus récente d'abord. */
  const hypothesesForCase = useMemo(
    () => [...caseHypotheses].filter((entry) => entry.caseId === clinical?.id).reverse(),
    [caseHypotheses, clinical?.id],
  );

  /** Issue déclarée sur la dernière hypothèse de ce dossier — feedback de calibration. */
  const latestOutcome = hypothesesForCase.length > 0 ? (hypothesesForCase[0].outcome ?? null) : null;

  // Liens « Approfondir » du débrief : manifeste public (fiches) et catalogue
  // intégré (decks) — un dossier terminé doit ouvrir sur la révision.
  const relatedPathologies = (clinical?.related?.pathologySlugs ?? []).flatMap((slug) => {
    const entry = pathologyEntry(slug);
    return entry && entry.status === "available" ? [entry] : [];
  });
  const relatedDecks = (clinical?.related?.deckIds ?? []).flatMap((id) => {
    const deck = getBuiltinDeck(id);
    return deck ? [deck] : [];
  });

  /**
   * Dossier suivant à proposer en fin de parcours : premier dossier NON
   * terminé de la même spécialité (sinon premier non terminé du catalogue).
   * Le dossier courant n'est jamais lui-même proposé ; si tout est terminé,
   * pas de bouton d'enchaînement — l'utilisateur retourne à la liste.
   */
  const nextCase = useMemo(() => {
    if (!clinical) return null;
    const sameSpecialty = CLINICAL_CASES.filter(
      (candidate) => candidate.specialty === clinical.specialty && candidate.id !== clinical.id,
    );
    const pool = sameSpecialty.length > 0 ? sameSpecialty : CLINICAL_CASES;
    return pool.find((candidate) => !done.includes(candidate.id)) ?? null;
  }, [clinical, done]);

  if (!clinical) {
    return (
      <Shell>
        <Page>
          <p className="text-sm text-muted">Cas introuvable.</p>
        </Page>
      </Shell>
    );
  }

  const trialActive = isTrialActive(premiumTrial);
  const open = hasClinicalAccess(clinical, entitlements) || trialActive;
  // Même résolution que le pack qui débloque réellement le cas.
  const premiumSpecialty = specialtyId(clinical.specialty);
  const previewLimit = Math.min(3, clinical.steps.length);
  const previewFinished = !open && cursor >= previewLimit;
  const step = clinical.steps[cursor];
  const finished = cursor >= clinical.steps.length;

  /** Phase 2 — engagement : archiver l'hypothèse (si écrite) PUIS révéler. */
  const commitHypothesis = () => {
    const text = hypothesis.trim();
    if (text) {
      recordCaseHypothesis({
        caseId: clinical.id,
        hypothesis: text,
        confidence: confidence?.value ?? null,
      });
    }
    setCommitted(true);
  };

  return (
    <Shell title={clinical.title}>
      <Page className="mx-auto max-w-lg">
        <Link to="/cas" className="inline-flex items-center gap-2 text-sm text-muted hover:text-fg">
          <ArrowLeft className="size-4" />
          Cas
        </Link>
        <p className="mt-4 text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
          {clinical.specialty}
        </p>
        <h1 className="mt-1 font-display text-3xl font-medium tracking-tight">{clinical.title}</h1>
        <p className="mt-2 text-sm text-muted">
          {clinical.patient.sex === "F" ? "Femme" : "Homme"}, {clinical.patient.age} ans —{" "}
          {clinical.patient.context}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-subtle">
          <span className="font-mono tabular-nums">
            ≈ {caseDurationMinutes(clinical)} min
          </span>
          <span aria-hidden>·</span>
          <span>
            {clinical.steps.length} étape{clinical.steps.length > 1 ? "s" : ""}
          </span>
          <span aria-hidden>·</span>
          <span>{qCount} décision{qCount > 1 ? "s" : ""}</span>
        </p>

        {!open ? (
          <div className="mt-5 flex items-center gap-2 rounded-[var(--radius-lg)] bg-primary-soft px-4 py-3 text-sm">
            <Sparkles className="size-4 shrink-0 text-primary" />
            Aperçu gratuit · {previewLimit} éléments du dossier
          </div>
        ) : trialActive ? (
          <div className="mt-5 flex items-center gap-2 rounded-[var(--radius-lg)] bg-primary-soft px-4 py-3 text-sm">
            <Sparkles className="size-4 shrink-0 text-primary" />
            Essai Premium · {trialRemainingDays(premiumTrial)} jour{trialRemainingDays(premiumTrial) > 1 ? "s" : ""} restants — dossier complet ouvert
          </div>
        ) : null}

        {resumedCursor !== null && !finished && !previewFinished ? (
          <p
            data-case-resume
            className="mt-3 flex items-center gap-2 text-xs text-muted"
          >
            <RotateCcw className="size-4 shrink-0" aria-hidden />
            Dossier repris — étape {Math.min(cursor + 1, clinical.steps.length)} sur{" "}
            {clinical.steps.length}
          </p>
        ) : null}

        {previewFinished ? (
          <section className="mt-8 overflow-hidden rounded-[var(--radius-xl)] bg-card shadow-[var(--shadow-md)]">
            <div className="premium-hero p-5 text-primary-fg">
              <Lock className="size-6" />
              <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] opacity-70">
                La décision commence ici
              </p>
              <h2 className="mt-1 font-display text-2xl font-medium tracking-tight">
                Poursuivez jusqu’au diagnostic
              </h2>
              <p className="mt-2 text-sm leading-relaxed opacity-80">
                Débloquez les questions décisionnelles, les pièges, la prise en charge argumentée et
                les sources de ce cas.
              </p>
            </div>
            <div className="p-5">
              <ul className="space-y-2 text-sm text-muted">
                <li>✓ Raisonnement clinique étape par étape</li>
                <li>✓ Feedback immédiat sur chaque décision</li>
                <li>✓ Tout le contenu de la spécialité, mis à jour</li>
                <li>✓ Accès hors-ligne sur vos appareils connectés</li>
              </ul>
              <Link
                to="/pro"
                search={{ ...(premiumSpecialty ? { specialty: premiumSpecialty } : {}) }}
                className={buttonVariants({ size: "lg", className: "mt-5 w-full" })}
              >
                {premiumSpecialty
                  ? `Débloquer cette spécialité · ${formatPrice(PRICES_MGA.specialty, "MGA")}`
                  : "Voir les offres et les tarifs"}
                <ArrowRight className="size-4" />
              </Link>
              <p className="mt-2 text-center text-xs text-muted">
                Abonnement Trimestriel · tout le contenu Premium : bientôt disponible
              </p>
              <Link to="/cas" className="mt-3 block text-center text-sm text-muted">
                Essayer un autre cas
              </Link>
            </div>
          </section>
        ) : finished && !committed ? (
          <section
            data-case-prediction
            className="mt-8 rounded-[var(--radius-xl)] bg-card p-5 shadow-[var(--shadow-border)]"
          >
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
              Avant le diagnostic
            </p>
            <h2 className="mt-2 font-display text-2xl font-medium tracking-tight">
              Engagez votre hypothèse
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Écrire votre hypothèse avant la réponse l’ancre dans la mémoire, même si vous vous
              trompez.
            </p>
            <textarea
              id="case-hypothesis"
              value={hypothesis}
              onChange={(event) => setHypothesis(event.target.value)}
              rows={3}
              placeholder="Votre hypothèse diagnostique et vos arguments cliniques…"
              aria-label="Votre hypothèse diagnostique"
              className="mt-4 w-full resize-none rounded-[var(--radius-lg)] border-none bg-surface px-4 py-3 text-sm leading-relaxed text-fg shadow-[var(--shadow-border)] outline-none focus:ring-1 focus:ring-primary/40"
            />
            <div className="mt-3 flex gap-2">
              {CONFIDENCE.map((level) => {
                const active = confidence?.value === level.value;
                return (
                  <button
                    key={level.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setConfidence(level)}
                    className={cn(
                      "flex-1 rounded-[var(--radius-lg)] px-3 py-2.5 text-sm font-medium transition-colors",
                      active ? "bg-primary-soft text-primary" : "bg-card text-fg hover:bg-surface",
                    )}
                  >
                    {level.label}
                  </button>
                );
              })}
            </div>
            <Button className="mt-5 w-full" onClick={commitHypothesis}>
              Révéler le diagnostic
              <ArrowRight className="size-4" />
            </Button>
            <button
              type="button"
              onClick={() => setCommitted(true)}
              className="mt-3 w-full text-center text-sm text-muted hover:text-fg"
            >
              Passer sans m’engager
            </button>
          </section>
        ) : finished ? (
          <div className="mt-8">
            <p className="text-sm text-muted">
              {correct}/{qCount} décisions justes
            </p>
            <h2 className="mt-4 font-display text-xl font-medium">Diagnostic</h2>
            <p className="mt-2 text-sm leading-relaxed">{clinical.diagnosis}</p>
            <h2 className="mt-6 font-display text-xl font-medium">Prise en charge</h2>
            <p className="mt-2 text-sm leading-relaxed">{clinical.management}</p>
            {clinical.pitfall ? (
              <div
                data-case-pitfall
                className="mt-4 rounded-[var(--radius-lg)] bg-warn/10 p-4 ring-1 ring-warn/35"
              >
                <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-warn">
                  <AlertTriangle className="size-4 shrink-0" aria-hidden />
                  Le piège classique
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-fg">{clinical.pitfall}</p>
              </div>
            ) : null}
            {clinical.keyTakeaway ? (
              <div
                data-case-takeaway
                className="mt-3 rounded-[var(--radius-lg)] bg-primary-soft p-4"
              >
                <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
                  <Lightbulb className="size-4 shrink-0" aria-hidden />
                  La clé à retenir
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-fg">{clinical.keyTakeaway}</p>
              </div>
            ) : null}
            {hypothesis.trim() ? (
              <p data-case-hypothesis-recap className="mt-3 text-xs leading-relaxed text-muted">
                Votre hypothèse : « {hypothesis.trim()} »
                {confidence ? ` · ${confidence.label}` : ""} — comparez-la au diagnostic ci-dessus.
              </p>
            ) : null}
            {hypothesesForCase.length > 0 ? (
              <div
                data-case-hypotheses
                className="mt-3 rounded-[var(--radius-lg)] bg-card p-4 shadow-[var(--shadow-border)]"
              >
                <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                  <History className="size-4 shrink-0" aria-hidden />
                  Vos hypothèses sur ce dossier
                </p>
                <ul className="mt-2 space-y-1.5">
                  {hypothesesForCase.map((entry, index) => (
                    <li
                      key={`${entry.createdAt}-${index}`}
                      className="text-xs leading-relaxed text-muted"
                    >
                      « {entry.hypothesis} »
                      {entry.confidence
                        ? ` · ${CONFIDENCE.find((level) => level.value === entry.confidence)?.label ?? ""}`
                        : ""}
                      {entry.outcome ? ` · ${OUTCOME_LABEL[entry.outcome]}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {hypothesesForCase.length > 0 ? (
              <div
                data-case-assessment
                className="mt-3 rounded-[var(--radius-lg)] bg-card p-4 shadow-[var(--shadow-border)]"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                  Face au diagnostic, votre hypothèse était :
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {OUTCOMES.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={latestOutcome === option.value}
                      onClick={() => assessCaseHypothesis(clinical.id, option.value)}
                      className={cn(
                        "rounded-[var(--radius-md)] px-3 py-1.5 text-xs font-medium transition-colors",
                        latestOutcome === option.value
                          ? "bg-primary-soft text-primary"
                          : "bg-surface text-fg hover:bg-card",
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-muted">
                  Votre réponse alimente vos statistiques de calibration sur la page Cas.
                </p>
              </div>
            ) : null}
            <MedicalSources sources={clinical.sources} />
            <ReportContentError
              target={{
                contentType: "clinical_case",
                contentId: clinical.id,
                label: `${clinical.title} — synthèse finale`,
              }}
              className="mt-3 w-full"
            />
            {relatedPathologies.length > 0 || relatedDecks.length > 0 ? (
              <section data-case-related className="mt-6">
                <h2 className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
                  Approfondir
                </h2>
                <ul className="mt-3 space-y-2">
                  {relatedPathologies.map((entry) => (
                    <li key={entry.slug}>
                      <Link
                        to="/pathologie/$slug"
                        params={{ slug: entry.slug }}
                        className="flex items-center gap-3 rounded-[var(--radius-lg)] bg-card px-4 py-3 shadow-[var(--shadow-border)] transition-colors hover:bg-surface"
                      >
                        <FileText className="size-4 shrink-0 text-accent" aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[11px] uppercase tracking-[0.12em] text-subtle">
                            Fiche nosographie
                          </span>
                          <span className="mt-0.5 block truncate text-sm font-medium text-fg">
                            {entry.title}
                          </span>
                        </span>
                        <ArrowRight className="size-4 shrink-0 text-muted" aria-hidden />
                      </Link>
                    </li>
                  ))}
                  {relatedDecks.map((deck) => (
                    <li key={deck.id}>
                      <Link
                        to="/parcours/$deckId"
                        params={{ deckId: deck.id }}
                        className="flex items-center gap-3 rounded-[var(--radius-lg)] bg-card px-4 py-3 shadow-[var(--shadow-border)] transition-colors hover:bg-surface"
                      >
                        <BookOpen className="size-4 shrink-0 text-accent" aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[11px] uppercase tracking-[0.12em] text-subtle">
                            Deck
                          </span>
                          <span className="mt-0.5 block truncate text-sm font-medium text-fg">
                            {deck.title}
                          </span>
                        </span>
                        <ArrowRight className="size-4 shrink-0 text-muted" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            <Button
              className="mt-6 w-full"
              onClick={() => {
                completeCase(clinical.id, caseXp(correct, qCount));
                void navigate({ to: "/cas" });
              }}
            >
              Enregistrer le cas
            </Button>
            {nextCase ? (
              <Button
                variant="secondary"
                className="mt-3 w-full"
                onClick={() => {
                  completeCase(clinical.id, caseXp(correct, qCount));
                  void navigate({
                    to: "/cas/$caseId",
                    params: { caseId: nextCase.id },
                  });
                }}
              >
                Enregistrer et enchaîner — {nextCase.title}
                <ArrowRight className="size-4" />
              </Button>
            ) : null}
          </div>
        ) : step?.kind === "reveal" ? (
          <div className="mt-8 rounded-[var(--radius-xl)] bg-card p-5 shadow-[var(--shadow-border)]">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
              {step.title}
            </p>
            <p className="mt-3 text-sm leading-relaxed">{step.body}</p>
            <Button className="mt-5 w-full" onClick={() => setCursor((c) => c + 1)}>
              Continuer
            </Button>
          </div>
        ) : step?.kind === "question" ? (
          <div className="mt-8">
            <p className="font-display text-xl font-medium leading-snug">{step.prompt}</p>
            <ul className="mt-4 space-y-2">
              {step.choices.map((choice, i) => {
                const revealed = picked !== null;
                const isCorrect = i === step.correct;
                const isPicked = i === picked;
                return (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => {
                        if (picked !== null) return;
                        setPicked(i);
                        setAsked((n) => n + 1);
                        if (i === step.correct) setCorrect((n) => n + 1);
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
                <p className="text-sm leading-relaxed">{step.explanation}</p>
                <ReportContentError
                  target={{
                    contentType: "clinical_case",
                    contentId: `${clinical.id}:step-${cursor + 1}`,
                    label: step.prompt,
                  }}
                  className="mt-2 w-full"
                />
                <Button
                  className="mt-4 w-full"
                  onClick={() => {
                    setPicked(null);
                    setCursor((c) => c + 1);
                  }}
                >
                  Continuer
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
        <p className="mt-6 text-center font-mono text-xs tabular-nums text-subtle">
          {Math.min(cursor + 1, clinical.steps.length)}/{clinical.steps.length}
          {asked ? ` · ${correct}/${asked}` : ""}
        </p>

        <div className="mt-8">
          <OptimusAnalysisPanel
            context={{
              title: clinical.title,
              specialty: clinical.specialty,
              studyYear: clinical.studyYear,
              difficulty: clinical.difficulty,
              summary: clinical.summary,
              patient: clinical.patient,
              revealedSteps: clinical.steps
                .slice(0, cursor + 1)
                .filter((s) => s.kind === "reveal")
                .map((s) => ({ title: s.title, body: s.body })) as any,
              correct,
              asked,
            }}
          />
        </div>
      </Page>
    </Shell>
  );
}

/** Spécialité Premium à proposer — même résolution que l'accès réel (pack). */
function specialtyId(specialty: string): PremiumSpecialtyId | null {
  return premiumSpecialtyIdFor(specialty);
}

function hasClinicalAccess(
  clinical: ClinicalCase,
  entitlements: ReturnType<typeof useOptimus.getState>["entitlements"],
): boolean {
  return (
    clinical.access === "free" ||
    hasEntitlement("OPTIMUS_PRO", entitlements) ||
    hasEntitlement(specialtyPackProduct(clinical.specialty), entitlements)
  );
}
