import { createFileRoute, Link } from "@tanstack/react-router";
import { KeyRound, PackageCheck, ShieldCheck, Smartphone } from "lucide-react";
import { Page, Shell } from "@/components/shell";
import { useOptimus } from "@/state/store";

export const Route = createFileRoute("/pro")({ component: ProPage });

function ProPage() {
  const profile = useOptimus((s) => s.profile);
  const entitlements = useOptimus((s) => s.entitlements);

  return (
    <Shell title="Pro">
      <Page className="mx-auto max-w-lg">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Accès Premium</p>
        <h1 className="mt-1 font-display text-3xl font-medium tracking-tight">Optimus Pro</h1>
        <p className="mt-2 text-sm text-muted">
          Payez localement par Mobile Money, puis choisissez la façon dont vous souhaitez recevoir votre contenu.
        </p>
        {profile.tier !== "pro" ? (
          <div className="mt-6 space-y-3">
            <section className="rounded-[var(--radius-xl)] bg-card p-4 shadow-[var(--shadow-border)]">
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-primary-soft text-primary">
                  <KeyRound className="size-5" />
                </span>
                <div>
                  <h2 className="font-medium">Clé d’activation</h2>
                  <p className="mt-1 text-sm text-muted">Accès Optimus Pro sur cet appareil, lié à votre identifiant.</p>
                  <p className="mt-3 font-mono text-xs text-subtle">Votre ID : {profile.optimusId}</p>
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
                    Une matière à la carte, signée et liée à votre Optimus ID pour rester disponible hors-ligne.
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
                <li>1. Choisissez Pro complet ou un Deck.</li>
                <li>2. Payez et transmettez la référence avec votre Optimus ID.</li>
                <li>3. Recevez votre clé ou votre Deck personnel.</li>
              </ol>
            </div>

            <p className="flex items-start gap-2 text-xs leading-relaxed text-subtle">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" />
              Aucun accès Premium ne peut désormais être activé par un simple bouton de démonstration.
            </p>
          </div>
        ) : (
          <p className="mt-6 text-sm">Pro est actif. Les decks premium sont déverrouillés hors-ligne.</p>
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
