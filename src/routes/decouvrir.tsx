import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BookOpenCheck,
  Building2,
  Check,
  GraduationCap,
  ListChecks,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Page, PageHeader, Shell } from "@/components/shell";
import { Badge } from "@/components/ui/ds/Badge";
import { ButtonLink } from "@/components/ui/ds/ButtonLink";
import { Card } from "@/components/ui/ds/Card";
import { formatPrice, PRICES_MGA, SUBSCRIPTION_MONTHS } from "@/content/pricing";

export const Route = createFileRoute("/decouvrir")({ component: DecouvrirPage });

/* ============================================================================
   /decouvrir — landing publique (Semaine 2 de la ROADMAP V2, spec
   docs/LANDING-V2-SPEC.md, positionnement docs/POSITIONING-V2.md).

   RÈGLES DE CETTE PAGE :
   - n'annoncer payable que ce qui est RÉELLEMENT payable (règle de /tarifs) :
     l'abonnement trimestriel Mobile Money (ABO-11). AUCUNE promesse de paiement
     carte tant que la boutique Lemon Squeezy n'est pas live — décision
     propriétaire : valider le produit à Madagascar d'abord (docs/PRICING-V2.md) ;
   - aucun montant écrit en dur : tout vient de src/content/pricing.ts
     (source unique, ABO-2) ;
   - copy conforme à docs/POSITIONING-V2.md § 3.4 : bénéfice utilisateur,
     apprentissage clinique, zéro jargon tech ;
   - chiffres de preuve mesurés le 2026-10-22 (docs/PRODUCT-VISION.md § 1.1) ;
   - public sans session : src/lib/cloud/gate.ts (PUBLIC_PATHS).
   ============================================================================ */

/* Chaque badge portant un `to` pointe vers la page publique qui le démontre
   (pages trust) — la confiance se démontre, elle ne se promet pas. */
const TRUST_BADGES = [
  {
    label: "567 questions expliquées et sourcées",
    to: "/methodologie" as const,
  },
  {
    label: "Sources affichées section par section (OMS, HAS, sociétés savantes)",
    to: "/sources" as const,
  },
  {
    label: "Statut de relecture médicale public et daté",
    to: "/politique-editoriale" as const,
  },
  {
    label: "Outil pédagogique, pas un outil de diagnostic",
  },
] as const;

const PILLARS = [
  {
    icon: ListChecks,
    title: "Le programme réel",
    body: "Révisez exactement les 240 items du concours, pas un programme étranger. Votre item, pas un item d'ailleurs.",
  },
  {
    icon: ShieldCheck,
    title: "Tout est sourcé",
    body: "Chaque affirmation affiche sa source et son statut de relecture. La confiance se démontre, elle ne se promet pas.",
  },
  {
    icon: BookOpenCheck,
    title: "Toujours savoir quoi réviser",
    body: "Une file de révision unique : questions dues, fiches à revoir, objectif du jour. Une session = 12 minutes.",
  },
] as const;

const PERSONAS = [
  {
    icon: GraduationCap,
    title: "Étudiante en médecine, Antananarivo",
    quote: "Ton item du programme, avec sa source, prêt à réviser aujourd'hui.",
    body: "Fin de cursus, concours d'internat en ligne de mire, un téléphone et un budget serré : le programme réel, en français, payable en Mobile Money.",
  },
  {
    icon: ArrowRight,
    title: "Étudiant francophone international",
    quote: "Des questions cliniques expliquées et sourcées, en français, au prix d'un café par mois.",
    body: "EDN, Afrique francophone, Océan Indien : des cas cliniques structurés, une progression suivie, sans payer 40 € par mois.",
  },
  {
    icon: Building2,
    title: "Responsable pédagogique",
    quote: "Un socle de révision sourcé et relu, avec un suivi de progression pour toute votre promotion.",
    body: "Licences multi-sièges, contenu vérifiable devant votre hiérarchie, statistiques de progression par promotion.",
    to: "/institutionnel" as const,
    cta: "Voir l'offre établissements",
  },
] as const;

const PROOF_STATS = [
  { value: "567 / 567", label: "questions expliquées et sourcées" },
  { value: "110", label: "fiches signes & syndromes, 220 sources vérifiables" },
  { value: "78", label: "calculateurs cliniques, 9 catégories" },
  { value: "4", label: "langues d'interface (fr, en, es, pt)" },
] as const;

