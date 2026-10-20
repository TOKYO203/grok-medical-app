import { authEnabled } from "@/lib/auth/client";
import { useEffect, useSyncExternalStore } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell, CalendarClock, CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";
import { PremiumPurchaseFlow } from "@/components/premium-purchase-flow";
import { PremiumTeaser } from "@/components/premium-teaser";
import { Page, PageHeader, Shell } from "@/components/shell";
import { Badge } from "@/components/ui/ds/Badge";
import { Button } from "@/components/ui/ds/Button";
import { ButtonLink } from "@/components/ui/ds/ButtonLink";
import { Card } from "@/components/ui/ds/Card";
import { PREMIUM_SPECIALTIES, type PremiumSpecialtyId } from "@/content/purchase-order";
import { PRICES_MGA, SUBSCRIPTION_MONTHS, formatPrice } from "@/content/pricing";
import {
  getContentServerSnapshot,
  getContentSessionSnapshot,
  subscribeContentSession,
} from "@/lib/cloud/content-session";
import {
  formatSubscriptionEnd,
  resolveSubscription,
} from "@/lib/cloud/subscription";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { cacheServerPurchase, replacePurchaseCache } from "@/lib/purchase-cache";
import { listPremiumPurchaseOrders } from "@/lib/purchase-orders";
import { isTrialActive, trialRemainingDays } from "@/lib/premium-trial";
import { useOptimus } from "@/state/store";
import { toast } from "sonner";

export const Route = createFileRoute("/pro")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { order?: string; specialty?: PremiumSpecialtyId } => {
    const specialty = PREMIUM_SPECIALTIES.some((item) => item.id === search.specialty)
      ? (search.specialty as PremiumSpecialtyId)
      : undefined;
    return {
      ...(typeof search.order === "string" ? { order: search.order } : {}),
      ...(specialty ? { specialty } : {}),
    };
  },
  component: ProPage,
});

/**
 * /pro — l'ESPACE ABONNEMENT, pas la boutique.
 *
 * Ce que cette page ne fait plus (ancien modèle commercial) :
 *   · saisir une « clé d'activation » OPT-XXXX… ;
 *   · importer un « Deck protégé » reçu par fichier ;
 *   · annoncer « Accès Premium confirmé » sans jamais dire jusqu'à quand.
 *
 * Ce qu'elle fait :
 *   · un BANDEAU D'ABONNEMENT daté quand le compte est actif, avec l'action
 *     « Gérer mon abonnement » ;
 *   · pour les autres : l'aperçu, l'essai de 7 jours, le tunnel de commande
 *     réel (Mobile Money, offres à l'unité) — seule voie d'encaissement
 *     branchée — puis l'abonnement trimestriel ANNONCÉ, sans bouton de
 *     paiement tant qu'il n'est pas facturable côté serveur (ABO-1).
 *
 * ⚠️ L'état « actif » ne vient pas seulement de `profile.tier` : il vient aussi
 * de la LICENCE Supabase (session de contenu). Sans ça, un abonné dont la
 * licence vit en base n'aurait jamais de bandeau.
 */
