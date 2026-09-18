import { createFileRoute, Link } from "@tanstack/react-router";
import { Page, SectionTitle, Shell } from "@/components/shell";

export const Route = createFileRoute("/confidentialite")({ component: PrivacyPage });

function PrivacyPage() {
  return (
    <Shell title="Confidentialité">
      <Page className="mx-auto max-w-2xl space-y-6 py-8 pb-32">
        <header>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">Version 1.0 · septembre 2026</p>
          <h1 className="mt-2 font-display text-3xl font-medium tracking-tight">Politique de confidentialité Optimus</h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            Optimus est un outil de formation médicale. Cette page décrit les données utilisées par l’application,
            leur finalité et les contrôles disponibles pour l’utilisateur. Elle ne transforme pas Optimus en dossier
            médical ni en outil de prise en charge clinique.
          </p>
        </header>

        <section className="rounded-[var(--radius-xl)] bg-card p-5 shadow-[var(--shadow-border)]">
          <SectionTitle kicker="Minimisation" title="Données utilisées" />
          <ul className="space-y-2 text-sm leading-6 text-muted">
            <li>• Compte : identifiant technique, nom affiché, adresse liée à l’authentification et sessions.</li>
            <li>• Apprentissage : progression, XP, maîtrise, réponses et état de synchronisation.</li>
            <li>• Premium : commandes, statut, référence de transaction, empreinte SHA-256 de la preuve et liaison appareil.</li>
            <li>• Enquêtes : réponses, consentement et métadonnées minimales prévues par l’enquête.</li>
            <li>• Qualité : signalements de contenu et informations nécessaires à leur traitement.</li>
          </ul>
          <p className="mt-3 text-xs leading-5 text-muted">
            Les fichiers bruts de preuve de paiement et les clés privées d’appareil restent sur l’appareil ; ils ne
            font pas partie de la sauvegarde cloud Optimus.
          </p>
        </section>

        <section className="rounded-[var(--radius-xl)] bg-card p-5 shadow-[var(--shadow-border)]">
          <SectionTitle kicker="Finalités" title="Pourquoi ces données sont utilisées" />
          <p className="text-sm leading-6 text-muted">
            Elles servent à restaurer la progression entre appareils, sécuriser les achats et licences, empêcher la
            réutilisation d’une preuve de paiement, produire les résultats d’enquêtes autorisés, corriger les contenus
            signalés et assurer la sécurité technique du service.
          </p>
        </section>

        <section className="rounded-[var(--radius-xl)] bg-card p-5 shadow-[var(--shadow-border)]">
          <SectionTitle kicker="Stockage" title="Local, cloud et journaux techniques" />
          <p className="text-sm leading-6 text-muted">
            Optimus est conçu local-first : une partie de la progression et des contenus importés est conservée dans
            le navigateur ou IndexedDB. Lorsque la synchronisation est active, la progression utile est copiée vers
            le serveur du compte. Les journaux applicatifs sont volontairement limités à des éléments techniques tels
            que l’identifiant de requête, la route, le statut HTTP et la durée ; ils ne doivent pas contenir le corps
            des requêtes, les cookies, les réponses médicales, les références de preuve brutes ni les clés privées.
          </p>
        </section>

        <section className="rounded-[var(--radius-xl)] bg-card p-5 shadow-[var(--shadow-border)]">
          <SectionTitle kicker="Conservation" title="Suppression et durée utile" />
          <p className="text-sm leading-6 text-muted">
            La progression pédagogique cloud peut être supprimée depuis « Mes données » ; cette suppression suspend
            aussi la synchronisation afin qu’un autre appareil ne recrée pas immédiatement la sauvegarde. Les données
            commerciales et d’audit liées à une commande sont séparées de la progression : elles sont conservées tant
            qu’elles restent nécessaires au suivi de la commande, à la prévention de la fraude, au support et à la
            gestion des licences. Leur durée légale/commerciale finale doit être validée avant la mise en production
            commerciale dans chaque juridiction visée.
          </p>
        </section>

        <section className="rounded-[var(--radius-xl)] bg-card p-5 shadow-[var(--shadow-border)]">
          <SectionTitle kicker="Vos contrôles" title="Exporter ou supprimer" />
          <p className="text-sm leading-6 text-muted">
            Un utilisateur connecté peut exporter les données Optimus associées à son compte et supprimer sa
            progression pédagogique cloud. La suppression complète du compte d’authentification et les obligations de
            conservation commerciale restent traitées séparément afin d’éviter de promettre une suppression que le
            système ou la réglementation ne permettrait pas réellement.
          </p>
          <Link to="/donnees" className="mt-4 inline-flex min-h-11 items-center font-medium text-primary">
            Gérer mes données →
          </Link>
        </section>

        <section className="rounded-[var(--radius-xl)] bg-card p-5 shadow-[var(--shadow-border)]">
          <SectionTitle kicker="Enquêtes" title="Consentement et réponses" />
          <p className="text-sm leading-6 text-muted">
            Une enquête qui exige un consentement ne peut pas accepter la réponse sans celui-ci. Les enquêtes
            nominatives utilisent l’identité de session côté serveur plutôt qu’un identifiant déclaré par le client.
            Les résultats détaillés sont réservés aux comptes autorisés à les administrer.
          </p>
        </section>

        <p className="text-xs leading-5 text-muted">
          Cette version documente le comportement technique actuel d’Optimus. Une validation juridique locale reste
          requise avant une exploitation commerciale à grande échelle.
        </p>

        <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <Link to="/conditions" className="font-medium text-primary">Conditions d’utilisation</Link>
          <Link to="/contact" className="font-medium text-primary">Contact / signalement</Link>
          <Link to="/a-propos" className="font-medium text-primary">À propos</Link>
        </nav>
      </Page>
    </Shell>
  );
}