const FAQ = [
  {
    q: "Le programme est-il vraiment couvert ?",
    a: "Les 240 items du programme officiel sont câblés dans l'app, et la couverture monte en charge spécialité par spécialité. Le statut de chaque contenu est affiché en clair : nous ne promettons jamais une couverture totale, nous montrons celle qui existe.",
  },
  {
    q: "Est-ce fiable médicalement ?",
    a: "Chaque fiche cite ses sources section par section, chaque deck porte un statut de relecture public et daté, et le protocole de validation est publié en entier sur la page Validation clinique.",
  },
  {
    q: "Comment payer ?",
    a: "Par Mobile Money (MVola, Orange Money, Airtel Money), en Ariary, sans carte bancaire. Aucun prélèvement automatique : l'accès s'arrête à la fin du trimestre si vous ne renouvelez pas.",
  },
  {
    q: "Et si la connexion est instable ?",
    a: "Optimus est une application installable (PWA) : le contenu déjà consulté reste disponible hors-ligne, et la progression est conservée sur votre appareil.",
  },
  {
    q: "Qui relit le contenu ?",
    a: "Le conseil éditorial encadre la production, les items prioritaires sont relus par un médecin, et tout signalement déclenche un masquage immédiat puis une correction relue. Tout est public sur la page Conseil éditorial.",
  },
] as const;

