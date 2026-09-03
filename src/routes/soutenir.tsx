import { createFileRoute, Link } from "@tanstack/react-router";
import { Page, Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/soutenir")({ component: SupportPage });

function SupportPage() {
  return (
    <Shell title="Soutenir">
      <Page className="mx-auto max-w-lg">
        <h1 className="font-display text-3xl font-medium tracking-tight">Soutenir le développeur</h1>
        <p className="mt-2 text-sm text-muted">
          Distinct d’Optimus Pro. Un don volontaire, jamais exigé pour apprendre. Moyens adaptés à Madagascar et aux
          stores — ici, une intention locale.
        </p>
        <div className="mt-6 space-y-2">
          <Button
            className="w-full"
            variant="secondary"
            onClick={() => toast.success("Merci. Le don sera branché sur Mobile Money / store.")}
          >
            Mobile Money (à venir)
          </Button>
          <Button
            className="w-full"
            variant="secondary"
            onClick={() => toast.success("Merci. Lien de don store à brancher.")}
          >
            Don via le store
          </Button>
        </div>
        <Link to="/pro" className="mt-8 inline-block text-sm text-muted hover:text-fg">
          Pour les decks premium, c’est Optimus Pro →
        </Link>
      </Page>
    </Shell>
  );
}
