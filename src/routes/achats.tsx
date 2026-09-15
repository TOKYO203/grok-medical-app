import { useEffect, useState, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Clock3, Copy, PackageCheck, ReceiptText, ShieldAlert } from "lucide-react";
import { Page, Shell } from "@/components/shell";
import type { PremiumPurchase, PurchaseStatus } from "@/content/purchase-order";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { replacePurchaseCache } from "@/lib/purchase-cache";
import { listPremiumPurchaseOrders } from "@/lib/purchase-orders";
import { cn } from "@/lib/utils";
import { useOptimus } from "@/state/store";
import { toast } from "sonner";

export const Route = createFileRoute("/achats")({ component: PurchasesPage });

const STATUS_COPY: Record<PurchaseStatus, { label: string; detail: string }> = {
  created: {
    label: "Commande créée",
    detail: "La référence, le produit et le montant ont été enregistrés côté serveur.",
  },
  instructions_requested: {
    label: "Instructions reçues",
    detail: "Le canal Mobile Money officiel a été associé à cette commande.",
  },
  proof_ready: {
    label: "Preuve prête à envoyer",
    detail: "La commande attend l’envoi de la preuve avec la demande sécurisée de cet appareil.",
  },
  verification_pending: {
    label: "Paiement à vérifier",
    detail: "La référence de transaction et l’empreinte de la preuve ont été enregistrées côté serveur.",
  },
  payment_verified: {
    label: "Paiement vérifié",
    detail: "Le paiement a été validé côté serveur. La livraison du contenu Premium est en préparation.",
  },
  delivered: {
    label: "Contenu livré",
    detail: "La commande a été validée et marquée livrée par le registre serveur.",
  },
  rejected: {
    label: "Commande rejetée",
    detail: "La vérification serveur n’a pas permis de valider cette commande.",
  },
  refunded: {
    label: "Commande remboursée",
    detail: "Cette commande a été remboursée et les licences liées peuvent être révoquées côté serveur.",
  },
};

const FLOW: PurchaseStatus[] = [
  "created",
  "instructions_requested",
  "proof_ready",
  "verification_pending",
  "payment_verified",
  "delivered",
];
const PURCHASE_DATE = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });

function PurchasesPage() {
  const purchases = useOptimus((state) => state.purchases);
  const { user, isPending } = useCurrentUserState();
  const [refreshing, setRefreshing] = useState(false);
  const [serverReachable, setServerReachable] = useState<boolean | null>(null);

  useEffect(() => {
    if (isPending || !user || user.isDevFallback) return;
    let disposed = false;
    const refresh = async () => {
      if (!disposed) setRefreshing(true);
      try {
        const serverPurchases = await listPremiumPurchaseOrders();
        if (!disposed) {
          replacePurchaseCache(serverPurchases);
          setServerReachable(true);
        }
      } catch (error) {
        console.warn("[purchases] using offline cache", error);
        if (!disposed) setServerReachable(false);
      } finally {
        if (!disposed) setRefreshing(false);
      }
    };
    void refresh();
    window.addEventListener("online", refresh);
    return () => {
      disposed = true;
      window.removeEventListener("online", refresh);
    };
  }, [isPending, user?.id, user?.isDevFallback]);

  const orderedPurchases = [...purchases].sort((a, b) => b.updatedAt - a.updatedAt);
  const delivered = purchases.filter((purchase) => purchase.status === "delivered").length;
  const pending = purchases.filter((purchase) =>
    ["created", "instructions_requested", "proof_ready", "verification_pending", "payment_verified"].includes(
      purchase.status,
    ),
  ).length;

  return (
    <Shell title="Mes achats">
      <Page className="mx-auto max-w-2xl">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
          Commandes Premium
        </p>
        <h1 className="mt-1 font-display text-3xl font-medium tracking-tight">Mes achats</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
          Le serveur conserve la référence, le montant et le statut officiels. Cet appareil garde
          seulement une copie de lecture pour pouvoir afficher votre historique hors ligne.
        </p>

        {refreshing ? (
          <p className="mt-3 text-xs text-muted">Synchronisation des commandes…</p>
        ) : serverReachable === false ? (
          <p className="mt-3 rounded-[var(--radius-lg)] bg-secondary p-3 text-xs text-muted">
            Mode hors ligne : les informations affichées proviennent du dernier cache connu. Elles
            seront vérifiées auprès du serveur dès le retour de la connexion.
          </p>
        ) : serverReachable === true ? (
          <p className="mt-3 text-xs text-muted">✓ Statuts vérifiés auprès du serveur.</p>
        ) : null}

        {purchases.length === 0 ? (
          <section className="mt-6 rounded-[var(--radius-xl)] bg-card p-6 text-center shadow-[var(--shadow-border)]">
            <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary">
              <ReceiptText className="size-6" />
            </span>
            <h2 className="mt-4 font-display text-xl font-medium">Aucune commande</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
              Choisissez un Deck à 3 000 Ar ou une spécialité complète à 27 000 Ar.
            </p>
            <Link
              to="/pro"
              className="mt-5 inline-flex h-11 items-center justify-center rounded-[var(--radius-md)] bg-primary px-5 text-sm font-medium text-primary-fg"
            >
              Découvrir Optimus Pro
            </Link>
          </section>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <SummaryCard icon={<Clock3 className="size-5" />} label="En cours" value={pending} />
              <SummaryCard
                icon={<CheckCircle2 className="size-5" />}
                label="Livrés"
                value={delivered}
              />
            </div>

            <div className="mt-5 space-y-3">
              {orderedPurchases.map((purchase) => (
                <PurchaseCard key={purchase.reference} purchase={purchase} />
              ))}
            </div>

            <p className="mt-5 rounded-[var(--radius-lg)] bg-secondary p-3 text-xs leading-relaxed text-muted">
              🔐 La preuve complète, la clé privée de votre appareil et les Decks déchiffrés ne sont
              pas enregistrés dans le registre commercial. Le serveur conserve uniquement les
              éléments nécessaires à la validation et à l’audit de la transaction.
            </p>
          </>
        )}
      </Page>
    </Shell>
  );
}