function ProPage() {
  const profile = useOptimus((s) => s.profile);
  const entitlements = useOptimus((s) => s.entitlements);
  const addContact = useOptimus((s) => s.addContact);
  const purchases = useOptimus((s) => s.purchases);
  const premiumTrial = useOptimus((s) => s.premiumTrial);
  const startPremiumTrial = useOptimus((s) => s.startPremiumTrial);
  const { user, isPending } = useCurrentUserState();
  const userId = user?.id ?? null;
  const userIsDevFallback = user?.isDevFallback ?? false;
  const { order: orderReference, specialty } = Route.useSearch();
  const initialPurchase = purchases.find((purchase) => purchase.reference === orderReference);
  const purchaseFlowKey = `${initialPurchase?.reference ?? orderReference ?? "new"}:${initialPurchase?.updatedAt ?? 0}`;

  /**
   * La session de CONTENU : elle porte le jeton de 24 h ET l'échéance de la
   * licence. On s'y abonne au lieu de lire localStorage au montage — d'abord
   * parce qu'une lecture pendant le rendu ferait diverger le HTML serveur de
   * l'hydratation, ensuite parce qu'un jeton obtenu en arrière-plan (pont
   * licence) doit s'afficher ici sans que l'utilisateur ait à agir.
   */
  const contentSession = useSyncExternalStore(
    subscribeContentSession,
    getContentSessionSnapshot,
    getContentServerSnapshot,
  );

  const subscription = resolveSubscription({
    tier: profile.tier,
    entitlements,
    licenceExpiresAt: contentSession.licenceExpiresAt,
    contentUnlocked: contentSession.status === "ready",
  });
  const subscriptionEnd = formatSubscriptionEnd(subscription.expiresAt);

  useEffect(() => {
    if (isPending || !userId || userIsDevFallback) return;
    let disposed = false;
    const refresh = async () => {
      try {
        const serverPurchases = await listPremiumPurchaseOrders();
        if (!disposed) replacePurchaseCache(serverPurchases);
      } catch (error) {
        console.warn("[purchases] server refresh deferred; keeping offline cache", error);
      }
    };
    void refresh();
    window.addEventListener("online", refresh);
    return () => {
      disposed = true;
      window.removeEventListener("online", refresh);
    };
  }, [isPending, userId, userIsDevFallback]);

  return (
    <Shell title="Pro">
      <Page
        className="mx-auto max-w-2xl"
        header={
          <PageHeader
            kicker="Abonnement"
            title="Optimus Pro"
            description={`Tout le contenu Premium pendant ${SUBSCRIPTION_MONTHS} mois, lié à votre compte Optimus. Le contenu reste consultable hors ligne.`}
            action={
              <Link to="/achats" className="shrink-0 text-sm font-medium text-primary">
                Mes achats →
              </Link>
            }
          />
        }
      >
        {subscription.active ? (
          <section
            className="premium-hero mt-6 overflow-hidden rounded-[var(--radius-xl)] p-5 text-primary-fg shadow-[var(--shadow-md)]"
            data-subscription-hero
            data-subscription-source={subscription.source ?? "none"}
          >
            <div className="flex items-start gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/18 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.2)]">
                <CheckCircle2 className="size-6" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <span className="inline-flex items-center rounded-[var(--r-pill)] bg-white/18 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] shadow-[inset_0_0_0_1px_rgb(255_255_255/0.18)]">
                  Actif
                </span>
                <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight">
                  Abonnement actif
                </h2>
                <p className="mt-2 text-sm leading-relaxed opacity-85" data-subscription-detail>
                  {subscriptionEnd
                    ? `Accès illimité au contenu Premium jusqu'au ${subscriptionEnd}.`
                    : "Accès illimité au contenu Premium, sur votre compte."}
                </p>
              </div>
              <Sparkles className="size-5 shrink-0 opacity-70" aria-hidden="true" />
            </div>

            {subscription.source === "licence" ? (
              <p className="mt-3 flex items-center gap-2 text-xs opacity-80">
                <CalendarClock className="size-3.5 shrink-0" aria-hidden="true" />
                Abonnement rattaché à votre compte : il suit vos appareils connectés.
              </p>
            ) : null}

            <ButtonLink
              to="/tarifs"
              variant="secondary"
              fullWidth
              className="mt-4"
              data-pro-pricing-link
              data-subscription-manage
            >
              Gérer mon abonnement
            </ButtonLink>
          </section>
        ) : (
          <div className="mt-6 space-y-3">
            <PremiumTeaser />

            {isTrialActive(premiumTrial) ? (
              <p className="flex items-center gap-2 rounded-[var(--radius-lg)] bg-primary-soft px-4 py-3 text-sm">
                <Sparkles className="size-4 shrink-0 text-primary" aria-hidden="true" />
                Essai Premium actif · {trialRemainingDays(premiumTrial)} jour
                {trialRemainingDays(premiumTrial) > 1 ? "s" : ""} restants — cas et démarches Premium ouverts
              </p>
            ) : !premiumTrial ? (
              <Card>
                <h2 className="font-medium">Essai Premium · 7 jours offerts</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted">
                  Ouvrez tous les cas cliniques et démarches Premium pendant 7 jours, sans carte
                  bancaire. Un seul essai par compte.
                </p>
                <Button
                  className="mt-3"
                  fullWidth
                  onClick={() => {
                    startPremiumTrial();
                    toast.success("Essai de 7 jours démarré — cas et démarches Premium ouverts");
                  }}
                >
                  Démarrer mon essai gratuit
                </Button>
              </Card>
            ) : null}

            {/* 1 — Ce qui est payable AUJOURD'HUI : les offres à l'unité.
                Le tunnel de commande ne sait facturer que celles-là (voir
                src/content/purchase-order.ts) : elles passent donc en premier,
                avec leur prix réel lu dans pricing.ts. */}
            <Card data-pro-unit-offers>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">Contenu à l&apos;unité</p>
                  <p className="mt-1 text-sm text-muted">
                    {formatPrice(PRICES_MGA.deck, "MGA")} le module ·{" "}
                    {formatPrice(PRICES_MGA.specialty, "MGA")} la spécialité — payable maintenant.
                  </p>
                </div>
                <Badge tone="success">Disponible</Badge>
              </div>

              {authEnabled ? (
                <details className="mt-4" data-pro-order-disclosure>
                  <summary className="cursor-pointer list-none text-sm font-medium text-primary">
                    Commander par Mobile Money
                  </summary>
                  <div className="mt-3">
                    <PremiumPurchaseFlow
                      key={purchaseFlowKey}
                      profile={profile}
                      initialPurchase={initialPurchase}
                      initialSpecialty={specialty}
                      onRemember={(message) => addContact("deck", message)}
                      onPurchaseUpdated={cacheServerPurchase}
                    />
                  </div>
                </details>
              ) : (
                // Paiement indisponible sur ce déploiement : un lien vers les
                // tarifs, rien de plus. Aucun texte commercial codé en dur ici —
                // il vieillirait à la première ouverture du paiement.
                <ButtonLink to="/tarifs" variant="secondary" fullWidth className="mt-3" data-pro-pricing-link>
                  Voir les offres et les tarifs
                </ButtonLink>
              )}
            </Card>

            {/* 2 — L'abonnement : annoncé avec son prix, pas encore vendable.
                Aucun bouton de paiement ici : on n'encaisse pas ce qu'on ne sait
                pas encore honorer côté serveur. */}
            <Card data-pro-subscription-offer data-subscription-state="soon">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">Abonnement Trimestriel</p>
                    <Badge tone="neutral">Prochainement</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {formatPrice(PRICES_MGA.subscriptionQuarter, "MGA")} / {SUBSCRIPTION_MONTHS} mois —
                    tout le contenu Premium, sur votre compte.
                  </p>
                </div>
                <ButtonLink to="/tarifs" variant="secondary" data-pro-pricing-link>
                  Voir les tarifs
                </ButtonLink>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                L&apos;abonnement n&apos;est pas encore commercialisé : aucun paiement ne peut être
                encaissé pour lui à ce jour. Les offres à l&apos;unité ci-dessus restent, elles,
                disponibles immédiatement.
              </p>
              <ButtonLink to="/contact" variant="secondary" fullWidth className="mt-3" data-pro-notify>
                <Bell className="size-4" aria-hidden="true" />
                Être averti de l&apos;ouverture
              </ButtonLink>
            </Card>

            <p className="flex items-start gap-2 text-xs leading-relaxed text-subtle">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              Un abonnement ne peut pas être créé par une simple modification locale de
              l'application : il est vérifié par le serveur et rattaché à votre compte.
            </p>
          </div>
        )}

        <Link to="/soutenir" className="mt-6 inline-block text-sm text-muted hover:text-fg">
          Ce n'est pas un don — pour soutenir Fetra, voir Soutenir le développeur →
        </Link>
      </Page>
    </Shell>
  );
}
