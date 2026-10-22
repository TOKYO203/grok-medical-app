import { useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  Building2,
  Check,
  Clock3,
  CreditCard,
  Globe,
  Minus,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { signOutCloud } from "@/lib/cloud/session";
import { useAuth } from "@/hooks/useAuth";
import {
  CARD_AUTH_MESSAGES,
  decideCardAuthGate,
  describeCheckoutFailure,
  parseCheckoutFailureBody,
} from "@/lib/checkout/messages";
import {
  PRICE_EUR,
  buildLemonCheckoutUrl,
  formatEuroAmount,
  isLemonCheckoutConfigured,
  newCheckoutRequestId,
  readLemonCheckoutConfig,
} from "@/content/international";
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

   Depuis ABO-11, l'ABONNEMENT TRIMESTRIEL est facturé par le MÊME tunnel que les
   offres à l'unité (`orderProduct()` émet `OPTIMUS_PRO`, `orderAmount()` lit
   `PRICES_MGA.subscriptionQuarter`, et la livraison crée une licence datée de
   `SUBSCRIPTION_MONTHS` mois). Il passe donc en PREMIER, avec le bouton de
   paiement Mobile Money.

   Les offres à l'unité restent vendables (module / spécialité) mais ne sont plus
   mises en avant : c'est une offre de secours, pas le produit principal.

   ⚠️ Aucun montant n'est écrit en dur ici : tout vient de `src/content/pricing.ts`
   (source unique, ABO-2). Le jour d'un changement tarifaire, un seul fichier
   change — et le prix affiché restera celui que le serveur facture.
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

/** Offres à l'unité — toujours facturables, désormais en second plan. */
const UNIT_OFFERS = [
  {
    id: "deck",
    title: "1 module",
    detail: "Une étape de parcours : questions, corrections et progression.",
    price: PRICES_MGA.deck,
  },
  {
    id: "specialty",
    title: "1 spécialité",
    detail: "Tout le contenu d'une spécialité, mis à jour pendant l'accès.",
    price: PRICES_MGA.specialty,
  },
] as const;

