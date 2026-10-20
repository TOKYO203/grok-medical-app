import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  Bell,
  Building2,
  Check,
  Clock3,
  Globe,
  Minus,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { Page, PageHeader, Shell } from "@/components/shell";
import { Badge } from "@/components/ui/ds/Badge";
import { Button } from "@/components/ui/ds/Button";
import { ButtonLink } from "@/components/ui/ds/ButtonLink";
import { Card } from "@/components/ui/ds/Card";
import {
  CURRENCIES,
  detectPreferredCurrency,
  formatPrice,
  PRICES_MGA,
  SUBSCRIPTION_MONTHS,
  type Currency,
} from "@/content/pricing";

export const Route = createFileRoute("/tarifs")({ component: TarifsPage });

/* ============================================================================
   /tarifs — page de l'OFFRE, pas du catalogue.

   RÈGLE DE CETTE PAGE : n'annoncer payable que ce qui est RÉELLEMENT payable.

   Le produit va devenir un ABONNEMENT TRIMESTRIEL nominatif (3 mois). Le tunnel
   de commande, lui, ne sait facturer aujourd'hui que les offres à l'unité
   (1 module, 1 spécialité) : il enregistre une référence de paiement Mobile
   Money et la valide côté serveur. Vendre l'abonnement tant que son produit
   n'existe pas côté serveur reviendrait à encaisser un paiement qu'on ne sait
   pas honorer — le pire état possible pour la confiance.

   La page est donc construite en deux blocs, dans cet ordre :
     1. « Disponible aujourd'hui » — les offres à l'unité, avec le tunnel réel
        (Mobile Money) et le prix lu dans `pricing.ts` ;
     2. « Abonnement Trimestriel » — annoncé, daté et prix affiché, mais marqué
        « Prochainement » : aucune action de paiement tant qu'il n'est pas
        facturable, seulement un moyen d'être averti de l'ouverture.

   ⚠️ Le prix vit dans `src/content/pricing.ts` (source unique) : aucun montant
   n'est écrit en dur dans cette page. Le jour où l'abonnement devient
   facturable, c'est CE fichier et `orderProduct()` qui changent — et le bloc 2
   remonte en bloc 1 (voir docs/DECISIONS.md, ABO-1).
   ============================================================================ */

type FeatureValue = boolean | "limité";

const FEATURES: { label: string; free: FeatureValue; premium: FeatureValue }[] = [
  { label: "Modules ECG interactifs (23 cas)", free: true, premium: true },
  { label: "Auscultation cardio-pulmonaire", free: true, premium: true },
  { label: "Calculateurs cliniques", free: true, premium: true },
  { label: "Programme national (240 items)", free: true, premium: true },
  { label: "Contenu Premium complet (cours, cas, démarches)", free: false, premium: true },
  { label: "Cas cliniques détaillés", free: "limité", premium: true },
  { label: "Démarches cliniques complètes", free: false, premium: true },
  { label: "Mises à jour de contenu incluses", free: false, premium: true },
  { label: "Accès hors-ligne sur les appareils connectés", free: false, premium: true },
];

/** Étapes du paiement mobile — texte affiché tel quel dans le panneau. */
const MOBILE_MONEY_STEPS = [
  "Vous lancez la commande depuis votre compte Optimus.",
  "Vous recevez les coordonnées officielles (MVola, Orange Money ou Airtel Money) et le montant exact à régler.",
  "Après paiement, un SMS de confirmation valide la transaction : l'accès s'active sur votre compte.",
] as const;

/**
 * Offres réellement facturables aujourd'hui par le tunnel de commande
 * (`src/content/purchase-order.ts` : offres `deck` et `specialty`).
 * Le prix n'est jamais recopié ici : il est lu dans `pricing.ts`.
 */
const UNIT_OFFERS = [
  {
    id: "deck",
    title: "1 module",
    detail: "Une étape de parcours : questions, corrections et progression.",
    price: PRICES_MGA.deck,
    recommended: false,
  },
  {
    id: "specialty",
    title: "1 spécialité",
    detail: "Tout le contenu d'une spécialité, mis à jour pendant l'accès.",
    price: PRICES_MGA.specialty,
    recommended: true,
  },
] as const;

