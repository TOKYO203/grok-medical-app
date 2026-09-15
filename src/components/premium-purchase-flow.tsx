import { useEffect, useState, type ChangeEvent } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  FileCheck2,
  Layers3,
  ReceiptText,
  Send,
  ShieldAlert,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getDeviceEncryptionIdentity,
  type DeviceEncryptionIdentity,
} from "@/content/device-encryption";
import {
  fulfillmentRequestMessage,
  orderAmount,
  orderLabel,
  orderProduct,
  paymentRequestMessage,
  PREMIUM_SPECIALTIES,
  type PremiumOffer,
  type PremiumOrder,
  type PremiumPurchase,
  type PremiumSpecialtyId,
} from "@/content/purchase-order";
import type { Profile } from "@/core/types";
import { authEnabled } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  advancePremiumPurchaseOrder,
  createPremiumPurchaseOrder,
} from "@/lib/purchase-orders";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type ShareOutcome = "shared" | "copied" | "cancelled";

function newClientRequestId(): string {
  return globalThis.crypto.randomUUID();
}

async function shareOrCopy(title: string, text: string, files: File[] = []): Promise<ShareOutcome> {
  try {
    const canShareFiles =
      files.length > 0 && navigator.canShare?.({ files }) && typeof navigator.share === "function";
    if (typeof navigator.share === "function" && (files.length === 0 || canShareFiles)) {
      await navigator.share({ title, text, files: canShareFiles ? files : undefined });
      return "shared";
    }
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
    throw error;
  }
}

