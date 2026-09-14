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
  type PurchaseStatus,
} from "@/content/purchase-order";
import type { Profile } from "@/core/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type ShareOutcome = "shared" | "copied" | "cancelled";

function makeReference(): string {
  const bytes = new Uint8Array(3);
  crypto.getRandomValues(bytes);
  const suffix = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `CMD-${Date.now().toString(36)}-${suffix}`.toUpperCase();
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
  onPurchaseStatus,
}: {
  profile: Profile;
  initialPurchase?: PremiumPurchase;
  initialSpecialty?: PremiumSpecialtyId;
  onRemember: (message: string) => void;
  onPurchaseStatus: (order: PremiumOrder, status: PurchaseStatus, proofAttached?: boolean) => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(() =>
    initialPurchase?.status === "created" ? 2 : initialPurchase ? 3 : 1,
  );
  const [offer, setOffer] = useState<PremiumOffer>(initialPurchase?.offer ?? "specialty");
  const [specialty, setSpecialty] = useState<PremiumSpecialtyId>(
    initialPurchase?.specialty ?? initialSpecialty ?? "neurologie",
  );
  const [deckNumber, setDeckNumber] = useState(initialPurchase?.deckNumber ?? 1);
  const [reference, setReference] = useState(initialPurchase?.reference ?? "");
  const [proof, setProof] = useState<File | null>(null);
  const [deviceIdentity, setDeviceIdentity] = useState<DeviceEncryptionIdentity | null>(null);
  const [sending, setSending] = useState(false);
  const [submitted, setSubmitted] = useState(initialPurchase?.status === "verification_pending");

  const order: PremiumOrder = { reference, offer, specialty, deckNumber };

  useEffect(() => {
    if (!initialPurchase) setReference(makeReference());
  }, [initialPurchase]);

  useEffect(() => {
    if (profile.optimusId === "OM-GUEST") return;
    void getDeviceEncryptionIdentity().then(setDeviceIdentity);
  }, [profile.optimusId]);

  async function requestPaymentInstructions() {
    try {
      const message = paymentRequestMessage(order, profile.optimusId);
      const outcome = await shareOrCopy("Demande de paiement Optimus", message);
      if (outcome === "cancelled") return;
      onRemember(message);
      onPurchaseStatus(order, "instructions_requested");
      toast.success(
        outcome === "shared"
          ? "Demande partagée"
          : "Demande copiée — envoyez-la par WhatsApp ou SMS",
      );
    } catch {
      toast.error("Impossible de préparer la demande");
    }
  }

  async function sendProof() {
    if (!proof || !deviceIdentity) return;
    setSending(true);
    try {
      const message = fulfillmentRequestMessage(order, {
        optimusId: profile.optimusId,
        deviceId: profile.deviceId,
        deviceKeyId: deviceIdentity.keyId,
        publicKey: deviceIdentity.publicKey,
      });
      const outcome = await shareOrCopy("Commande Optimus payée", message, [proof]);
      if (outcome === "cancelled") return;
      onRemember(message);
      if (outcome === "copied") {
        toast.success("Commande copiée — joignez manuellement votre preuve de paiement");
        return;
      }
      onPurchaseStatus(order, "verification_pending", true);
      setSubmitted(true);
      toast.success("Commande et preuve partagées");
    } catch {
      toast.error("Partage impossible — réessayez");
    } finally {
      setSending(false);
    }
  }

  if (profile.optimusId === "OM-GUEST") {
    return (
      <section className="rounded-[var(--radius-xl)] bg-card p-5 shadow-[var(--shadow-border)]">
        <h2 className="font-display text-xl font-medium">Créez d’abord votre Optimus ID</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Il protège votre achat et permet de préparer un Deck personnel pour votre appareil.
        </p>
        <Link
          to="/profil"
          className="mt-4 inline-flex h-11 items-center justify-center rounded-[var(--radius-md)] bg-primary px-4 text-sm font-medium text-primary-fg"
        >
          Créer mon compte Free
        </Link>
      </section>
    );
  }

  if (submitted) {
    return (
      <section className="rounded-[var(--radius-xl)] bg-primary-soft p-5 shadow-[var(--shadow-border)]">
        <CheckCircle2 className="size-8 text-primary" />
        <h2 className="mt-3 font-display text-2xl font-medium">Commande transmise</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Conservez la référence <strong className="text-fg">{reference}</strong>. Après validation,
          vous recevrez une clé d’activation ou un fichier Deck protégé.
        </p>
        <Link to="/import" className="mt-4 inline-block text-sm font-medium text-primary">
          J’ai reçu mon Deck →
        </Link>
        <Link to="/achats" className="ml-4 inline-block text-sm font-medium text-primary">
          Suivre la commande →
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
              className="mt-2 h-11 w-full rounded-[var(--radius-md)] bg-secondary px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
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
                  className="mt-2 h-11 w-full rounded-[var(--radius-md)] bg-secondary px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
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

            <OrderSummary order={order} />
            <p className="mt-3 text-xs leading-relaxed text-muted">
              Aucun paiement maintenant : la disponibilité du contenu contrôlé sera confirmée avant
              l’envoi des coordonnées Mobile Money.
            </p>
            <Button
              className="mt-4 w-full"
              disabled={!reference}
              onClick={() => {
                onPurchaseStatus(order, "created");
                setStep(2);
              }}
            >
              Continuer · {orderAmount(order).toLocaleString("fr-FR")} Ar
            </Button>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="mt-5 space-y-4">
          <OrderSummary order={order} standalone />
          <div className="rounded-[var(--radius-xl)] bg-card p-4 shadow-[var(--shadow-border)]">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
                <ShieldAlert className="size-5" />
              </span>
              <div>
                <h2 className="font-medium">Numéro Mobile Money à confirmer</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted">
                  Aucun opérateur ni numéro n’est encore affiché. N’envoyez aucun paiement avant de
                  recevoir les coordonnées officielles correspondant à cette commande.
                </p>
              </div>
            </div>
            <Button className="mt-4 w-full" onClick={() => void requestPaymentInstructions()}>
              <Send className="size-4" />
              Demander les instructions
            </Button>
          </div>
          <Button
            className="w-full"
            variant="secondary"
            onClick={() => {
              onPurchaseStatus(order, "instructions_requested");
              setStep(3);
            }}
          >
            J’ai reçu les instructions et payé
          </Button>
          <BackButton onClick={() => setStep(1)} />
        </div>
      ) : null}

      {step === 3 ? (
        <div className="mt-5 space-y-4">
          <OrderSummary order={order} standalone />
          <div className="rounded-[var(--radius-xl)] bg-card p-4 shadow-[var(--shadow-border)]">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                <ReceiptText className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="font-medium">Preuve de paiement</h2>
                <p className="mt-1 text-sm text-muted">
                  Ajoutez une capture ou un reçu PDF. Le fichier est partagé directement et n’est
                  pas conservé par l’application.
                </p>
              </div>
            </div>
            <label className="mt-4 flex min-h-20 cursor-pointer items-center gap-3 rounded-[var(--radius-lg)] border border-dashed border-border bg-secondary px-4 py-3">
              {proof ? (
                <FileCheck2 className="size-5 text-primary" />
              ) : (
                <Upload className="size-5 text-muted" />
              )}
              <span className="min-w-0 text-sm">
                {proof ? (
                  <span className="block truncate font-medium">{proof.name}</span>
                ) : (
                  <span className="font-medium">Choisir la preuve</span>
                )}
                <span className="mt-0.5 block text-xs text-muted">Image ou PDF</span>
              </span>
              <input
                className="sr-only"
                type="file"
                accept="image/*,application/pdf"
                onChange={(event) =>
                  loadProof(event, (file) => {
                    setProof(file);
                    if (file) onPurchaseStatus(order, "proof_ready", true);
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
              {sending ? "Préparation…" : "Partager ma commande sécurisée"}
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
    { id: 3, label: "Réception" },
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
          <span
            className={cn("mt-1 block text-[11px]", step.id === current ? "text-fg" : "text-muted")}
          >
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
}: {
  order: PremiumOrder;
  standalone?: boolean;
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
            {orderProduct(order)} · {order.reference}
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
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 text-sm text-muted"
    >
      <ArrowLeft className="size-4" /> Retour
    </button>
  );
}