function DecouvrirPage() {
  return (
    <Shell title="Découvrir Optimus">
      <Page
        className="mx-auto max-w-4xl"
        header={
          <PageHeader
            kicker="Réviser l'internat"
            title="Réussissez l'internat avec des fiches sourcées, pas des photocopies."
            description="Le programme d'internat de Madagascar, item par item : chaque fiche cite sa source, chaque question est expliquée, votre journée de révision est déjà planifiée."
          />
        }
      >
        {/* Hero — CTA primaire vers le compte (essai 7 jours), secondaire vers
            les offres. « Voir le programme couvert » exigerait /programme,
            surface produit protégée par le gate : un visiteur sans compte y
            serait bloqué — la landing ne promet donc que des pages publiques. */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <ButtonLink to="/login" data-landing-cta="signup">
            <Sparkles className="size-4" aria-hidden="true" />
            Commencer gratuitement
          </ButtonLink>
          <ButtonLink to="/tarifs" variant="secondary" data-landing-cta="pricing">
            Voir les offres
            <ArrowRight className="size-4" aria-hidden="true" />
          </ButtonLink>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          Essai Premium de 7 jours offert, sans carte bancaire. Un seul essai par compte.
        </p>

        {/* Trust badges */}
        <section className="mt-8" aria-label="Preuves de confiance">
          <ul className="grid gap-2 sm:grid-cols-2">
            {TRUST_BADGES.map((badge) => (
              <li
                key={badge.label}
                className="flex items-start gap-2 rounded-[var(--r-md)] bg-secondary p-[var(--sp-3)] text-sm text-fg"
                data-landing-trust={badge.label}
              >
                <Check className="mt-0.5 size-4 shrink-0 text-[var(--tone-accent)]" aria-hidden="true" />
                {"to" in badge && badge.to ? (
                  <Link
                    to={badge.to}
                    className="font-medium text-primary underline-offset-2 hover:underline"
                  >
                    {badge.label}
                  </Link>
                ) : (
                  badge.label
                )}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">
            Détail public :{" "}
            <Link
              to="/conseil-editorial"
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              Conseil éditorial
            </Link>{" "}
            ·{" "}
            <Link
              to="/validation-clinique"
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              Validation clinique
            </Link>
          </p>
        </section>

        {/* 3 piliers de valeur */}
        <section className="mt-12" aria-labelledby="piliers-titre">
          <h2 id="piliers-titre" className="font-display text-2xl font-medium tracking-tight">
            Trois terrains, une seule promesse
          </h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {PILLARS.map((pillar) => (
              <Card key={pillar.title} data-landing-pillar={pillar.title}>
                <pillar.icon className="size-5 text-[var(--tone-accent)]" aria-hidden="true" />
                <h3 className="mt-2 font-medium text-fg">{pillar.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{pillar.body}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* Personas */}
        <section className="mt-12" aria-labelledby="personas-titre">
          <h2 id="personas-titre" className="font-display text-2xl font-medium tracking-tight">
            Pensé pour trois parcours
          </h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {PERSONAS.map((persona) => (
              <Card key={persona.title} data-landing-persona={persona.title}>
                <persona.icon className="size-5 text-[var(--tone-accent)]" aria-hidden="true" />
                <h3 className="mt-2 font-medium text-fg">{persona.title}</h3>
                <p className="mt-1 text-sm font-medium text-fg">« {persona.quote} »</p>
                <p className="mt-2 text-sm leading-relaxed text-muted">{persona.body}</p>
                {"to" in persona && persona.to ? (
                  <ButtonLink to={persona.to} variant="secondary" size="sm" className="mt-3">
                    {persona.cta}
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </ButtonLink>
                ) : null}
              </Card>
            ))}
          </div>
        </section>

        {/* Preuve de qualité — mesures docs/PRODUCT-VISION.md § 1.1 */}
        <section className="mt-12" aria-labelledby="preuve-titre">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="preuve-titre" className="font-display text-2xl font-medium tracking-tight">
              La qualité se mesure
            </h2>
            <Badge tone="neutral">Mesures du 22 octobre 2026</Badge>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            {PROOF_STATS.map((stat) => (
              <Card key={stat.label} data-landing-proof={stat.value}>
                <p className="font-display text-2xl font-medium text-fg">{stat.value}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted">{stat.label}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* Offres — n'annoncer payable que ce qui est réellement payable */}
        <section className="mt-12" aria-labelledby="offres-titre">
          <h2 id="offres-titre" className="font-display text-2xl font-medium tracking-tight">
            Des offres simples
          </h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <Card data-landing-offer="free">
              <h3 className="font-medium text-fg">Découverte</h3>
              <p className="mt-1 text-2xl font-medium text-fg">0 Ar</p>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Cas cliniques d'orientation, calculateurs, ECG et auscultation — puis essai
                Premium de 7 jours, sans carte bancaire.
              </p>
              <ButtonLink to="/login" variant="secondary" size="sm" className="mt-3">
                Créer mon compte
              </ButtonLink>
            </Card>
            <Card className="border-[var(--tone-accent-border)]" data-landing-offer="premium">
              <Badge tone="accent">Recommandé</Badge>
              <h3 className="mt-2 font-medium text-fg">Premium</h3>
              <p className="mt-1 text-2xl font-medium text-fg" data-landing-price>
                {formatPrice(PRICES_MGA.subscriptionQuarter, "MGA")}
              </p>
              <p className="text-xs text-muted">/ {SUBSCRIPTION_MONTHS} mois, payable en Mobile Money</p>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Tout le contenu Premium, toutes les spécialités, mises à jour incluses.
              </p>
              <ButtonLink to="/tarifs" size="sm" className="mt-3" data-landing-cta="premium">
                Voir l'abonnement
                <ArrowRight className="size-4" aria-hidden="true" />
              </ButtonLink>
            </Card>
            <Card data-landing-offer="institution">
              <h3 className="font-medium text-fg">Institution</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                Licences multi-sièges pour une promotion, une école ou un service hospitalier.
              </p>
              <ButtonLink to="/institutionnel" variant="secondary" size="sm" className="mt-3">
                Demander une démonstration
              </ButtonLink>
            </Card>
          </div>
        </section>

        {/* FAQ */}
        <section className="mt-12" aria-labelledby="faq-titre">
          <h2 id="faq-titre" className="font-display text-2xl font-medium tracking-tight">
            Questions fréquentes
          </h2>
          <div className="mt-4 space-y-3">
            {FAQ.map((item) => (
              <Card key={item.q} data-landing-faq={item.q}>
                <h3 className="text-sm font-medium text-fg">{item.q}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{item.a}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* CTA final */}
        <section
          className="mt-12 rounded-[var(--r-lg)] bg-secondary p-[var(--sp-6)] text-center"
          aria-labelledby="cta-final-titre"
          data-landing-cta="final"
        >
          <h2 id="cta-final-titre" className="font-display text-2xl font-medium tracking-tight text-fg">
            Ton item t'attend.
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
            Créez votre compte, lancez votre première session de révision aujourd'hui —
            l'essai de 7 jours est offert.
          </p>
          <ButtonLink to="/login" className="mt-4">
            Commencer gratuitement
            <ArrowRight className="size-4" aria-hidden="true" />
          </ButtonLink>
        </section>
      </Page>
    </Shell>
  );
}