export function PremiumPurchaseFlow({
  profile,
  initialPurchase,
  initialSpecialty,
  onRemember,
  onPurchaseUpdated,
}: {
  profile: Profile;
  initialPurchase?: PremiumPurchase;
  initialSpecialty?: PremiumSpecialtyId;
  onRemember: (message: string) => void;
  onPurchaseUpdated: (purchase: PremiumPurchase) => void;
}) {
  const { user, isPending: authPending } = useCurrentUserState();
  const [purchase, setPurchase] = useState<PremiumPurchase | undefined>(initialPurchase);
  const [step, setStep] = useState<1 | 2 | 3>(() =>
    initialPurchase?.status === "created" ? 2 : initialPurchase ? 3 : 1,
  );
  const [offer, setOffer] = useState<PremiumOffer>(initialPurchase?.offer ?? "specialty");
  const [specialty, setSpecialty] = useState<PremiumSpecialtyId>(
    initialPurchase?.specialty ?? initialSpecialty ?? "neurologie",
  );
  const [deckNumber, setDeckNumber] = useState(initialPurchase?.deckNumber ?? 1);
  const [clientRequestId] = useState(newClientRequestId);
  const [proof, setProof] = useState<File | null>(null);
  const [deviceIdentity, setDeviceIdentity] = useState<DeviceEncryptionIdentity | null>(null);
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState(false);

  const reference = purchase?.reference ?? "";
  const order: PremiumOrder = { reference, offer, specialty, deckNumber };

  useEffect(() => {
    if (profile.optimusId === "OM-GUEST") return;
    void getDeviceEncryptionIdentity().then(setDeviceIdentity);
  }, [profile.optimusId]);

  function rememberServerPurchase(next: PremiumPurchase) {
    setPurchase(next);
    setOffer(next.offer);
    setSpecialty(next.specialty);
    setDeckNumber(next.deckNumber);
    onPurchaseUpdated(next);
  }

  async function createOrder() {
    if (!user || user.isDevFallback || profile.optimusId === "OM-GUEST") return;
    setCreating(true);
    try {
      const created = await createPremiumPurchaseOrder({
        data: { clientRequestId, offer, specialty, deckNumber },
      });
      rememberServerPurchase(created);
      setStep(2);
      toast.success(`Commande ${created.reference} créée`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible de créer la commande");
    } finally {
      setCreating(false);
    }
  }

  async function requestPaymentInstructions() {
    if (!purchase) return;
    try {
      const message = paymentRequestMessage(purchase, profile.optimusId);
      const outcome = await shareOrCopy("Demande de paiement Optimus", message);
      if (outcome === "cancelled") return;
      onRemember(message);
      const updated = await advancePremiumPurchaseOrder({
        data: { reference: purchase.reference, status: "instructions_requested" },
      });
      rememberServerPurchase(updated);
      toast.success(
        outcome === "shared"
          ? "Demande partagée et commande mise à jour"
          : "Demande copiée — envoyez-la par votre canal officiel",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible de préparer la demande");
    }
  }

  async function continueAfterInstructions() {
    if (!purchase) return;
    try {
      if (purchase.status === "created") {
        const updated = await advancePremiumPurchaseOrder({
          data: { reference: purchase.reference, status: "instructions_requested" },
        });
        rememberServerPurchase(updated);
      }
      setStep(3);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Commande impossible à mettre à jour");
    }
  }

  async function markProofReady(file: File | null) {
    setProof(file);
    if (!file || !purchase) return;
    try {
      if (purchase.status === "created") {
        toast.error("Demandez d’abord les instructions de paiement");
        return;
      }
      if (purchase.status === "instructions_requested") {
        const updated = await advancePremiumPurchaseOrder({
          data: { reference: purchase.reference, status: "proof_ready" },
        });
        rememberServerPurchase(updated);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Preuve non enregistrée");
    }
  }

  async function sendProof() {
    if (!proof || !deviceIdentity || !purchase) return;
    setSending(true);
    try {
      let current = purchase;
      if (current.status === "instructions_requested") {
        current = await advancePremiumPurchaseOrder({
          data: { reference: current.reference, status: "proof_ready" },
        });
        rememberServerPurchase(current);
      }
      if (current.status !== "proof_ready") {
        throw new Error("Cette commande n’est pas prête pour la vérification.");
      }

      const message = fulfillmentRequestMessage(current, {
        optimusId: profile.optimusId,
        deviceId: profile.deviceId,
        deviceKeyId: deviceIdentity.keyId,
        publicKey: deviceIdentity.publicKey,
      });
      const outcome = await shareOrCopy("Commande Optimus payée", message, [proof]);
      if (outcome === "cancelled") return;
      onRemember(message);
      if (outcome === "copied") {
        toast.success("Commande copiée — joignez manuellement votre preuve avant validation");
        return;
      }

      const updated = await advancePremiumPurchaseOrder({
        data: {
          reference: current.reference,
          status: "verification_pending",
          proofAttached: true,
          device: {
            deviceId: profile.deviceId,
            deviceKeyId: deviceIdentity.keyId,
            publicKey: deviceIdentity.publicKey,
          },
        },
      });
      rememberServerPurchase(updated);
      toast.success("Commande transmise pour vérification");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Partage impossible — réessayez");
    } finally {
      setSending(false);
    }
  }

  if (authPending) {
    return (
      <section className="rounded-[var(--radius-xl)] bg-card p-5 text-sm text-muted shadow-[var(--shadow-border)]">
        Vérification du compte…
      </section>
    );
  }

  if (!authEnabled || !user || user.isDevFallback) {
    return (
      <section className="rounded-[var(--radius-xl)] bg-card p-5 shadow-[var(--shadow-border)]">
        <h2 className="font-display text-xl font-medium">Connexion requise pour un achat Premium</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Les cours gratuits restent disponibles hors ligne. Une commande payante, elle, doit être
          rattachée à un compte serveur afin que le montant, le statut et la livraison ne puissent
          pas être falsifiés depuis l’appareil.
        </p>
        <Link
          to="/login"
          className="mt-4 inline-flex h-11 items-center justify-center rounded-[var(--radius-md)] bg-primary px-4 text-sm font-medium text-primary-fg"
        >
          Se connecter
        </Link>
      </section>
    );
  }

  if (profile.optimusId === "OM-GUEST") {
    return (
      <section className="rounded-[var(--radius-xl)] bg-card p-5 shadow-[var(--shadow-border)]">
        <h2 className="font-display text-xl font-medium">Finalisation du compte Optimus</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Votre session est connectée. L’Optimus ID sécurisé doit encore être synchronisé avant de
          créer une commande.
        </p>
        <Link to="/profil" className="mt-4 inline-block text-sm font-medium text-primary">
          Ouvrir mon profil →
        </Link>
      </section>
    );
  }

  if (purchase?.status === "verification_pending") {
    return (
      <section className="rounded-[var(--radius-xl)] bg-primary-soft p-5 shadow-[var(--shadow-border)]">
        <CheckCircle2 className="size-8 text-primary" />
        <h2 className="mt-3 font-display text-2xl font-medium">Commande en vérification</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          La référence serveur est <strong className="text-fg">{purchase.reference}</strong>. Le
          statut « livré » ne peut être attribué que côté serveur après vérification.
        </p>
        <Link to="/achats" className="mt-4 inline-block text-sm font-medium text-primary">
          Suivre la commande →
        </Link>
      </section>
    );
  }

  if (purchase?.status === "delivered") {
    return (
      <section className="rounded-[var(--radius-xl)] bg-primary-soft p-5 shadow-[var(--shadow-border)]">
        <CheckCircle2 className="size-8 text-primary" />
        <h2 className="mt-3 font-display text-2xl font-medium">Commande livrée</h2>
        <p className="mt-2 text-sm text-muted">Référence : {purchase.reference}</p>
        <Link to="/import" className="mt-4 inline-block text-sm font-medium text-primary">
          Ouvrir ou importer mon contenu →
        </Link>
      </section>
    );
  }

  if (purchase?.status === "rejected" || purchase?.status === "refunded") {
    return (
      <section className="rounded-[var(--radius-xl)] bg-card p-5 shadow-[var(--shadow-border)]">
        <ShieldAlert className="size-8 text-primary" />
        <h2 className="mt-3 font-display text-2xl font-medium">
          {purchase.status === "refunded" ? "Commande remboursée" : "Commande rejetée"}
        </h2>
        <p className="mt-2 text-sm text-muted">
          Référence : {purchase.reference}. Ce statut provient du registre serveur et ne peut pas
          être modifié localement.
        </p>
        <Link to="/achats" className="mt-4 inline-block text-sm font-medium text-primary">
          Voir mes commandes →
        </Link>
      </section>
    );
  }

  return (
    <section>
      <PurchaseSteps current={step} />

      {step === 1 ? (
        <div className="mt-5 space-y-4">
          <div aria-label="Choisir une offre" className="grid grid-cols-2 gap-3" role="radiogroup">
            <OfferCard
              active={offer === "deck"}
              title="1 Deck"
              detail="Une étape"
              price="3 000 Ar"
              onClick={() => setOffer("deck")}
            />
            <OfferCard
              active={offer === "specialty"}
              title="Spécialité"
              detail="10 Decks · 1 offert"
              price="27 000 Ar"
              recommended
              onClick={() => setOffer("specialty")}
            />
          </div>

          <div className="rounded-[var(--radius-xl)] bg-card p-4 shadow-[var(--shadow-border)]">
            <label className="text-xs font-medium text-muted" htmlFor="premium-specialty">
              Spécialité souhaitée
            </label>
            <select
              id="premium-specialty"
              className="mt-2 h-11 w-full rounded-[var(--radius-md)] bg-secondary px-3 text-sm shadow-[var(--shadow-border)]"
              value={specialty}
              onChange={(event) => setSpecialty(event.target.value as PremiumSpecialtyId)}
            >
              {PREMIUM_SPECIALTIES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>

            {offer === "deck" ? (
              <>
                <label className="mt-4 block text-xs font-medium text-muted" htmlFor="deck-number">
                  Étape du parcours
                </label>
                <select
                  id="deck-number"
                  className="mt-2 h-11 w-full rounded-[var(--radius-md)] bg-secondary px-3 text-sm shadow-[var(--shadow-border)]"
                  value={deckNumber}
                  onChange={(event) => setDeckNumber(Number(event.target.value))}
                >
                  {Array.from({ length: 10 }, (_, index) => index + 1).map((number) => (
                    <option key={number} value={number}>
                      Deck {number}/10
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs leading-relaxed text-muted">
                  Les Decks sont progressifs : choisissez idéalement l’étape qui suit votre dernier
                  Deck terminé.
                </p>
              </>
            ) : null}

            <OrderSummary order={order} showReference={false} />
            <p className="mt-3 text-xs leading-relaxed text-muted">
              Le serveur générera la référence, le produit et le montant officiels. Aucun paiement
              n’est demandé avant réception des coordonnées Mobile Money officielles.
            </p>
            <Button className="mt-4 w-full" disabled={creating} onClick={() => void createOrder()}>
              {creating ? "Création sécurisée…" : `Continuer · ${orderAmount(order).toLocaleString("fr-FR")} Ar`}
            </Button>
          </div>
        </div>
      ) : null}

      {step === 2 && purchase ? (
        <div className="mt-5 space-y-4">
          <OrderSummary order={purchase} standalone />
          <div className="rounded-[var(--radius-xl)] bg-card p-4 shadow-[var(--shadow-border)]">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
                <ShieldAlert className="size-5" />
              </span>
              <div>
                <h2 className="font-medium">Coordonnées Mobile Money à confirmer</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted">
                  Aucun opérateur ni numéro n’est codé en dur dans l’application. N’envoyez rien
                  avant d’avoir reçu le canal officiel associé à cette référence serveur.
                </p>
              </div>
            </div>
            <Button className="mt-4 w-full" onClick={() => void requestPaymentInstructions()}>
              <Send className="size-4" />
              Demander les instructions
            </Button>
          </div>
          <Button className="w-full" variant="secondary" onClick={() => void continueAfterInstructions()}>
            J’ai reçu les instructions et payé
          </Button>
        </div>
      ) : null}

      {step === 3 && purchase ? (
        <div className="mt-5 space-y-4">
          <OrderSummary order={purchase} standalone />
          <div className="rounded-[var(--radius-xl)] bg-card p-4 shadow-[var(--shadow-border)]">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                <ReceiptText className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="font-medium">Preuve de paiement</h2>
                <p className="mt-1 text-sm text-muted">
                  La preuve reste sur votre appareil et est partagée par le canal choisi. Le serveur
                  ne conserve ici que son statut et la clé publique de votre appareil.
                </p>
              </div>
            </div>
            <label className="mt-4 flex min-h-20 cursor-pointer items-center gap-3 rounded-[var(--radius-lg)] border border-dashed border-border bg-secondary px-4 py-3">
              {proof ? <FileCheck2 className="size-5 text-primary" /> : <Upload className="size-5 text-muted" />}
              <span className="min-w-0 text-sm">
                {proof ? <span className="block truncate font-medium">{proof.name}</span> : <span className="font-medium">Choisir la preuve</span>}
                <span className="mt-0.5 block text-xs text-muted">Image ou PDF · 8 Mo maximum</span>
              </span>
              <input
                className="sr-only"
                type="file"
                accept="image/*,application/pdf"
                onChange={(event) =>
                  loadProof(event, (file) => {
                    void markProofReady(file);
                  })
                }
              />
            </label>
            <p className="mt-3 text-xs text-muted">
              🔐 Appareil : {deviceIdentity ? "clé sécurisée prête" : "préparation de la clé…"}
            </p>
            <Button
              className="mt-4 w-full"
              disabled={!proof || !deviceIdentity || sending}
              onClick={() => void sendProof()}
            >
              <Send className="size-4" />
              {sending ? "Préparation…" : "Partager et demander la vérification"}
            </Button>
          </div>
          <BackButton onClick={() => setStep(2)} />
        </div>
      ) : null}
    </section>
  );
}

function loadProof(event: ChangeEvent<HTMLInputElement>, setProof: (file: File | null) => void) {
  const file = event.target.files?.[0] ?? null;
  if (file && file.type !== "application/pdf" && !file.type.startsWith("image/")) {
    toast.error("Choisissez une image ou un PDF");
    event.target.value = "";
    return;
  }
  if (file && file.size === 0) {
    toast.error("Ce fichier est vide");
    event.target.value = "";
    return;
  }
  if (file && file.size > 8 * 1024 * 1024) {
    toast.error("La preuve doit peser moins de 8 Mo");
    event.target.value = "";
    return;
  }
  setProof(file);
}

function PurchaseSteps({ current }: { current: 1 | 2 | 3 }) {
  const steps = [
    { id: 1, label: "Offre" },
    { id: 2, label: "Paiement" },
    { id: 3, label: "Vérification" },
  ] as const;
  return (
    <ol className="grid grid-cols-3 gap-2" aria-label={`Étape ${current} sur 3`}>
      {steps.map((step) => (
        <li key={step.id} className="text-center">
          <span
            className={cn(
              "mx-auto flex size-8 items-center justify-center rounded-full text-xs font-medium",
              step.id <= current ? "bg-primary text-primary-fg" : "bg-secondary text-muted",
            )}
          >
            {step.id < current ? <Check className="size-4" /> : step.id}
          </span>
          <span className={cn("mt-1 block text-[11px]", step.id === current ? "text-fg" : "text-muted")}>
            {step.label}
          </span>
        </li>
      ))}
    </ol>
  );
}

function OfferCard({
  active,
  title,
  detail,
  price,
  recommended = false,
  onClick,
}: {
  active: boolean;
  title: string;
  detail: string;
  price: string;
  recommended?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "relative min-h-36 rounded-[var(--radius-xl)] p-4 text-left shadow-[var(--shadow-border)] transition-colors",
        active ? "bg-primary-soft ring-2 ring-primary" : "bg-card",
      )}
    >
      {recommended ? (
        <span className="absolute right-2 top-2 rounded-full bg-primary px-2 py-1 text-[9px] font-medium uppercase tracking-wide text-primary-fg">
          Économisez 3 000 Ar
        </span>
      ) : null}
      <span className="block pt-5 text-sm font-medium">{title}</span>
      <span className="mt-1 block text-xs text-muted">{detail}</span>
      <span className="mt-5 block font-display text-xl font-medium">{price}</span>
    </button>
  );
}

function OrderSummary({
  order,
  standalone = false,
  showReference = true,
}: {
  order: PremiumOrder;
  standalone?: boolean;
  showReference?: boolean;
}) {
  return (
    <div
      className={cn(
        "mt-4 rounded-[var(--radius-lg)] bg-secondary p-3",
        standalone && "mt-0 shadow-[var(--shadow-border)]",
      )}
    >
      <div className="flex items-start gap-3">
        <Layers3 className="mt-0.5 size-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{orderLabel(order)}</p>
          <p className="mt-1 text-xs text-muted">
            {orderProduct(order)}{showReference && order.reference ? ` · ${order.reference}` : ""}
          </p>
        </div>
        <p className="shrink-0 text-sm font-medium">
          {orderAmount(order).toLocaleString("fr-FR")} Ar
        </p>
      </div>
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1 text-sm text-muted">
      <ArrowLeft className="size-4" /> Retour
    </button>
  );
}
