import { useMemo, useState } from "react";
import { PremiumLockCard } from "@/components/cases/PremiumLockCard";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check, Lock, Sparkles, X } from "lucide-react";
import { MedicalSources, ReportContentError } from "@/components/content-trust";
import { Page, Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { getCase } from "@/content/catalog";
import { caseXp } from "@/core/quiz-engine";
import { hasEntitlement, useOptimus } from "@/state/store";
import type { ClinicalCase } from "@/core/types";
import type { PremiumSpecialtyId } from "@/content/purchase-order";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/cas/$caseId")({ component: CasePlay });

function CasePlay() {
  const { caseId } = Route.useParams();
  const clinical = getCase(caseId);
  const navigate = useNavigate();
  const completeCase = useOptimus((s) => s.completeCase);
  const entitlements = useOptimus((s) => s.entitlements);
  const [cursor, setCursor] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);
  const [asked, setAsked] = useState(0);

  const qCount = useMemo(
    () => clinical?.steps.filter((s) => s.kind === "question").length ?? 0,
    [clinical],
  );

  if (!clinical) {
    return (
      <Shell>
        <Page>
          <p className="text-sm text-muted">Cas introuvable.</p>
        </Page>
      </Shell>
    );
  }

  const open = hasClinicalAccess(clinical, entitlements);
  const previewLimit = Math.min(3, clinical.steps.length);
  const previewFinished = !open && cursor >= previewLimit;
  const step = clinical.steps[cursor];
  const finished = cursor >= clinical.steps.length;

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

        {!open ? (
          <div className="mt-5 flex items-center gap-2 rounded-[var(--radius-lg)] bg-primary-soft px-4 py-3 text-sm">
            <Sparkles className="size-4 shrink-0 text-primary" />
            Aperçu gratuit · {previewLimit} éléments du dossier
          </div>
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
                Débloquez les questions décisionnelles, les pièges, la prise en charge argumentée
                et les sources de ce cas.
              </p>
            </div>
            <div className="p-5">
              <ul className="space-y-2 text-sm text-muted">
                <li>✓ Raisonnement clinique étape par étape</li>
                <li>✓ Feedback immédiat sur chaque décision</li>
                <li>✓ Cas avancés inclus dans la spécialité</li>
                <li>✓ Accès hors-ligne sur cet appareil</li>
              </ul>
              <Link
                to="/pro"
                search={{ specialty: specialtyId(clinical.specialty) }}
                className={buttonVariants({ size: "lg", className: "mt-5 w-full" })}
              >
                Débloquer la spécialité · 27 000 Ar
                <ArrowRight className="size-4" />
              </Link>
              <Link to="/cas" className="mt-3 block text-center text-sm text-muted">
                Essayer un autre cas
              </Link>
            </div>
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
            <MedicalSources sources={clinical.sources} />
            <ReportContentError
              target={{
                contentType: "clinical_case",
                contentId: clinical.id,
                label: `${clinical.title} — synthèse finale`,
              }}
              className="mt-3 w-full"
            />
            <Button
              className="mt-6 w-full"
              onClick={() => {
                completeCase(clinical.id, caseXp(correct, qCount));
                void navigate({ to: "/cas" });
              }}
            >
              Enregistrer le cas
            </Button>
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
      </Page>
    </Shell>
  );
}


function specialtyCode(specialty: string): string {
  if (specialty === "Cardiologie") return "CARDIO";
  if (specialty === "Neurologie") return "NEURO";
  if (specialty === "Infectiologie") return "INFECTIO";
  if (specialty === "Urgences") return "URGENCES";
  if (specialty === "Dermatologie") return "DERMATO";
  return specialty.toUpperCase();
}

function specialtyId(specialty: string): PremiumSpecialtyId {
  if (specialty === "Cardiologie") return "cardiologie";
  if (specialty === "Neurologie") return "neurologie";
  if (specialty === "Urgences") return "urgences";
  if (specialty === "Dermatologie") return "dermatologie";
  return "infectiologie";
}

function hasClinicalAccess(
  clinical: ClinicalCase,
  entitlements: ReturnType<typeof useOptimus.getState>["entitlements"],
): boolean {
  return (
    clinical.access === "free" ||
    hasEntitlement("OPTIMUS_PRO", entitlements) ||
    hasEntitlement(`${specialtyCode(clinical.specialty)}_PACK_10`, entitlements)
  );
}
