import { createFileRoute, Link } from "@tanstack/react-router";
import { Page, SectionTitle, Shell } from "@/components/shell";

export const Route = createFileRoute("/conditions")({ component: TermsPage });

function TermsPage() {
  return (
    <Shell title="Conditions d’utilisation">
      <Page className="mx-auto max-w-2xl space-y-6 py-8 pb-32">
        <header>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">Version 1.0 · septembre 2026</p>
          <h1 className="mt-2 font-display text-3xl font-medium tracking-tight">Conditions d’utilisation Optimus</h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            Optimus accompagne l’apprentissage et la révision en médecine. Il ne remplace ni une formation encadrée,
            ni les recommandations officielles applicables, ni le jugement clinique d’un professionnel qualifié.
          </p>
        </header>

        <section className="rounded-[var(--radius-xl)] bg-card p-5 shadow-[var(--shadow-border)]">
          <SectionTitle kicker="Usage" title="Un outil éducatif" />
          <p className="text-sm leading-6 text-muted">
            Les Decks, quiz, cas, calculateurs et explications servent à étudier. Ils ne constituent pas une
            consultation médicale, une prescription, un diagnostic ou une consigne de prise en charge d’un patient.
            En situation réelle, l’utilisateur doit vérifier les informations pertinentes et suivre les protocoles,
            référentiels et responsabilités professionnelles applicables.
          </p>
        </section>

        <section className="rounded-[var(--radius-xl)] bg-card p-5 shadow-[var(--shadow-border)]">
          <SectionTitle kicker="Contenus" title="Sources, versions et corrections" />
          <p className="text-sm leading-6 text-muted">
            Optimus affiche des informations de source et de version lorsque le contenu le permet. La médecine évolue
            et une erreur peut subsister malgré les contrôles. Un contenu douteux doit être signalé ; un contenu jugé
            potentiellement dangereux peut être retiré ou corrigé en priorité, avec conservation de la traçabilité de
            la modification.
          </p>
          <Link to="/contact" className="mt-4 inline-flex min-h-11 items-center font-medium text-primary">
            Signaler un problème →
          </Link>
        </section>

        <section className="rounded-[var(--radius-xl)] bg-card p-5 shadow-[var(--shadow-border)]">
          <SectionTitle kicker="Compte" title="Sécurité et responsabilité" />
          <p className="text-sm leading-6 text-muted">
            L’utilisateur doit protéger l’accès à son compte et à son appareil. Les commandes Premium et licences sont
            liées au registre serveur et, selon le produit, à l’identité cryptographique de l’appareil. Il est interdit
            de contourner les contrôles d’accès, falsifier un paiement, réutiliser une preuve de paiement ou tenter de
            modifier localement un statut commercial géré par le serveur.
          </p>
        </section>

        <section className="rounded-[var(--radius-xl)] bg-card p-5 shadow-[var(--shadow-border)]">
          <SectionTitle kicker="Premium" title="Commandes et livraison" />
          <p className="text-sm leading-6 text-muted">
            Le prix et le statut d’une commande sont déterminés côté serveur. Aucun paiement ne doit être effectué tant
            que l’application n’affiche pas des coordonnées Mobile Money officielles configurées par le serveur. Une
            preuve transmise reste soumise à vérification avant validation et livraison du contenu Premium.
          </p>
        </section>

        <section className="rounded-[var(--radius-xl)] bg-card p-5 shadow-[var(--shadow-border)]">
          <SectionTitle kicker="Données" title="Confidentialité et contrôle" />
          <p className="text-sm leading-6 text-muted">
            L’utilisation des données est décrite dans la politique de confidentialité. Les utilisateurs connectés
            disposent de fonctions d’export et de suppression de leur progression pédagogique cloud. Certaines données
            commerciales ou d’audit peuvent devoir être conservées séparément de cette progression.
          </p>
          <Link to="/confidentialite" className="mt-4 inline-flex min-h-11 items-center font-medium text-primary">
            Lire la politique de confidentialité →
          </Link>
        </section>

        <section className="rounded-[var(--radius-xl)] bg-card p-5 shadow-[var(--shadow-border)]">
          <SectionTitle kicker="Licence" title="Contenus et propriété intellectuelle" />
          <p className="text-sm leading-6 text-muted">
            Les contenus fournis par Optimus restent soumis à leurs licences et droits applicables. Un achat Premium
            donne un droit d’utilisation dans le cadre prévu par l’offre ; il ne transfère pas les droits d’auteur et
            n’autorise pas la redistribution du Deck, de ses clés ou de son mécanisme de protection.
          </p>
        </section>

        <p className="text-xs leading-5 text-muted">
          Ces conditions décrivent le fonctionnement prévu de la V1 et doivent faire l’objet d’une validation juridique
          locale avant exploitation commerciale à grande échelle.
        </p>

        <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <Link to="/confidentialite" className="font-medium text-primary">Confidentialité</Link>
          <Link to="/contact" className="font-medium text-primary">Contact</Link>
          <Link to="/a-propos" className="font-medium text-primary">À propos</Link>
        </nav>
      </Page>
    </Shell>
  );
}
