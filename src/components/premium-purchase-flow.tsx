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
import { Input } from "@/components/ui/input";
import {
  getDeviceEncryptionIdentity,
  type DeviceEncryptionIdentity,
} from "@/content/device-encryption";
import {
  fulfillmentRequestMessage,
  orderAmount,
  orderLabel,
  orderProduct,
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
  getPremiumPaymentInstructions,
  type PremiumPaymentInstructions,
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

async function fileSha256(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function paymentInstructionsMessage(instructions: PremiumPaymentInstructions): string {
  return [
    "PAIEMENT OPTIMUS",
    `Commande : ${instructions.orderReference}`,
    `Produit : ${instructions.product}`,
    `Montant exact : ${instructions.amount.toLocaleString("fr-FR")} Ar`,
    `Opérateur : ${instructions.provider ?? "Non configuré"}`,
    `Numéro officiel : ${instructions.destination ?? "Non configuré"}`,
    ...(instructions.accountName ? [`Titulaire : ${instructions.accountName}`] : []),
    ...(instructions.note ? [`Instruction : ${instructions.note}`] : []),
    "Conservez la référence de transaction Mobile Money après paiement.",
  ].join("\n");
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
  const [step, setStep] = useState<1 | 2 | 3>(() => {
    if (!initialPurchase) return 1;
    return initialPurchase.status === "created" || initialPurchase.status === "instructions_requested"
      ? 2
      : 3;
  });
  const [offer, setOffer] = useState<PremiumOffer>(initialPurchase?.offer ?? "specialty");
  const [specialty, setSpecialty] = useState<PremiumSpecialtyId>(
    initialPurchase?.specialty ?? initialSpecialty ?? "neurologie",
  );
  const [deckNumber, setDeckNumber] = useState(initialPurchase?.deckNumber ?? 1);
  const [clientRequestId] = useState(newClientRequestId);
  const [proof, setProof] = useState<File | null>(null);
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentInstructions, setPaymentInstructions] = useState<PremiumPaymentInstructions | null>(null);
  const [manualShareReady, setManualShareReady] = useState(false);
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
      const result = await getPremiumPaymentInstructions({ data: { reference: purchase.reference } });
      rememberServerPurchase(result.purchase);
      setPaymentInstructions(result.instructions);
      if (!result.instructions.configured) {
        toast.error("Le canal Mobile Money officiel n’est pas encore configuré. Ne payez pas.");
        return;
      }
      toast.success("Coordonnées officielles chargées depuis le serveur");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible de charger les instructions");
    }
  }

  async function copyPaymentInstructions() {
    if (!paymentInstructions?.configured) return;
    const message = paymentInstructionsMessage(paymentInstructions);
    try {
      const outcome = await shareOrCopy("Paiement Optimus", message);
      if (outcome === "cancelled") return;
      onRemember(message);
      toast.success(outcome === "shared" ? "Instructions partagées" : "Instructions copiées");
    } catch {
      toast.error("Impossible de partager les instructions");
    }
  }

  function continueAfterInstructions() {
    if (!paymentInstructions?.configured) {
      toast.error("Chargez d’abord les coordonnées Mobile Money officielles.");
      return;
    }
    setStep(3);
  }

  async function markProofReady(file: File | null) {
    setProof(file);
    setManualShareReady(false);
    if (!file || !purchase) return;
    try {
      if (purchase.status === "created") {
        toast.error("Chargez d’abord les instructions de paiement officielles.");
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

  async function submitVerification(current: PremiumPurchase, proofDigest: string) {
    if (!deviceIdentity) return;
    const updated = await advancePremiumPurchaseOrder({
      data: {
        reference: current.reference,
        status: "verification_pending",
        proofAttached: true,
        proofDigest,
        paymentReference,
        device: {
          deviceId: profile.deviceId,
          deviceKeyId: deviceIdentity.keyId,
          publicKey: deviceIdentity.publicKey,
        },
      },
    });
    rememberServerPurchase(updated);
    setManualShareReady(false);
    toast.success("Commande transmise pour vérification");
  }

  async function sendProof() {
    if (!proof || !deviceIdentity || !purchase) return;
    if (paymentReference.trim().length < 6) {
      toast.error("Saisissez la référence de transaction Mobile Money.");
      return;
    }
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

      const proofDigest = await fileSha256(proof);
      if (manualShareReady) {
        await submitVerification(current, proofDigest);
        return;
      }

      const message = fulfillmentRequestMessage(
        current,
        {
          optimusId: profile.optimusId,
          deviceId: profile.deviceId,
          deviceKeyId: deviceIdentity.keyId,
          publicKey: deviceIdentity.publicKey,
        },
        paymentReference.trim(),
      );
      const outcome = await shareOrCopy("Commande Optimus payée", message, [proof]);
      if (outcome === "cancelled") return;
      onRemember(message);
      if (outcome === "copied") {
        setManualShareReady(true);
        toast.success("Demande copiée. Joignez la preuve au message, envoyez-la, puis confirmez ici.");
        return;
      }

      await submitVerification(current, proofDigest);
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
          Les cours gratuits restent disponibles hors ligne. Une commande payante doit être
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
    return <ServerStatusCard purchase={purchase} title="Paiement en vérification" detail="La référence de transaction et l’empreinte de la preuve sont enregistrées. La validation est maintenant exclusivement côté serveur." />;
  }

  if (purchase?.status === "payment_verified") {
    return <ServerStatusCard purchase={purchase} title="Paiement vérifié" detail="Le paiement a été validé côté serveur. Le contenu Premium peut maintenant être préparé et livré pour cet appareil." />;
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
            <OfferCard active={offer === "deck"} title="1 Deck" detail="Une étape" price="3 000 Ar" onClick={() => setOffer("deck")} />
            <OfferCard active={offer === "specialty"} title="Spécialité" detail="10 Decks · 1 offert" price="27 000 Ar" recommended onClick={() => setOffer("specialty")} />
          </div>

          <div className="rounded-[var(--radius-xl)] bg-card p-4 shadow-[var(--shadow-border)]">
            <label className="text-xs font-medium text-muted" htmlFor="premium-specialty">Spécialité souhaitée</label>
            <select
              id="premium-specialty"
              className="mt-2 h-11 w-full rounded-[var(--radius-md)] bg-secondary px-3 text-sm shadow-[var(--shadow-border)]"
              value={specialty}
              onChange={(event) => setSpecialty(event.target.value as PremiumSpecialtyId)}
            >
              {PREMIUM_SPECIALTIES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>

            {offer === "deck" ? (
              <>
                <label className="mt-4 block text-xs font-medium text-muted" htmlFor="deck-number">Étape du parcours</label>
                <select
                  id="deck-number"
                  className="mt-2 h-11 w-full rounded-[var(--radius-md)] bg-secondary px-3 text-sm shadow-[var(--shadow-border)]"
                  value={deckNumber}
                  onChange={(event) => setDeckNumber(Number(event.target.value))}
                >
                  {Array.from({ length: 10 }, (_, index) => index + 1).map((number) => <option key={number} value={number}>Deck {number}/10</option>)}
                </select>
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
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-primary"><ShieldAlert className="size-5" /></span>
              <div>
                <h2 className="font-medium">Coordonnées Mobile Money officielles</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted">
                  Elles sont chargées depuis le serveur. Si elles ne sont pas configurées, le paiement est bloqué.
                </p>
              </div>
            </div>

            {paymentInstructions?.configured ? (
              <div className="mt-4 rounded-[var(--radius-lg)] bg-secondary p-3 text-sm">
                <p><strong>{paymentInstructions.provider}</strong> · {paymentInstructions.destination}</p>
                {paymentInstructions.accountName ? <p className="mt-1 text-muted">Titulaire : {paymentInstructions.accountName}</p> : null}
                <p className="mt-2 font-medium">Montant exact : {paymentInstructions.amount.toLocaleString("fr-FR")} Ar</p>
                <p className="mt-1 font-mono text-xs text-muted">Commande : {paymentInstructions.orderReference}</p>
                {paymentInstructions.note ? <p className="mt-2 text-xs text-muted">{paymentInstructions.note}</p> : null}
                <Button className="mt-3 w-full" variant="secondary" onClick={() => void copyPaymentInstructions()}>
                  <Send className="size-4" /> Copier / partager les instructions
                </Button>
              </div>
            ) : null}

            <Button className="mt-4 w-full" onClick={() => void requestPaymentInstructions()}>
              <Send className="size-4" />
              {paymentInstructions?.configured ? "Actualiser les coordonnées" : "Charger les coordonnées officielles"}
            </Button>
          </div>
          <Button className="w-full" variant="secondary" disabled={!paymentInstructions?.configured} onClick={continueAfterInstructions}>
            J’ai payé avec ces coordonnées
          </Button>
        </div>
      ) : null}

      {step === 3 && purchase ? (
        <div className="mt-5 space-y-4">
          <OrderSummary order={purchase} standalone />
          <div className="rounded-[var(--radius-xl)] bg-card p-4 shadow-[var(--shadow-border)]">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary"><ReceiptText className="size-5" /></span>
              <div className="min-w-0 flex-1">
                <h2 className="font-medium">Preuve et référence de paiement</h2>
                <p className="mt-1 text-sm text-muted">
                  Le fichier reste sur votre appareil. Le serveur conserve seulement sa signature SHA‑256 et la référence Mobile Money afin d’empêcher leur réutilisation.
                </p>
              </div>
            </div>

            <label className="mt-4 block text-xs font-medium text-muted" htmlFor="payment-reference">Référence de transaction Mobile Money</label>
            <Input
              id="payment-reference"
              className="mt-2 font-mono uppercase"
              autoComplete="off"
              spellCheck={false}
              placeholder="Ex. référence indiquée sur le reçu"
              value={paymentReference}
              onChange={(event) => setPaymentReference(event.target.value)}
            />

            <label className="mt-4 flex min-h-20 cursor-pointer items-center gap-3 rounded-[var(--radius-lg)] border border-dashed border-border bg-secondary px-4 py-3">
              {proof ? <FileCheck2 className="size-5 text-primary" /> : <Upload className="size-5 text-muted" />}
              <span className="min-w-0 text-sm">
                {proof ? <span className="block truncate font-medium">{proof.name}</span> : <span className="font-medium">Choisir la preuve</span>}
                <span className="mt-0.5 block text-xs text-muted">Image ou PDF · 8 Mo maximum</span>
              </span>
              <input className="sr-only" type="file" accept="image/*,application/pdf" onChange={(event) => loadProof(event, (file) => void markProofReady(file))} />
            </label>

            {manualShareReady ? (
              <p className="mt-3 rounded-[var(--radius-lg)] bg-secondary p-3 text-xs leading-relaxed text-muted">
                Le message a été copié car le partage de fichier n’est pas disponible. Joignez la preuve dans votre application de messagerie, envoyez-la, puis confirmez ci-dessous.
              </p>
            ) : null}

            <p className="mt-3 text-xs text-muted">🔐 Appareil : {deviceIdentity ? "clé sécurisée prête" : "préparation de la clé…"}</p>
            <Button
              className="mt-4 w-full"
              disabled={!proof || !deviceIdentity || paymentReference.trim().length < 6 || sending}
              onClick={() => void sendProof()}
            >
              <Send className="size-4" />
              {sending ? "Préparation…" : manualShareReady ? "J’ai envoyé la preuve — soumettre" : "Partager et demander la vérification"}
            </Button>
          </div>
          <BackButton onClick={() => setStep(2)} />
        </div>
      ) : null}
    </section>
  );
}

function ServerStatusCard({ purchase, title, detail }: { purchase: PremiumPurchase; title: string; detail: string }) {
  return (
    <section className="rounded-[var(--radius-xl)] bg-primary-soft p-5 shadow-[var(--shadow-border)]">
      <CheckCircle2 className="size-8 text-primary" />
      <h2 className="mt-3 font-display text-2xl font-medium">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">{detail}</p>
      <p className="mt-2 font-mono text-xs text-muted">{purchase.reference}</p>
      <Link to="/achats" className="mt-4 inline-block text-sm font-medium text-primary">Suivre la commande →</Link>
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
          <span className={cn("mx-auto flex size-8 items-center justify-center rounded-full text-xs font-medium", step.id <= current ? "bg-primary text-primary-fg" : "bg-secondary text-muted")}>
            {step.id < current ? <Check className="size-4" /> : step.id}
          </span>
          <span className={cn("mt-1 block text-[11px]", step.id === current ? "text-fg" : "text-muted")}>{step.label}</span>
        </li>
      ))}
    </ol>
  );
}