function SummaryCard({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-[var(--radius-lg)] bg-card p-4 shadow-[var(--shadow-border)]">
      <span className="text-primary">{icon}</span>
      <p className="mt-3 font-display text-2xl font-medium">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}

function PurchaseCard({ purchase }: { purchase: PremiumPurchase }) {
  const status = STATUS_COPY[purchase.status];
  const terminalNegative = purchase.status === "rejected" || purchase.status === "refunded";
  const rank = FLOW.indexOf(purchase.status);

  async function copyReference() {
    try {
      await navigator.clipboard.writeText(purchase.reference);
      toast.success("Référence copiée");
    } catch {
      toast.error("Copie impossible");
    }
  }

  return (
    <article className="rounded-[var(--radius-xl)] bg-card p-4 shadow-[var(--shadow-border)]">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-full",
            purchase.status === "delivered"
              ? "bg-primary text-primary-fg"
              : "bg-primary-soft text-primary",
          )}
        >
          {purchase.status === "delivered" ? (
            <PackageCheck className="size-5" />
          ) : terminalNegative ? (
            <ShieldAlert className="size-5" />
          ) : (
            <ReceiptText className="size-5" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-medium leading-snug">{purchase.label}</h2>
          <p className="mt-1 font-mono text-[11px] text-subtle">{purchase.product}</p>
        </div>
        <p className="shrink-0 text-sm font-medium">{purchase.amount.toLocaleString("fr-FR")} Ar</p>
      </div>

      {!terminalNegative ? (
        <div
          className="mt-4 grid gap-1"
          style={{ gridTemplateColumns: `repeat(${FLOW.length}, minmax(0, 1fr))` }}
          aria-label={`Progression : ${status.label}`}
        >
          {FLOW.map((step, index) => (
            <span
              key={step}
              className={cn("h-1.5 rounded-full", index <= rank ? "bg-primary" : "bg-secondary")}
            />
          ))}
        </div>
      ) : null}

      <p className="mt-3 text-sm font-medium">{status.label}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted">{status.detail}</p>
      <p className="mt-2 text-[11px] text-subtle">
        Mis à jour {PURCHASE_DATE.format(purchase.updatedAt)}
      </p>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3">
        <button
          type="button"
          onClick={() => void copyReference()}
          className="inline-flex min-w-0 items-center gap-1.5 text-xs text-muted"
        >
          <Copy className="size-3.5 shrink-0" />
          <span className="truncate">{purchase.reference}</span>
        </button>
        {purchase.status === "delivered" ? (
          <Link to="/parcours" className="shrink-0 text-sm font-medium text-primary">
            Ouvrir →
          </Link>
        ) : terminalNegative ? null : (
          <Link
            to="/pro"
            search={{ order: purchase.reference }}
            className="shrink-0 text-sm font-medium text-primary"
          >
            Continuer →
          </Link>
        )}
      </div>
    </article>
  );
}
