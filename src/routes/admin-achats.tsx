import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, RefreshCw, ShieldAlert, Undo2 } from "lucide-react";
import { Page, Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import type { PurchaseStatus } from "@/content/purchase-order";
import {
  listPremiumPurchaseOrdersForAdmin,
  reviewPremiumPurchaseOrder,
  type AdminPurchaseOrder,
} from "@/lib/purchase-orders";
import { toast } from "sonner";

export const Route = createFileRoute("/admin-achats")({ component: AdminPurchasesPage });

function AdminPurchasesPage() {
  const [orders, setOrders] = useState<AdminPurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [actingOn, setActingOn] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listPremiumPurchaseOrdersForAdmin();
      setOrders(result);
      setForbidden(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setForbidden(/forbidden/i.test(message));
      if (!/forbidden/i.test(message)) toast.error("Impossible de charger les commandes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function decide(reference: string, decision: "payment_verified" | "delivered" | "rejected" | "refunded") {
    setActingOn(reference);
    try {
      const result = await reviewPremiumPurchaseOrder({ data: { reference, decision } });
      toast.success(
        decision === "payment_verified"
          ? "Paiement validé"
          : decision === "delivered"
            ? "Commande marquée livrée"
            : decision === "refunded"
              ? `Commande remboursée · ${result.revokedLicenses} licence(s) révoquée(s)`
              : "Commande rejetée",
      );
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action impossible");
    } finally {
      setActingOn(null);
    }
  }

  if (forbidden) {
    return (
      <Shell title="Administration des achats">
        <Page className="mx-auto max-w-xl">
          <section className="rounded-[var(--radius-xl)] bg-card p-6 shadow-[var(--shadow-border)]">
            <ShieldAlert className="size-8 text-primary" />
            <h1 className="mt-3 font-display text-2xl font-medium">Accès opérateur requis</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Cette page est réservée aux comptes présents dans `PURCHASE_ADMIN_USER_IDS`. Aucun
              rôle administrateur n’est accordé côté client.
            </p>
            <Link to="/achats" className="mt-4 inline-block text-sm font-medium text-primary">
              Retour aux achats →
            </Link>
          </section>
        </Page>
      </Shell>
    );
  }

  return (
    <Shell title="Administration des achats">
      <Page className="mx-auto max-w-3xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Opérateur Premium</p>
            <h1 className="mt-1 font-display text-3xl font-medium tracking-tight">Validation des achats</h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
              Vérifiez la référence Mobile Money dans le canal opérateur avant de valider. La
              validation du paiement et la livraison sont deux étapes distinctes.
            </p>
          </div>
          <Button variant="secondary" disabled={loading} onClick={() => void refresh()}>
            <RefreshCw className="size-4" /> Actualiser
          </Button>
        </div>

        {loading ? <p className="mt-6 text-sm text-muted">Chargement…</p> : null}
        {!loading && orders.length === 0 ? <p className="mt-6 text-sm text-muted">Aucune commande.</p> : null}

        <div className="mt-6 space-y-4">
          {orders.map((entry) => (
            <AdminOrderCard
              key={entry.purchase.reference}
              entry={entry}
              busy={actingOn === entry.purchase.reference}
              onDecision={decide}
            />
          ))}
        </div>
      </Page>
    </Shell>
  );
}

function AdminOrderCard({
  entry,
  busy,
  onDecision,
}: {
  entry: AdminPurchaseOrder;
  busy: boolean;
  onDecision: (
    reference: string,
    decision: "payment_verified" | "delivered" | "rejected" | "refunded",
  ) => Promise<void>;
}) {
  const { purchase } = entry;
  return (
    <article className="rounded-[var(--radius-xl)] bg-card p-4 shadow-[var(--shadow-border)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium">{purchase.label}</p>
          <p className="mt-1 font-mono text-xs text-muted">{purchase.reference}</p>
          <p className="mt-1 text-xs text-muted">Optimus ID : {entry.optimusId}</p>
        </div>
        <div className="text-right">
          <p className="font-medium">{purchase.amount.toLocaleString("fr-FR")} Ar</p>
          <p className="mt-1 text-xs text-muted">{statusLabel(purchase.status)}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 rounded-[var(--radius-lg)] bg-secondary p-3 text-xs sm:grid-cols-2">
        <p><span className="text-muted">Opérateur :</span> {entry.paymentProvider ?? "—"}</p>
        <p><span className="text-muted">Transaction :</span> <span className="font-mono">{entry.paymentReference ?? "—"}</span></p>
        <p><span className="text-muted">Preuve SHA-256 :</span> <span className="font-mono">{entry.proofDigest ? `${entry.proofDigest.slice(0, 12)}…` : "—"}</span></p>
        <p><span className="text-muted">Appareil :</span> <span className="font-mono">{entry.deviceId ?? "—"}</span></p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {purchase.status === "verification_pending" ? (
          <>
            <Button disabled={busy} onClick={() => void onDecision(purchase.reference, "payment_verified")}>
              <CheckCircle2 className="size-4" /> Valider le paiement
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => void onDecision(purchase.reference, "rejected")}>Rejeter</Button>
          </>
        ) : null}
        {purchase.status === "payment_verified" ? (
          <>
            <Button disabled={busy} onClick={() => void onDecision(purchase.reference, "delivered")}>
              <CheckCircle2 className="size-4" /> Marquer livré
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => void onDecision(purchase.reference, "rejected")}>Rejeter</Button>
          </>
        ) : null}
        {purchase.status === "delivered" ? (
          <Button variant="secondary" disabled={busy} onClick={() => void onDecision(purchase.reference, "refunded")}>
            <Undo2 className="size-4" /> Rembourser et révoquer
          </Button>
        ) : null}
      </div>
    </article>
  );
}

function statusLabel(status: PurchaseStatus): string {
  const labels: Record<PurchaseStatus, string> = {
    created: "Commande créée",
    instructions_requested: "Instructions reçues",
    proof_ready: "Preuve prête",
    verification_pending: "Paiement à vérifier",
    payment_verified: "Paiement vérifié",
    delivered: "Livré",
    rejected: "Rejeté",
    refunded: "Remboursé",
  };
  return labels[status];
}
