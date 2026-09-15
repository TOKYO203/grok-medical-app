import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { KeyRound, PackageCheck, ShieldCheck } from "lucide-react";
import { PremiumPurchaseFlow } from "@/components/premium-purchase-flow";
import { Page, Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PREMIUM_SPECIALTIES, type PremiumSpecialtyId } from "@/content/purchase-order";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { cacheServerPurchase, replacePurchaseCache } from "@/lib/purchase-cache";
import { listPremiumPurchaseOrders } from "@/lib/purchase-orders";
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

function ProPage() {
  const profile = useOptimus((s) => s.profile);
  const activateLicense = useOptimus((s) => s.activateLicense);
  const entitlements = useOptimus((s) => s.entitlements);
  const addContact = useOptimus((s) => s.addContact);
  const purchases = useOptimus((s) => s.purchases);
  const { user, isPending } = useCurrentUserState();
  const { order: orderReference, specialty } = Route.useSearch();
  const initialPurchase = purchases.find((purchase) => purchase.reference === orderReference);
  const [activationKey, setActivationKey] = useState("");
  const [activating, setActivating] = useState(false);

  useEffect(() => {
    if (isPending || !user || user.isDevFallback) return;
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
  }, [isPending, user?.id, user?.isDevFallback]);

  async function activate() {
    setActivating(true);
    try {
      const response = await fetch("/api/licenses/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: activationKey,
          optimusId: profile.optimusId,
          deviceId: profile.deviceId,
        }),
      });
      const result = (await response.json()) as { error?: string; receipt?: unknown };
      if (!response.ok || !result.receipt)
        throw new Error(result.error || "Activation impossible.");
      if (!(await activateLicense(result.receipt))) {
        throw new Error("La preuve d'activation reçue est invalide.");
      }
      setActivationKey("");
      toast.success("Accès Premium activé sur cet appareil");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Activation impossible.");
    } finally {
      setActivating(false);
    }
  }

  return (
    <Shell title="Pro">
      <Page className="mx-auto max-w-lg">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
          Accès Premium
        </p>
        <div className="mt-1 flex items-center justify-between gap-3">
          <h1 className="font-display text-3xl font-medium tracking-tight">Optimus Pro</h1>
          <Link to="/achats" className="shrink-0 text-sm font-medium text-primary">
            Mes achats →
          </Link>
        </div>
        <p className="mt-2 text-sm text-muted">
          Les cours restent utilisables hors ligne. Les commandes et leurs statuts sont validés par
          le serveur, tandis que vos clés privées restent uniquement sur cet appareil.
        </p>
        {profile.tier !== "pro" ? (
          <div className="mt-6 space-y-3">
            <PremiumPurchaseFlow
              profile={profile}
              initialPurchase={initialPurchase}
              initialSpecialty={specialty}
              onRemember={(message) => addContact("deck", message)}
              onPurchaseUpdated={cacheServerPurchase}
            />

            <details className="rounded-[var(--radius-xl)] bg-card p-4 shadow-[var(--shadow-border)]">
              <summary className="cursor-pointer text-sm font-medium">
                J’ai déjà reçu une clé ou un Deck
              </summary>
              <div className="mt-4 space-y-4 border-t border-border pt-4">
                <section>
                  <div className="flex items-start gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-primary-soft text-primary">
                      <KeyRound className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2 className="font-medium">Clé d’activation</h2>
                      <p className="mt-1 text-sm text-muted">
                        Accès Optimus Pro lié à cet appareil.
                      </p>
                      <p className="mt-3 font-mono text-xs text-subtle">
                        Votre ID : {profile.optimusId}
                      </p>
                      <label
                        className="mt-4 block text-xs font-medium text-muted"
                        htmlFor="activation-key"
                      >
                        Clé reçue après paiement
                      </label>
                      <Input
                        id="activation-key"
                        className="mt-2 font-mono uppercase"
                        autoComplete="off"
                        spellCheck={false}
                        placeholder="OPT-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
                        value={activationKey}
                        onChange={(event) => setActivationKey(event.target.value)}
                      />
                      <Button
                        className="mt-2 w-full"
                        disabled={activationKey.trim().length < 33 || activating}
                        onClick={() => void activate()}
                      >
                        {activating ? "Vérification…" : "Activer ma clé"}
                      </Button>
                    </div>
                  </div>
                </section>

                <section className="border-t border-border pt-4">
                  <div className="flex items-start gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-primary-soft text-primary">
                      <PackageCheck className="size-5" />
                    </span>
                    <div>
                      <h2 className="font-medium">Deck protégé</h2>
                      <p className="mt-1 text-sm text-muted">
                        Importez le fichier personnel reçu après validation du paiement.
                      </p>
                      <Link
                        to="/import"
                        className="mt-3 inline-block text-sm font-medium text-primary"
                      >
                        Importer mon Deck →
                      </Link>
                    </div>
                  </div>
                </section>
              </div>
            </details>

            <p className="flex items-start gap-2 text-xs leading-relaxed text-subtle">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" />
              Un statut commercial ou un droit Premium ne peut pas être créé par une simple
              modification locale de l’application.
            </p>
          </div>
        ) : (
          <p className="mt-6 text-sm">
            Pro est actif. Les Decks Premium déjà validés restent accessibles hors ligne sur cet
            appareil.
          </p>
        )}
        <p className="mt-6 text-xs text-subtle">
          Statut local vérifié : {profile.tier}. Droits actifs : {entitlements.map((e) => e.product).join(", ")}.
        </p>
        <Link to="/soutenir" className="mt-6 inline-block text-sm text-muted hover:text-fg">
          Ce n’est pas un don — pour soutenir Fetra, voir Soutenir le développeur →
        </Link>
      </Page>
    </Shell>
  );
}
