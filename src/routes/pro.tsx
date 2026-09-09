import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, KeyRound, Layers3, PackageCheck, ShieldCheck, Smartphone } from "lucide-react";
import { Page, Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useOptimus } from "@/state/store";
import { toast } from "sonner";

export const Route = createFileRoute("/pro")({ component: ProPage });

function ProPage() {
  const profile = useOptimus((s) => s.profile);
  const activatePro = useOptimus((s) => s.activatePro);
  const grantEntitlement = useOptimus((s) => s.grantEntitlement);
  const entitlements = useOptimus((s) => s.entitlements);
  const [activationKey, setActivationKey] = useState("");
  const [activating, setActivating] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<"deck" | "specialty">("specialty");

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
      const result = (await response.json()) as { error?: string; product?: string };
      if (!response.ok || !result.product)
        throw new Error(result.error || "Activation impossible.");
      if (result.product === "OPTIMUS_PRO") activatePro();
      else grantEntitlement(result.product);
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
        <h1 className="mt-1 font-display text-3xl font-medium tracking-tight">Optimus Pro</h1>
        <p className="mt-2 text-sm text-muted">
          Payez localement par Mobile Money, puis choisissez la façon dont vous souhaitez recevoir
          votre contenu.
        </p>
        {profile.tier !== "pro" ? (
          <div className="mt-6 space-y-3">
            <div aria-label="Choisir une offre" className="grid gap-3" role="radiogroup">
              <button
                type="button"
                role="radio"
                aria-checked={selectedOffer === "deck"}
                onClick={() => setSelectedOffer("deck")}
                className={`rounded-[var(--radius-xl)] p-4 text-left shadow-[var(--shadow-border)] transition-colors ${
                  selectedOffer === "deck" ? "bg-primary-soft ring-2 ring-primary" : "bg-card"
                }`}
              >
                <span className="flex items-start justify-between gap-3">
                  <span>
                    <span className="block text-sm font-medium">1 Deck</span>
                    <span className="mt-1 block text-xs text-muted">
                      Une étape de votre progression
                    </span>
                  </span>
                  <span
                    className={`flex size-6 shrink-0 items-center justify-center rounded-full ${
                      selectedOffer === "deck"
                        ? "bg-primary text-primary-fg"
                        : "bg-secondary text-transparent"
                    }`}
                  >
                    <Check className="size-4" />
                  </span>
                </span>
                <span className="mt-6 block font-display text-2xl font-medium">3 000 Ar</span>
              </button>

              <button
                type="button"
                role="radio"
                aria-checked={selectedOffer === "specialty"}
                onClick={() => setSelectedOffer("specialty")}
                className={`relative rounded-[var(--radius-xl)] p-4 text-left shadow-[var(--shadow-border)] transition-colors ${
                  selectedOffer === "specialty" ? "bg-primary-soft ring-2 ring-primary" : "bg-card"
                }`}
              >
                <span className="absolute right-3 top-3 rounded-full bg-primary px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-primary-fg">
                  Meilleur choix
                </span>
                <span className="flex items-start gap-3 pr-24">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-primary/10 text-primary">
                    <Layers3 className="size-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-medium">Spécialité complète</span>
                    <span className="mt-1 block text-xs text-muted">10 Decks progressifs</span>
                  </span>
                </span>
                <span className="mt-5 flex items-end justify-between gap-3">
                  <span>
                    <span className="block font-display text-2xl font-medium">27 000 Ar</span>
                    <span className="mt-1 block text-xs text-muted line-through">
                      30 000 Ar séparément
                    </span>
                  </span>
                  <span className="text-xs font-medium text-primary">1 Deck offert</span>
                </span>
              </button>
            </div>

            <section className="rounded-[var(--radius-xl)] bg-secondary p-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
                Votre choix
              </p>
              <h2 className="mt-1 font-medium">
                {selectedOffer === "specialty"
                  ? "Spécialité complète · 27 000 Ar"
                  : "Un Deck · 3 000 Ar"}
              </h2>
              <p className="mt-1 text-sm text-muted">
                {selectedOffer === "specialty"
                  ? "Débloquez les 10 étapes et progressez jusqu’à la maîtrise de la spécialité."
                  : "Commencez une étape maintenant, puis débloquez la suivante à votre rythme."}
              </p>
              <Link
                to="/contact"
                className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-[var(--radius-md)] bg-primary px-4 text-sm font-medium text-primary-fg transition-opacity hover:opacity-90"
              >
                Demander cette offre
              </Link>
            </section>

            <section className="rounded-[var(--radius-xl)] bg-card p-4 shadow-[var(--shadow-border)]">
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-primary-soft text-primary">
                  <KeyRound className="size-5" />
                </span>
                <div>
                  <h2 className="font-medium">Clé d’activation</h2>
                  <p className="mt-1 text-sm text-muted">
                    Accès Optimus Pro sur cet appareil, lié à votre identifiant.
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

            <section className="rounded-[var(--radius-xl)] bg-card p-4 shadow-[var(--shadow-border)]">
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-primary-soft text-primary">
                  <PackageCheck className="size-5" />
                </span>
                <div>
                  <h2 className="font-medium">Deck protégé</h2>
                  <p className="mt-1 text-sm text-muted">
                    Une matière à la carte, signée et liée à votre Optimus ID pour rester disponible
                    hors-ligne.
                  </p>
                  <Link to="/import" className="mt-3 inline-block text-sm font-medium text-primary">
                    J’ai reçu mon Deck →
                  </Link>
                </div>
              </div>
            </section>

            <div className="rounded-[var(--radius-lg)] bg-secondary p-4">
              <div className="flex items-center gap-2">
                <Smartphone className="size-4 text-primary" />
                <h2 className="text-sm font-medium">Paiement Mobile Money</h2>
              </div>
              <ol className="mt-3 space-y-2 text-sm text-muted">
                <li>1. Choisissez un Deck ou une spécialité complète.</li>
                <li>2. Transmettez votre Optimus ID et recevez les instructions de paiement.</li>
                <li>3. Recevez votre clé ou votre Deck personnel.</li>
              </ol>
            </div>

            <p className="flex items-start gap-2 text-xs leading-relaxed text-subtle">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" />
              Aucun accès Premium ne peut désormais être activé par un simple bouton de
              démonstration.
            </p>
          </div>
        ) : (
          <p className="mt-6 text-sm">
            Pro est actif. Les decks premium sont déverrouillés hors-ligne.
          </p>
        )}
        <p className="mt-6 text-xs text-subtle">
          Statut : {profile.tier}. Droits actifs : {entitlements.map((e) => e.product).join(", ")}.
        </p>
        <Link to="/soutenir" className="mt-6 inline-block text-sm text-muted hover:text-fg">
          Ce n’est pas un don — pour soutenir Fetra, voir Soutenir le développeur →
        </Link>
      </Page>
    </Shell>
  );
}
