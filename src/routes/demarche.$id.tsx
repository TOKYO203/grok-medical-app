import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check, Lock, X } from "lucide-react";
import { Page, Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Progress } from "@/components/ui/progress";
import { getDiagnostic } from "@/content/catalog";
import { hasEntitlement, useOptimus } from "@/state/store";
import type { PremiumSpecialtyId } from "@/content/purchase-order";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/demarche/$id")({ component: DemarchePage });

function DemarchePage() {
  const { id } = Route.useParams();
  const dx = getDiagnostic(id);
  const navigate = useNavigate();
  const complete = useOptimus((s) => s.completeDiagnostic);
  const entitlements = useOptimus((s) => s.entitlements);
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);

  if (!dx) {
    return (
      <Shell>
        <Page>
          <p className="text-sm text-muted">Démarche introuvable.</p>
        </Page>
      </Shell>
    );
  }

  const open =
    hasEntitlement("OPTIMUS_PRO", entitlements) ||
    hasEntitlement(diagnosticPack(dx.specialty), entitlements);
  const previewFinished = !open && step >= 1;
  const current = dx.steps[step];
  const done = step >= dx.steps.length;

  return (
    <Shell title="Démarche">
      <Page className="mx-auto max-w-lg">
        <Link to="/cas" className="inline-flex items-center gap-2 text-sm text-muted hover:text-fg">
          <ArrowLeft className="size-4" />
          Cas
        </Link>
        <h1 className="mt-4 font-display text-3xl font-medium tracking-tight">{dx.title}</h1>
        <p className="mt-2 text-sm text-muted">{dx.vignette}</p>
        <Progress className="mt-5" value={(Math.min(step, dx.steps.length) / dx.steps.length) * 100} />

        {!open ? (
          <p className="mt-3 text-xs font-medium text-primary">
            Aperçu Premium · première décision offerte
          </p>
        ) : null}

        {previewFinished ? (
          <section className="mt-8 overflow-hidden rounded-[var(--radius-xl)] bg-card shadow-[var(--shadow-md)]">
            <div className="premium-hero p-5 text-primary-fg">
              <Lock className="size-6" />
              <h2 className="mt-3 font-display text-2xl font-medium">
                Maîtrisez les 8 étapes
              </h2>
              <p className="mt-2 text-sm leading-relaxed opacity-80">
                Interrogatoire, examen, syndrome, hypothèses, examens, interprétation, diagnostic
                et prise en charge — avec correction à chaque décision.
              </p>
            </div>
            <div className="p-5">
              <Link
                to="/pro"
                search={{ specialty: diagnosticSpecialty(dx.specialty) }}
                className={buttonVariants({ size: "lg", className: "w-full" })}
              >
                Débloquer la spécialité · 27 000 Ar
                <ArrowRight className="size-4" />
              </Link>
              <Link to="/cas" className="mt-3 block text-center text-sm text-muted">
                Retour aux 42 démarches
              </Link>
            </div>
          </section>
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
                void navigate({ to: "/cas" });
              }}
            >
              Enregistrer
            </Button>
          </div>
        ) : current ? (
          <div className="mt-8">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">{current.title}</p>
            <p className="mt-2 text-sm text-muted">{current.lead}</p>
            <p className="mt-4 font-display text-xl font-medium leading-snug">{current.prompt}</p>
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
                      <span className="font-mono text-xs text-muted">{String.fromCharCode(65 + i)}</span>
                      <span className="flex-1">{choice}</span>
                      {revealed && isCorrect ? <Check className="size-4 text-primary" /> : null}
                      {revealed && isPicked && !isCorrect ? <X className="size-4 text-danger" /> : null}
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
      </Page>
    </Shell>
  );
}


function diagnosticSpecialty(specialty: string): PremiumSpecialtyId {
  if (specialty.includes("Cardiologie")) return "cardiologie";
  if (specialty.includes("Neurologie")) return "neurologie";
  if (specialty.includes("Dermatologie")) return "dermatologie";
  if (specialty.includes("Infectiologie")) return "infectiologie";
  return "urgences";
}

function diagnosticPack(specialty: string): string {
  const id = diagnosticSpecialty(specialty);
  if (id === "cardiologie") return "CARDIO_PACK_10";
  if (id === "neurologie") return "NEURO_PACK_10";
  if (id === "dermatologie") return "DERMATO_PACK_10";
  if (id === "infectiologie") return "INFECTIO_PACK_10";
  return "URGENCES_PACK_10";
}