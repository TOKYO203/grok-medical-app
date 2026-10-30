import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Page, PageHeader, Shell } from "@/components/shell";

export const Route = createFileRoute("/methodologie")({
  component: MethodologiePage,
});

const STEPS = [
  {
    title: "Programme d'abord",
    body: "Chaque contenu est rattaché à un item du programme officiel (240 items, Madagascar 2025) — rien n'est publié hors référentiel.",
  },
  {
    title: "Sources avant texte",
    body: "La rédaction part des sources primaires ou de recommandations professionnelles datées, avec des unités cliniques standardisées (SI-first).",
  },
  {
    title: "Garde-fous automatisés",
    body: "Le registre éditorial et les statuts de revue sont verrouillés par les tests : un contenu non conforme ne passe pas la publication.",
  },
  {
    title: "Relecture humaine",
    body: "Les statuts sont publics et datés : revue structurale, puis items prioritaires relus, puis revue complète (relecteur nommé, qualification, sources).",
  },
  {
    title: "Correction traçable",
    body: "Tout signalement est trié (critique / majeur / mineur), masqué immédiatement si critique, corrigé puis relu avant republication.",
  },
];

function MethodologiePage() {
  return (
    <Shell title="Méthodologie">
      <Page
        className="mx-auto max-w-2xl"
        header={
          <PageHeader
            kicker="Gouvernance"
            title="Comment nous produisons le contenu"
            description="Cinq étapes, du référentiel jusqu'à la correction — les mêmes pour chaque fiche, cas et deck."
          />
        }
      >
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-fg"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Retour
        </Link>

        <ol className="mt-6 space-y-3">
          {STEPS.map((step, index) => (
            <li
              key={step.title}
              className="flex items-start gap-3 rounded-[var(--radius-lg)] bg-card p-4 shadow-[var(--shadow-border)]"
            >
              <span
                aria-hidden
                className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary-soft font-mono text-[11px] font-medium text-primary"
              >
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-medium">{step.title}</h2>
                <p className="mt-1 text-xs leading-relaxed text-muted">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <section className="mt-4 rounded-[var(--radius-lg)] bg-card p-5 shadow-[var(--shadow-border)]">
          <p className="text-xs leading-relaxed text-muted">
            Le détail du protocole (statuts, preuve minimale, unités) est public sur la page{" "}
            <Link
              to="/validation-clinique"
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              Validation clinique
            </Link>
            , et l&apos;état des relectures par deck sur la page{" "}
            <Link
              to="/conseil-editorial"
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              Conseil éditorial
            </Link>
            .
          </p>
        </section>

      </Page>
    </Shell>
  );
}
