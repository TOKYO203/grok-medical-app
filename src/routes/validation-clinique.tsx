import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink, FileCheck2, ScrollText, Stethoscope } from "lucide-react";
import { Page, PageHeader, Shell } from "@/components/shell";
import { MEDICAL_CONTENT_UPDATED_AT, MEDICAL_CONTENT_VERSION } from "@/content/medical-version";

export const Route = createFileRoute("/validation-clinique")({
  component: ValidationCliniquePage,
});

const DOC_URL =
  "https://github.com/TOKYO203/grok-medical-app/blob/main/docs/CLINICAL-VALIDATION.md";

const STEPS = [
  {
    icon: ScrollText,
    title: "Sources citées par fiche",
    body: "Chaque question, cas clinique ou deck cite ses sources médicales — portails officiels et sociétés savantes — affichées en clair sous le contenu.",
  },
  {
    icon: Stethoscope,
    title: "Relecture humaine datée",
    body: "Les items prioritaires sont relus par un médecin. Le statut de revue de chaque deck est public, daté et sans sur-claim.",
  },
  {
    icon: FileCheck2,
    title: "Correction traçable",
    body: "Un contenu signalé est masqué puis corrigé après relecture humaine qualifiée, selon la procédure documentée dans le dépôt.",
  },
];

function ValidationCliniquePage() {
  return (
    <Shell title="Validation clinique">
      <Page
        className="mx-auto max-w-2xl"
        header={
          <PageHeader
            kicker="Crédibilité"
            title="Comment le contenu est validé"
            description={
              "Cadre de validation du contenu médical d'Optimus — version du contenu " +
              MEDICAL_CONTENT_VERSION +
              "."
            }
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

        <section className="mt-6 space-y-3">
          {STEPS.map((step) => (
            <article
              key={step.title}
              className="flex items-start gap-3 rounded-[var(--radius-lg)] bg-card p-4 shadow-[var(--shadow-border)]"
            >
              <step.icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-medium">{step.title}</h2>
                <p className="mt-1 text-xs leading-relaxed text-muted">{step.body}</p>
              </div>
            </article>
          ))}
        </section>

        <section className="mt-6 rounded-[var(--radius-lg)] bg-card p-5 shadow-[var(--shadow-border)]">
          <h2 className="text-sm font-medium">Ce qu&apos;Optimus n&apos;est pas</h2>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            Optimus est un outil éducatif : il ne pose aucun diagnostic, ne prescrit rien et ne
            fournit aucune conduite à tenir. « Optimus Clinical AI » est un tuteur pédagogique,
            pas un dispositif médical. Une suite de tests automatisés ne constitue jamais, à
            elle seule, une validation médicale — la relecture humaine reste la règle.
          </p>
          <p className="mt-3 text-xs leading-relaxed text-muted">
            Contenu médical {MEDICAL_CONTENT_VERSION} · registre éditorial mis à jour le{" "}
            {MEDICAL_CONTENT_UPDATED_AT}.
          </p>
        </section>

        <a
          href={DOC_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-[#A67C1E] px-4 py-2.5 text-sm font-medium text-[#A67C1E] transition-colors hover:bg-[#A67C1E] hover:text-[#F4F1FA]"
        >
          Lire le protocole complet sur GitHub
          <ExternalLink className="size-4" aria-hidden />
        </a>
      </Page>
    </Shell>
  );
}
