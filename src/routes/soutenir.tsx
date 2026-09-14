import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, HeartHandshake, ShieldCheck } from "lucide-react";
import { Page, Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/soutenir")({ component: SupportPage });

function SupportPage() {
  return (
    <Shell title="Soutenir">
      <Page className="mx-auto max-w-lg">
        <section className="premium-hero relative overflow-hidden rounded-[var(--radius-xl)] p-6 text-primary-fg shadow-[var(--shadow-md)]">
          <HeartHandshake className="size-10" />
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] opacity-70">
            Contribution volontaire
          </p>
          <h1 className="mt-2 font-display text-3xl font-medium tracking-tight">
            Soutenir Optimus
          </h1>
          <p className="mt-3 text-sm leading-relaxed opacity-75">
            Le soutien reste entièrement facultatif et ne conditionne jamais l’accès aux contenus
            gratuits.
          </p>
        </section>

        <section className="mt-6 rounded-[var(--radius-xl)] bg-card p-5 shadow-[var(--shadow-border)]">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
              <ShieldCheck className="size-5" />
            </span>
            <div>
              <h2 className="font-medium">Canal officiel uniquement</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                Demandez les coordonnées de contribution depuis le formulaire officiel. Aucun
                numéro de paiement non vérifié n’est affiché dans l’application.
              </p>
            </div>
          </div>
          <Link to="/contact" className="mt-5 block">
            <Button className="w-full" size="lg">
              Demander les coordonnées
              <ArrowRight className="size-4" />
            </Button>
          </Link>
        </section>
        <Link to="/pro" className="mt-8 inline-block text-sm text-muted hover:text-fg">
          Pour les decks premium, c’est Optimus Pro →
        </Link>
      </Page>
    </Shell>
  );
}
