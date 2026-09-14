import type { ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Clock3, Copy, PackageCheck, ReceiptText } from "lucide-react";
import { Page, Shell } from "@/components/shell";
import {
  PURCHASE_STATUSES,
  purchaseStatusRank,
  type PremiumPurchase,
  type PurchaseStatus,
} from "@/content/purchase-order";
import { cn } from "@/lib/utils";
import { useOptimus } from "@/state/store";
import { toast } from "sonner";

export const Route = createFileRoute("/achats")({ component: PurchasesPage });

const STATUS_COPY: Record<PurchaseStatus, { label: string; detail: string }> = {
  created: {
    label: "Commande créée",
    detail: "Vérifiez l’offre avant de demander les coordonnées de paiement.",
  },
  instructions_requested: {
    label: "Instructions demandées",
    detail: "Attendez le numéro Mobile Money officiel avant de payer.",
  },
  proof_ready: {
    label: "Preuve prête à envoyer",
    detail: "Partagez la preuve avec la demande sécurisée de cet appareil.",
  },
  verification_pending: {
    label: "Vérification demandée",
    detail: "La preuve a été partagée, mais le paiement n’est pas encore confirmé ici.",
  },
  delivered: {
    label: "Contenu livré",
    detail: "Une clé signée ou un Deck protégé valide a été reçu sur cet appareil.",
  },
};

const PURCHASE_DATE = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });

function PurchasesPage() {
  const purchases = useOptimus((state) => state.purchases);
  const orderedPurchases = [...purchases].sort((a, b) => b.updatedAt - a.updatedAt);
  const delivered = purchases.filter((purchase) => purchase.status === "delivered").length;
  const pending = purchases.length - delivered;

  return (
    <Shell title="Mes achats">
      <Page className="mx-auto max-w-2xl">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
          Commandes Premium
        </p>
        <h1 className="mt-1 font-display text-3xl font-medium tracking-tight">Mes achats</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
          Suivez chaque demande sans ambiguïté, depuis le choix du Deck jusqu’à sa réception
          sécurisée.
        </p>

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
              🔐 Le suivi est conservé sur cet appareil. « Livré » apparaît uniquement après la
              validation cryptographique d’une clé ou d’un Deck correspondant.
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
  const rank = purchaseStatusRank(purchase.status);

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

      <div className="mt-4 grid grid-cols-5 gap-1" aria-label={`Progression : ${status.label}`}>
        {PURCHASE_STATUSES.map((step, index) => (
          <span
            key={step}
            className={cn("h-1.5 rounded-full", index <= rank ? "bg-primary" : "bg-secondary")}
          />
        ))}
      </div>

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
        ) : (
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
