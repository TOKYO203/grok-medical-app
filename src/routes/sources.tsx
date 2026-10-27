import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, BookOpen, Building2, Globe, History, Landmark } from "lucide-react";
import { Page, PageHeader, Shell } from "@/components/shell";
import { MedicalDisclaimer } from "@/components/legal/medical-disclaimer";

export const Route = createFileRoute("/sources")({
  component: SourcesPage,
});

const FAMILIES = [
  {
    icon: Globe,
    title: "Organisations de santé",
    body: "OMS et ministères de santé : recommandations et directives sanitaires de référence.",
  },
  {
    icon: Landmark,
    title: "Agences et autorités",
    body: "HAS et équivalents francophones : référentiels, évaluations et guides professionnels.",
  },
  {
    icon: Building2,
    title: "Sociétés savantes",
    body: "ESC en cardiologie, et les sociétés savantes de chaque spécialité citée.",
  },
  {
    icon: BookOpen,
    title: "Références pédagogiques créditées",
    body: "Ex. J. Hampton, The ECG Made Easy (Elsevier) — le crédit est affiché sur la page concernée.",
  },
  {
    icon: History,
    title: "Recommandations versionnées",
    body: "Toujours datées et versionnées : une recommandation n'est jamais citée sans sa version.",
  },
];

function SourcesPage() {
  return (
    <Shell title="Nos sources">
      <Page
        className="mx-auto max-w-2xl"
        header={
          <PageHeader
            kicker="Gouvernance"
            title="Nos sources"
            description="Les familles de sources qui fondent chaque fiche, cas et question publiés."
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

        <section className="mt-6 rounded-[var(--radius-lg)] bg-card p-5 shadow-[var(--shadow-border)]">
          <p className="text-xs leading-relaxed text-muted">
            Chaque fiche affiche ses sources en clair, section par section, sous le contenu. Plus
            de 220 sources HTTPS rien que pour les signes, et chaque question en référence au
            moins une — la publication est rejetée sinon.
          </p>
        </section>

        <section className="mt-4 space-y-3">
          {FAMILIES.map((family) => (
            <article
              key={family.title}
              className="flex items-start gap-3 rounded-[var(--radius-lg)] bg-card p-4 shadow-[var(--shadow-border)]"
            >
              <family.icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-medium">{family.title}</h2>
                <p className="mt-1 text-xs leading-relaxed text-muted">{family.body}</p>
              </div>
            </article>
          ))}
        </section>

        <section className="mt-6 rounded-[var(--radius-lg)] bg-card p-5 shadow-[var(--shadow-border)]">
          <p className="text-xs leading-relaxed text-muted">
            La règle complète est sur la page{" "}
            <Link
              to="/politique-editoriale"
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              Politique éditoriale
            </Link>
            , et la façon dont ces sources deviennent du contenu sur{" "}
            <Link
              to="/methodologie"
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              Méthodologie
            </Link>
            .
          </p>
        </section>

        <MedicalDisclaimer />
      </Page>
    </Shell>
  );
}
