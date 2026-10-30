import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, BookOpenCheck, CheckCircle2, ScrollText } from "lucide-react";
import { Page, PageHeader, Shell } from "@/components/shell";

export const Route = createFileRoute("/politique-editoriale")({
  component: PolitiqueEditorialePage,
});

const RULES = [
  {
    icon: ScrollText,
    title: "Une source par question, sans exception",
    body: "Chaque question référence au moins une source, sinon la publication est rejetée automatiquement par le contrôle qualité de contenu.",
  },
  {
    icon: BookOpenCheck,
    title: "Les tests ne valident pas la médecine",
    body: "Une suite de tests automatisés ne constitue jamais une validation médicale : elle garantit la structure du contenu, pas sa vérité clinique.",
  },
  {
    icon: CheckCircle2,
    title: "La preuve complète pour la revue complète",
    body: "Un deck « fully_reviewed » exige la preuve complète : relecteur nommé, qualification et sources de revue. Sinon le statut public reste « items prioritaires relus ».",
  },
];

function PolitiqueEditorialePage() {
  return (
    <Shell title="Politique éditoriale">
      <Page
        className="mx-auto max-w-2xl"
        header={
          <PageHeader
            kicker="Gouvernance"
            title="Notre politique éditoriale"
            description="Ce qu'Optimus est, ce qu'il n'est pas, et les règles que tout contenu publié doit respecter."
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
          <h2 className="text-sm font-medium">Ce qu&apos;Optimus est</h2>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            Un outil pédagogique pour les étudiants en médecine : des fiches, des cas et des
            questions sourcées (OMS, HAS, sociétés savantes), relues par des médecins, avec un
            statut de relecture public et daté sur chaque deck.
          </p>
        </section>

        <section className="mt-4 rounded-[var(--radius-lg)] bg-card p-5 shadow-[var(--shadow-border)]">
          <h2 className="text-sm font-medium">Ce qu&apos;Optimus n&apos;est pas</h2>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            Ni un outil de diagnostic, ni une aide à la prescription, ni un substitut au jugement
            clinique. Aucun contenu ne doit être appliqué à un patient. En situation réelle, les
            recommandations locales et l&apos;avis d&apos;un clinicien priment toujours.
          </p>
        </section>

        <section className="mt-4 space-y-3">
          {RULES.map((rule) => (
            <article
              key={rule.title}
              className="flex items-start gap-3 rounded-[var(--radius-lg)] bg-card p-4 shadow-[var(--shadow-border)]"
            >
              <rule.icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-medium">{rule.title}</h2>
                <p className="mt-1 text-xs leading-relaxed text-muted">{rule.body}</p>
              </div>
            </article>
          ))}
        </section>

        <section className="mt-6 rounded-[var(--radius-lg)] bg-card p-5 shadow-[var(--shadow-border)]">
          <h2 className="text-sm font-medium">Aller plus loin</h2>
          <ul className="mt-3 space-y-1.5 text-xs">
            <li>
              <Link
                to="/methodologie"
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                Comment nous produisons le contenu
              </Link>
            </li>
            <li>
              <Link
                to="/sources"
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                Nos sources
              </Link>
            </li>
            <li>
              <Link
                to="/validation-clinique"
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                Le protocole de validation clinique
              </Link>
            </li>
            <li>
              <Link
                to="/conseil-editorial"
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                Le conseil éditorial et l&apos;état des relectures
              </Link>
            </li>
          </ul>
        </section>

      </Page>
    </Shell>
  );
}