function OfferCard({ active, title, detail, price, recommended = false, onClick }: { active: boolean; title: string; detail: string; price: string; recommended?: boolean; onClick: () => void }) {
  return (
    <button type="button" role="radio" aria-checked={active} onClick={onClick} className={cn("relative min-h-36 rounded-[var(--radius-xl)] p-4 text-left shadow-[var(--shadow-border)] transition-colors", active ? "bg-primary-soft ring-2 ring-primary" : "bg-card")}>
      {recommended ? <span className="absolute right-2 top-2 rounded-full bg-primary px-2 py-1 text-[9px] font-medium uppercase tracking-wide text-primary-fg">Économisez 3 000 Ar</span> : null}
      <span className="block pt-5 text-sm font-medium">{title}</span>
      <span className="mt-1 block text-xs text-muted">{detail}</span>
      <span className="mt-5 block font-display text-xl font-medium">{price}</span>
    </button>
  );
}

function OrderSummary({ order, standalone = false, showReference = true }: { order: PremiumOrder; standalone?: boolean; showReference?: boolean }) {
  return (
    <div className={cn("mt-4 rounded-[var(--radius-lg)] bg-secondary p-3", standalone && "mt-0 shadow-[var(--shadow-border)]")}>
      <div className="flex items-start gap-3">
        <Layers3 className="mt-0.5 size-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{orderLabel(order)}</p>
          <p className="mt-1 text-xs text-muted">{orderProduct(order)}{showReference && order.reference ? ` · ${order.reference}` : ""}</p>
        </div>
        <p className="shrink-0 text-sm font-medium">{orderAmount(order).toLocaleString("fr-FR")} Ar</p>
      </div>
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return <button type="button" onClick={onClick} className="inline-flex items-center gap-1 text-sm text-muted"><ArrowLeft className="size-4" /> Retour</button>;
}
