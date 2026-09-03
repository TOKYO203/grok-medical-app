import { createFileRoute, Link } from "@tanstack/react-router";
import { Page, Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { useOptimus } from "@/state/store";
import { toast } from "sonner";

export const Route = createFileRoute("/pro")({ component: ProPage });

function ProPage() {
  const profile = useOptimus((s) => s.profile);
  const activate = useOptimus((s) => s.activatePro);
  const grant = useOptimus((s) => s.grantEntitlement);
  const entitlements = useOptimus((s) => s.entitlements);

  return (
    <Shell title="Pro">
      <Page className="mx-auto max-w-lg">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Entitlements</p>
        <h1 className="mt-1 font-display text-3xl font-medium tracking-tight">Optimus Pro</h1>
        <p className="mt-2 text-sm text-muted">
          Le contenu et le droit d’accès sont séparés. Un achat crée un entitlement, puis le deck se télécharge et
          fonctionne hors-ligne. Pas de publicité, pas de verrou artificiel du quotidien.
        </p>
        <ul className="mt-6 space-y-2 text-sm">
          <li className="rounded-[var(--radius-md)] bg-card px-4 py-3 shadow-[var(--shadow-border)]">
            Bibliothèque complète, cas avancés, examens blancs
          </li>
          <li className="rounded-[var(--radius-md)] bg-card px-4 py-3 shadow-[var(--shadow-border)]">
            Statistiques et parcours adaptatif
          </li>
          <li className="rounded-[var(--radius-md)] bg-card px-4 py-3 shadow-[var(--shadow-border)]">
            Decks à l’unité (ex. Cardiologie Pro)
          </li>
        </ul>
        <p className="mt-4 text-xs text-subtle">
          Statut actuel : {profile.tier}. Droits : {entitlements.map((e) => e.product).join(", ")}.
        </p>
        {profile.tier !== "pro" ? (
          <div className="mt-6 flex flex-col gap-2">
            <Button
              onClick={() => {
                activate();
                toast.success("Entitlement OPTIMUS_PRO activé sur cet appareil");
              }}
            >
              Activer Pro (démo locale)
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                grant("CARDIO_PRO");
                toast.success("Entitlement CARDIO_PRO");
              }}
            >
              Acheter le deck Cardiologie
            </Button>
          </div>
        ) : (
          <p className="mt-6 text-sm">Pro est actif. Les decks premium sont déverrouillés hors-ligne.</p>
        )}
        <p className="mt-6 text-xs text-muted">
          Sur les stores, les achats numériques suivront les règles Google Play / App Store. Ici, la démo simule la
          validation serveur → entitlement → usage local.
        </p>
        <Link to="/soutenir" className="mt-6 inline-block text-sm text-muted hover:text-fg">
          Ce n’est pas un don — pour soutenir Fetra, voir Soutenir le développeur →
        </Link>
      </Page>
    </Shell>
  );
}