function FeatureCell({ value }: { value: FeatureValue }) {
  if (value === true) {
    return <Check className="size-4 text-[var(--tone-accent)]" aria-label="Inclus" />;
  }
  if (value === "limité") {
    return <span className="text-[11px] font-medium text-muted">Limité</span>;
  }
  return <Minus className="size-4 text-muted/50" aria-label="Non inclus" />;
}

function TarifsPage() {
  const [currency, setCurrency] = useState<Currency>(() => detectPreferredCurrency());
  const [channel, setChannel] = useState<"mobile" | "international">("mobile");

  const quarter = PRICES_MGA.subscriptionQuarter;
  const monthly = useMemo(() => Math.round(quarter / SUBSCRIPTION_MONTHS), [quarter]);

  return (
    <Shell title="Tarifs">
      <Page
        className="mx-auto max-w-5xl"
        header={
          <PageHeader
            kicker="Tarifs"
            title="Le contenu complet, au plus juste"
            description={`L'abonnement trimestriel (${SUBSCRIPTION_MONTHS} mois, tout le contenu Premium) ouvre prochainement. En attendant, chaque module et chaque spécialité reste payable à l'unité, sans engagement.`}
          />
        }
      >
        {/* Sélecteur de devise (A01) — les montants restent en Ariary au paiement. */}
        <div className="mt-6 flex flex-wrap items-center gap-2" role="group" aria-label="Devise d'affichage des prix">
          {CURRENCIES.map((code) => (
            <Button
              key={code}
              size="sm"
              variant={currency === code ? "primary" : "secondary"}
              aria-pressed={currency === code}
              onClick={() => setCurrency(code)}
              className="uppercase tracking-wide"
            >
              {code}
            </Button>
          ))}
          <p className="w-full text-xs leading-relaxed text-muted sm:w-auto sm:flex-1 sm:pl-2">
            Conversion indicative : le paiement officiel est facturé en Ariary.
          </p>
        </div>

        {/* Comparatif Gratuit / Premium */}
        <section className="mt-8" aria-labelledby="comparatif-titre">
          <h2 id="comparatif-titre" className="sr-only">
            Comparatif Gratuit et Premium
          </h2>
          <Card padding="none" className="overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-border/60 px-4 py-3 md:grid-cols-[2fr_auto_auto] md:px-6">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Fonctionnalités</span>
              <span className="w-16 text-center text-xs font-semibold uppercase tracking-[0.14em] text-muted">Gratuit</span>
              <span className="w-16 text-center text-xs font-semibold uppercase tracking-[0.14em] text-[var(--tone-accent)]">Premium</span>
            </div>
            {FEATURES.map((feature) => (
              <div
                key={feature.label}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-border/40 px-4 py-3 last:border-b-0 md:grid-cols-[2fr_auto_auto] md:px-6"
              >
                <span className="text-sm text-fg">{feature.label}</span>
                <span className="flex w-16 justify-center"><FeatureCell value={feature.free} /></span>
                <span className="flex w-16 justify-center"><FeatureCell value={feature.premium} /></span>
              </div>
            ))}
          </Card>
        </section>

        {/* 1 — Ce qui est facturable aujourd'hui : les offres à l'unité */}
        <section className="mt-12" aria-labelledby="offres-titre" data-tarifs-offers="unit">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <h2 id="offres-titre" className="font-display text-2xl font-medium tracking-tight">
                Disponible aujourd&apos;hui
              </h2>
              <p className="mt-1 text-sm text-muted">
                Paiement mobile, accès ouvert dès la validation de la transaction.
              </p>
            </div>
            <Badge tone="success">Paiement ouvert</Badge>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {UNIT_OFFERS.map((offer) => (
              <Card
                key={offer.id}
                data-tarifs-unit={offer.id}
                className={offer.recommended ? "border-[var(--tone-accent-border)]" : undefined}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-fg">{offer.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted">{offer.detail}</p>
                  </div>
                  {offer.recommended ? <Badge tone="accent">Le plus choisi</Badge> : null}
                </div>
                <p className="mt-3 font-display text-2xl font-medium text-fg" data-tarifs-unit-price>
                  {formatPrice(offer.price, currency)}
                </p>
              </Card>
            ))}
          </div>

          <Card className="mt-3">
            <div className="flex items-center gap-2">
              <Smartphone className="size-4 shrink-0 text-[var(--tone-accent)]" aria-hidden="true" />
              <p className="text-sm font-medium text-fg">Comment payer</p>
            </div>
            <ol className="mt-3 space-y-2 text-sm text-muted">
              {MOBILE_MONEY_STEPS.map((step, index) => (
                <li key={step} className="flex gap-2">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary font-mono text-[10px] font-semibold text-muted">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <ButtonLink to="/pro" fullWidth className="mt-4" data-tarifs-pay="mobile-money">
              Commander par Mobile Money
              <ArrowRight className="size-4" aria-hidden="true" />
            </ButtonLink>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              Aucune carte bancaire n&apos;est demandée. La commande est enregistrée côté serveur,
              puis validée après réception du paiement.
            </p>
          </Card>
        </section>

        {/* 2 — L'abonnement : annoncé avec son prix, pas encore facturable */}
        <section className="mt-12" aria-labelledby="abonnement-titre">
          <Card
            className="relative"
            padding="lg"
            data-tarifs-offer="subscription"
            data-tarifs-subscription-state="soon"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <Badge tone="neutral">Prochainement</Badge>
                <h2 id="abonnement-titre" className="mt-3 font-display text-2xl font-medium tracking-tight">
                  Abonnement Trimestriel
                </h2>
                <p className="mt-1 text-sm text-muted">
                  Tout le contenu Premium, {SUBSCRIPTION_MONTHS} mois, sur votre compte.
                </p>
              </div>
              <div className="text-right" data-tarifs-price>
                <p className="font-display text-3xl font-medium text-fg">
                  {formatPrice(quarter, currency)}
                </p>
                <p className="text-sm text-muted">/ {SUBSCRIPTION_MONTHS} mois</p>
                <p className="mt-1 text-xs text-muted">
                  soit {formatPrice(monthly, currency)} par mois
                </p>
              </div>
            </div>

            <ul className="mt-5 grid gap-2 text-sm text-muted sm:grid-cols-2">
              {[
                "Cours, cas cliniques et démarches : tout le catalogue Premium",
                "Mises à jour de contenu incluses pendant l'abonnement",
                "Hors-ligne sur tous vos appareils connectés",
                "Un seul abonnement, valable quelle que soit la spécialité",
              ].map((line) => (
                <li key={line} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-[var(--tone-accent)]" aria-hidden="true" />
                  {line}
                </li>
              ))}
            </ul>

            {/* Canaux de paiement prévus — aucun bouton actif avant l'ouverture. */}
            <div className="mt-6" data-tarifs-channels>
              <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Moyen de paiement prévu">
                <Button
                  size="sm"
                  role="tab"
                  id="canal-mobile-tab"
                  aria-selected={channel === "mobile"}
                  aria-controls="canal-mobile"
                  variant={channel === "mobile" ? "primary" : "ghost"}
                  onClick={() => setChannel("mobile")}
                >
                  <Smartphone className="size-4" aria-hidden="true" />
                  Madagascar
                </Button>
                <Button
                  size="sm"
                  role="tab"
                  id="canal-international-tab"
                  aria-selected={channel === "international"}
                  aria-controls="canal-international"
                  variant={channel === "international" ? "primary" : "ghost"}
                  onClick={() => setChannel("international")}
                >
                  <Globe className="size-4" aria-hidden="true" />
                  International
                </Button>
              </div>

              {channel === "mobile" ? (
                <div
                  id="canal-mobile"
                  role="tabpanel"
                  aria-labelledby="canal-mobile-tab"
                  className="mt-4 rounded-[var(--r-lg)] bg-secondary p-[var(--sp-4)]"
                  data-tarifs-channel="mobile"
                >
                  <p className="text-sm font-medium text-fg">Paiement par Mobile Money</p>
                  <p className="mt-2 text-sm text-muted">
                    À l&apos;ouverture, l&apos;abonnement se règle comme les offres actuelles :
                    coordonnées officielles envoyées depuis votre compte, puis validation par SMS.
                  </p>
                  <Button variant="secondary" fullWidth disabled className="mt-4" data-tarifs-pay="mobile-money-soon">
                    Bientôt disponible
                  </Button>
                </div>
              ) : (
                <div
                  id="canal-international"
                  role="tabpanel"
                  aria-labelledby="canal-international-tab"
                  className="mt-4 rounded-[var(--r-lg)] bg-secondary p-[var(--sp-4)]"
                  data-tarifs-channel="international"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-fg">Paiement par carte bancaire</p>
                    <Badge tone="neutral">Bientôt</Badge>
                  </div>
                  <p className="mt-3 text-sm text-muted">
                    Le paiement international (Lemon Squeezy) est en préparation. En attendant,
                    les offres à l&apos;unité restent payables par Mobile Money à Madagascar.
                  </p>
                  <Button variant="secondary" fullWidth disabled className="mt-4" data-tarifs-pay="lemon-squeezy">
                    Bientôt disponible
                  </Button>
                </div>
              )}
            </div>

            <ButtonLink to="/contact" variant="secondary" fullWidth className="mt-4" data-tarifs-notify>
              <Bell className="size-4" aria-hidden="true" />
              Être averti de l&apos;ouverture
            </ButtonLink>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              Aucun prélèvement et aucune reconduction : cet abonnement n&apos;est pas encore
              commercialisé, et rien ne peut être acheté avant son ouverture.
            </p>
          </Card>
        </section>

        {/* Offre École */}
        <section className="mt-12">
          <Card className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <Building2 className="mt-1 size-6 shrink-0 text-[var(--tone-accent)]" aria-hidden="true" />
              <div>
                <h2 className="font-display text-xl font-medium text-fg">Offre École &amp; Établissement</h2>
                <p className="mt-1 text-sm text-muted">
                  Licences multi-sièges pour facultés, associations et groupes d'étudiants.
                  Tarif dégressif et accompagnement dédié.
                </p>
              </div>
            </div>
            <ButtonLink to="/contact" variant="secondary" className="shrink-0">
              Demander un devis
              <ArrowRight className="size-4" aria-hidden="true" />
            </ButtonLink>
          </Card>
        </section>

        {/* Essai gratuit — un seul par compte */}
        <section className="mt-10" aria-labelledby="essai-titre">
          <Card className="flex flex-col gap-3 border-[var(--tone-accent-border)] md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 size-5 shrink-0 text-[var(--tone-accent)]" aria-hidden="true" />
              <div>
                <h2 id="essai-titre" className="font-display text-lg font-medium text-fg">
                  Essai · 7 jours offerts
                </h2>
                <p className="mt-1 text-sm text-muted">
                  Le contenu Premium en accès complet pendant 7 jours, sans carte bancaire.
                  Un seul essai par compte.
                </p>
              </div>
            </div>
            <ButtonLink to="/pro" variant="secondary" className="shrink-0">
              Démarrer mon essai
              <ArrowRight className="size-4" aria-hidden="true" />
            </ButtonLink>
          </Card>
        </section>

        {/* Note paiement */}
        <section className="mt-10 flex items-start gap-2 rounded-[var(--r-md)] bg-secondary p-[var(--sp-4)] text-sm text-muted">
          <Clock3 className="mt-0.5 size-4 shrink-0 text-[var(--tone-accent)]" aria-hidden="true" />
          <span>
            Facturation en Ariary (MVola, Orange Money, Airtel Money) sur les offres à l'unité. Les
            montants en dollars et en euros sont indicatifs, convertis au moment de l'affichage. Un
            accès acheté est nominatif : il suit votre compte, pas un appareil.
          </span>
        </section>
      </Page>
    </Shell>
  );
}