/** Ce que l'abonnement ouvre, en clair. */
const SUBSCRIPTION_FEATURES = [
  "Cours, cas cliniques et démarches : tout le catalogue Premium",
  "Toutes les spécialités, sans supplément",
  "Mises à jour de contenu incluses pendant l'abonnement",
  "Hors-ligne sur tous vos appareils connectés",
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

  /* ── Paiement international (Lemon Squeezy, merchant of record) ───────────
     Le bouton ne paie pas « dans le navigateur » : il demande d'abord au
     serveur de CRÉER la commande (référence CMD-…), puis part vers le checkout
     hébergé. C'est cette référence qui revient dans `meta.custom_data` et
     permet au webhook de retrouver l'acheteur — sans jamais faire confiance à
     un montant ou un identifiant venus du client. */
  const { session, status: authStatus } = useAuth();
  const navigate = useNavigate();
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  // Étiquette stable du dernier échec (QA + journaux) : « http-503-database ».
  const [payErrorCode, setPayErrorCode] = useState<string | null>(null);
  // Le serveur a REFUSÉ le jeton alors qu'une session existait : on propose une
  // reconnexion explicite au lieu de rediriger automatiquement.
  const [sessionRejected, setSessionRejected] = useState(false);

  // Un identifiant de demande stable : deux clics rapides produisent UNE
  // commande (UNIQUE(user_id, client_request_id)), pas deux checkouts.
  const requestIdRef = useRef<string | null>(null);

  const lemonConfig = useMemo(
    () => readLemonCheckoutConfig(import.meta.env as Record<string, string | undefined>),
    [],
  );
  const cardReady = isLemonCheckoutConfigured(lemonConfig);

  async function startCardPayment() {
    if (paying) return;
    setPayError(null);
    setPayErrorCode(null);
    setSessionRejected(false);

    /* 1. PEUT-ON seulement tenter ? On ne renvoie vers /login que si l'on SAIT
       qu'il n'y a pas de session. `loading`/`unavailable` ne sont PAS des
       déconnexions : y réagir par une redirection rejouerait exactement le
       symptôme de « double authentification » corrigé en AUTH-8. */
    const gate = decideCardAuthGate(authStatus, Boolean(session?.access_token));
    if (gate === "login") {
      void navigate({ to: "/login" });
      return;
    }
    if (gate !== "proceed") {
      setPayErrorCode(`auth-${gate}`);
      setPayError(CARD_AUTH_MESSAGES[gate]);
      return;
    }

    if (!cardReady) {
      setPayErrorCode("config-missing");
      setPayError(
        "Le paiement par carte n'est pas encore ouvert sur ce déploiement. Écrivez-nous : nous vous envoyons un lien de paiement sécurisé.",
      );
      return;
    }

    setPaying(true);

    // `requestIdRef` rend le clic idempotent : deux clics rapides produisent UNE
    // commande (UNIQUE(user_id, client_request_id)), pas deux checkouts.
    requestIdRef.current ??= newCheckoutRequestId();

    let response: Response | null = null;
    try {
      response = await fetch("/api/checkout/lemonsqueezy", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ clientRequestId: requestIdRef.current }),
      });
    } catch {
      response = null;
    }

    if (!response) {
      const failure = describeCheckoutFailure({ status: null });
      setPayErrorCode(failure.code);
      setPayError(failure.message);
      setPaying(false);
      return;
    }

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      const failure = describeCheckoutFailure({
        status: response.status,
        ...parseCheckoutFailureBody(body),
      });
      setPaying(false);
      setPayErrorCode(failure.code);
      setPayError(failure.message);
      // ⚠️ NE PAS rediriger ici. `/login` renvoie un utilisateur SESSIONNÉ vers
      // `/pro` (login.tsx) : sur un jeton refusé, l'acheteur rebondissait vers la
      // page d'achat sans jamais apprendre pourquoi — mesuré en QA, et c'est
      // exactement ce qui fait dire « le bouton ne marche pas ».
      if (failure.kind === "login") setSessionRejected(true);
      return;
    }

    const data = (await response.json().catch(() => null)) as { reference?: unknown } | null;
    if (!data || typeof data.reference !== "string") {
      // Réponse 200 sans référence : on n'envoie JAMAIS l'acheteur vers un
      // checkout sans commande en face (le webhook n'aurait rien à livrer).
      const failure = describeCheckoutFailure({ status: 503 });
      setPayErrorCode("reference-missing");
      setPayError(failure.message);
      setPaying(false);
      return;
    }

    // `window.location.assign` plutôt que le routeur : on quitte l'application
    // pour le checkout hébergé (aucun état de route à conserver).
    window.location.assign(
      buildLemonCheckoutUrl({
        config: lemonConfig,
        userId: session?.user?.id ?? "",
        email: session?.user?.email ?? null,
        orderReference: data.reference,
      }),
    );
  }

  /**
   * Reconnexion volontaire : on DÉCONNECTE d'abord, sinon `/login` renvoie
   * aussitôt vers `/pro` (session encore présente) et l'utilisateur ne voit
   * jamais le formulaire.
   */
  async function restartSession() {
    try {
      await signOutCloud();
    } catch {
      /* la déconnexion est un confort : on continue vers /login */
    }
    void navigate({ to: "/login" });
  }

  return (
    <Shell title="Tarifs">
      <Page
        className="mx-auto max-w-5xl"
        header={
          <PageHeader
            kicker="Tarifs"
            title="Le contenu complet, au plus juste"
            description={`L'abonnement trimestriel (${SUBSCRIPTION_MONTHS} mois, tout le contenu Premium) se règle par Mobile Money, ou par carte bancaire en euros depuis l'étranger. Les modules et les spécialités restent disponibles à l'unité, sans engagement.`}
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
            Conversion indicative. Le Mobile Money est facturé en Ariary ; le paiement
            par carte (onglet International) est facturé {formatEuroAmount(PRICE_EUR.subscriptionQuarter)}.
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

        {/* 1 — L'OFFRE PRINCIPALE : l'abonnement trimestriel, payable */}
        <section
          className="mt-12"
          aria-labelledby="abonnement-titre"
          data-tarifs-offers="subscription"
          data-tarifs-offer="subscription"
          data-tarifs-subscription-state="available"
        >
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <h2 id="abonnement-titre" className="font-display text-2xl font-medium tracking-tight">
                Abonnement Trimestriel — Accès Illimité {SUBSCRIPTION_MONTHS} mois
              </h2>
              <p className="mt-1 text-sm text-muted">
                Tout le contenu Premium, sur votre compte, payable par Mobile Money.
              </p>
            </div>
            <Badge tone="success">Paiement ouvert</Badge>
          </div>

          <Card className="mt-4 relative border-[var(--tone-accent-border)]" padding="lg">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <Badge tone="accent">Recommandé</Badge>
                <p className="mt-3 font-display text-xl font-medium text-fg">
                  Accès Illimité {SUBSCRIPTION_MONTHS} mois
                </p>
                <p className="mt-1 text-sm text-muted">
                  Un seul abonnement, valable quelle que soit la spécialité.
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
              {SUBSCRIPTION_FEATURES.map((line) => (
                <li key={line} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-[var(--tone-accent)]" aria-hidden="true" />
                  {line}
                </li>
              ))}
            </ul>

            <div className="mt-6" data-tarifs-channels>
              <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Moyen de paiement">
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
                    Vous lancez la commande, vous recevez les coordonnées officielles et le montant
                    exact, puis la validation de la transaction active votre accès.
                  </p>
                  <ButtonLink
                    to="/pro"
                    fullWidth
                    className="mt-4"
                    data-tarifs-pay="mobile-money"
                  >
                    Payer via Mobile Money
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </ButtonLink>
                </div>
              ) : (
                <div
                  id="canal-international"
                  role="tabpanel"
                  aria-labelledby="canal-international-tab"
                  className="mt-4 rounded-[var(--r-lg)] bg-secondary p-[var(--sp-4)]"
                  data-tarifs-channel="international"
                  data-tarifs-card-state={cardReady ? "ready" : "unconfigured"}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-fg">Paiement par carte bancaire</p>
                    <p className="text-sm font-medium text-fg" data-tarifs-card-price>
                      {formatEuroAmount(PRICE_EUR.subscriptionQuarter)}
                      <span className="ml-1 font-normal text-muted">/ {SUBSCRIPTION_MONTHS} mois</span>
                    </p>
                  </div>
                  <p className="mt-3 text-sm text-muted">
                    Carte bancaire, Apple&nbsp;Pay et Google&nbsp;Pay. Le paiement est encaissé en
                    euros par Lemon&nbsp;Squeezy, notre intermédiaire de paiement : la TVA
                    applicable est calculée automatiquement selon votre pays.
                  </p>
                  <Button
                    fullWidth
                    className="mt-4"
                    onClick={startCardPayment}
                    loading={paying}
                    loadingLabel="Ouverture du paiement sécurisé"
                    data-tarifs-pay="lemon-squeezy"
                    data-lemon-state={paying ? "paying" : payError ? "error" : "idle"}
                  >
                    <CreditCard className="size-4" aria-hidden="true" />
                    Payer par Carte ({formatEuroAmount(PRICE_EUR.subscriptionQuarter)})
                  </Button>
                  {payError ? (
                    <p
                      role="alert"
                      className="mt-2 text-xs leading-relaxed text-[var(--tone-danger-fg)]"
                      data-lemon-error
                      data-lemon-error-code={payErrorCode ?? undefined}
                    >
                      {payError}
                    </p>
                  ) : null}
                  {/* Le serveur a refusé le jeton : reconnexion EXPLICITE.
                      Un `<Button>` du Design System, comme le reste de la page
                      (`scripts/product-copy.test.mjs` interdit un `<button>`
                      natif ici — et cette règle a du sens : un bouton doit
                      suivre les tokens, pas un style local). */}
                  {sessionRejected ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="mt-2"
                      onClick={() => void restartSession()}
                      data-lemon-reauth
                    >
                      Se reconnecter
                    </Button>
                  ) : null}
                  {(authStatus === "anonymous" || authStatus === "unconfigured") && !payError ? (
                    <p className="mt-2 text-xs leading-relaxed text-muted" data-lemon-auth-note>
                      Un compte Optimus est nécessaire : le paiement ouvre votre accès sur ce
                      compte.
                    </p>
                  ) : null}
                  {!cardReady ? (
                    <p className="mt-2 text-xs leading-relaxed text-muted" data-lemon-config-note>
                      Le paiement par carte s&apos;ouvrira dès la validation de la boutique. En
                      attendant, le Mobile Money fonctionne immédiatement.
                    </p>
                  ) : null}
                  <p className="mt-2 text-xs leading-relaxed text-muted">
                    Aucun prélèvement automatique : l&apos;accès s&apos;arrête à la fin des{" "}
                    {SUBSCRIPTION_MONTHS} mois si vous ne renouvelez pas.
                  </p>
                </div>
              )}
            </div>

            <p className="mt-3 text-xs leading-relaxed text-muted">
              Aucun prélèvement automatique et aucune reconduction : l&apos;accès s&apos;arrête à la
              fin des {SUBSCRIPTION_MONTHS} mois si vous ne renouvelez pas.
            </p>
          </Card>
        </section>

        {/* 2 — Les offres à l'unité : toujours vendables, en second plan */}
        <section className="mt-12" aria-labelledby="offres-titre" data-tarifs-offers="unit">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <h2 id="offres-titre" className="font-display text-2xl font-medium tracking-tight">
                Aussi disponible à l&apos;unité
              </h2>
              <p className="mt-1 text-sm text-muted">
                Sans engagement : un module ou une spécialité, payé une fois.
              </p>
            </div>
            <Badge tone="neutral">Sans abonnement</Badge>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {UNIT_OFFERS.map((offer) => (
              <Card key={offer.id} data-tarifs-unit={offer.id}>
                <div className="min-w-0">
                  <p className="font-medium text-fg">{offer.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{offer.detail}</p>
                </div>
                <p className="mt-3 font-display text-2xl font-medium text-fg" data-tarifs-unit-price>
                  {formatPrice(offer.price, currency)}
                </p>
              </Card>
            ))}
          </div>

          <ButtonLink to="/pro" variant="secondary" fullWidth className="mt-3" data-tarifs-pay="unit">
            Commander à l&apos;unité
            <ArrowRight className="size-4" aria-hidden="true" />
          </ButtonLink>
        </section>

        {/* Comment payer — le même tunnel pour les deux familles d'offres */}
        <section className="mt-8">
          <Card>
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
            <p className="mt-3 text-xs leading-relaxed text-muted">
              Aucune carte bancaire n&apos;est demandée. La commande est enregistrée côté serveur,
              avec sa référence et son montant, puis validée après réception du paiement.
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
            Facturation en Ariary (MVola, Orange Money, Airtel Money). Les montants en dollars et en
            euros sont indicatifs, convertis au moment de l&apos;affichage. Un accès acheté est
            nominatif : il suit votre compte, pas un appareil.
          </span>
        </section>
      </Page>
    </Shell>
  );
}
