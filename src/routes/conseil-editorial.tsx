import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, BookOpenCheck, Flag, Mail, ScrollText, ShieldCheck } from "lucide-react";
import { Page, PageHeader, Shell } from "@/components/shell";
import { DECK_MEDICAL_REVIEW } from "@/content/deck-review-status";
import {
  MEDICAL_CONTENT_UPDATED_AT,
  MEDICAL_CONTENT_VERSION,
} from "@/content/medical-version";

export const Route = createFileRoute("/conseil-editorial")({
  component: ConseilEditorialPage,
});

const PILLARS = [
  {
    icon: ScrollText,
    title: "Sources avant tout",
    body: "Chaque fiche référence des portails officiels et sociétés savantes, affichées en clair sous le contenu.",
  },
  {
    icon: ShieldCheck,
    title: "Relecture humaine",
    body: "Les items prioritaires sont relus par un médecin ; le statut de chaque deck est public et daté.",
  },
  {
    icon: Flag,
    title: "Signalement",
    body: "Le bouton de signalement présent sous le contenu déclenche un masquage immédiat puis une correction relue.",
  },
  {
    icon: BookOpenCheck,
    title: "Traçabilité",
    body: "Le registre éditorial (identités, périmètres, chevauchements) est versionné dans le dépôt.",
  },
];

function ConseilEditorialPage() {
  const entries = Object.entries(DECK_MEDICAL_REVIEW);
  const reviewed = entries.filter(([, review]) => review.status !== "structural_only");
  const lastVerified = reviewed.reduce(
    (max, [, review]) => (review.verifiedAt && review.verifiedAt > max ? review.verifiedAt : max),
    "",
  );

  return (
    <Shell title="Conseil éditorial">
      <Page
        className="mx-auto max-w-2xl"
        header={
          <PageHeader
            kicker="Gouvernance"
            title="Conseil éditorial"
            description="Comment Optimus produit, relit et corrige son contenu médical."
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
          <h2 className="text-sm font-medium">Mission</h2>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            Publier un contenu médical pédagogique honnête : sources citées par fiche, relecture
            humaine datée, erreurs corrigées au grand jour. Optimus est un outil éducatif — il ne
            remplace ni une formation encadrée, ni le jugement clinique d&apos;un praticien formé.
          </p>
        </section>

        <section className="mt-4 space-y-3">
          {PILLARS.map((item) => (
            <article
              key={item.title}
              className="flex items-start gap-3 rounded-[var(--radius-lg)] bg-card p-4 shadow-[var(--shadow-border)]"
            >
              <item.icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-medium">{item.title}</h2>
                <p className="mt-1 text-xs leading-relaxed text-muted">{item.body}</p>
              </div>
            </article>
          ))}
        </section>

        <section className="mt-6 rounded-[var(--radius-lg)] bg-card p-5 shadow-[var(--shadow-border)]">
          <h2 className="text-sm font-medium">État de la relecture médicale</h2>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            {reviewed.length} decks sur {entries.length} ont des items prioritaires relus par un
            médecin{lastVerified ? " — dernier point le " + lastVerified : ""}. Les autres decks
            suivent une revue structurale, relecture prioritaire en cours. Le détail par deck est
            affiché sur chaque page de parcours, et le protocole complet sur la page{" "}
            <Link
              to="/validation-clinique"
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              Validation clinique
            </Link>
            .
          </p>
          <ul className="mt-3 space-y-1.5">
            {reviewed.map(([deckId, review]) => (
              <li
                key={deckId}
                className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] bg-secondary/60 px-3 py-1.5 text-xs"
              >
                <span className="font-mono text-[11px] text-fg">{deckId}</span>
                <span className="text-muted">
                  {review.status === "fully_reviewed" ? "revue complète" : "items prioritaires relus"}
                  {review.verifiedAt ? " · " + review.verifiedAt : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-4 rounded-[var(--radius-lg)] bg-card p-5 shadow-[var(--shadow-border)]">
          <h2 className="text-sm font-medium">Cadre d&apos;usage et crédits</h2>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            « Optimus Clinical AI » est un tuteur pédagogique : ni diagnostic, ni conduite à tenir,
            pas un dispositif médical. Références de lecture créditées : J. Hampton, The ECG Made
            Easy (Elsevier) et recommandations de la Société européenne de cardiologie (ESC).
          </p>
          <p className="mt-3 text-xs text-subtle">
            Contenu médical {MEDICAL_CONTENT_VERSION} · registre éditorial mis à jour le{" "}
            {MEDICAL_CONTENT_UPDATED_AT}.
          </p>
        </section>

        <section className="mt-4 rounded-[var(--radius-lg)] bg-card p-5 shadow-[var(--shadow-border)]">
          <h2 className="text-sm font-medium">Signaler ou rejoindre la relecture</h2>
          <a
            href="mailto:fondationoptimus@gmail.com?subject=Contenu%20medical%20Optimus"
            className="mt-3 inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-[#A67C1E] px-4 py-2 text-sm font-medium text-[#A67C1E] transition-colors hover:bg-[#A67C1E] hover:text-[#F4F1FA]"
          >
            <Mail className="size-4" aria-hidden />
            Écrire à la Fondation
          </a>
        </section>
      </Page>
    </Shell>
  );
}
