import { useState } from "react";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { Cloud, LockKeyhole, ShieldCheck } from "lucide-react";
import { Page, Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { authEnabled, GROK_PROVIDERS, signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const { user, isPending } = useCurrentUserState();
  const [busyProvider, setBusyProvider] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!authEnabled) return <Navigate to="/profil" />;
  if (!isPending && user) return <Navigate to="/profil" />;

  return (
    <Shell title="Connexion">
      <Page className="mx-auto max-w-xl py-10">
        <section className="rounded-[var(--radius-xl)] bg-card p-6 shadow-[var(--shadow-border)] sm:p-8">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary">
            <Cloud className="size-6" />
          </div>
          <h1 className="mt-5 font-display text-3xl font-medium tracking-tight">
            Retrouver mon Optimus
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            Connectez-vous pour sauvegarder votre progression et la retrouver sur vos autres
            appareils. Les licences et clés Premium liées à un appareil restent protégées localement.
          </p>

          {isPending ? (
            <div className="mt-7 rounded-[var(--radius-lg)] bg-secondary p-4 text-sm text-muted">
              Vérification de la session…
            </div>
          ) : (
            <div className="mt-7 grid gap-3">
              {GROK_PROVIDERS.map((provider) => (
                <Button
                  key={provider.providerId}
                  size="lg"
                  className="w-full"
                  disabled={busyProvider !== null}
                  onClick={() => {
                    setError(null);
                    setBusyProvider(provider.providerId);
                    void signIn(provider.providerId, {
                      callbackURL: "/profil",
                      errorCallbackURL: "/login",
                    }).catch((cause) => {
                      setBusyProvider(null);
                      setError(
                        cause instanceof Error
                          ? cause.message
                          : "La connexion n'a pas pu être démarrée.",
                      );
                    });
                  }}
                >
                  {busyProvider === provider.providerId
                    ? "Connexion en cours…"
                    : `Continuer avec ${provider.label}`}
                </Button>
              ))}
            </div>
          )}

          {error ? (
            <p role="alert" className="mt-4 rounded-[var(--radius-md)] bg-danger-soft p-3 text-sm text-danger">
              {error}
            </p>
          ) : null}

          <div className="mt-7 grid gap-3 text-sm text-muted sm:grid-cols-2">
            <div className="rounded-[var(--radius-lg)] bg-secondary p-4">
              <ShieldCheck className="mb-2 size-5 text-primary" />
              La progression serveur est isolée par votre identifiant Better Auth vérifié.
            </div>
            <div className="rounded-[var(--radius-lg)] bg-secondary p-4">
              <LockKeyhole className="mb-2 size-5 text-primary" />
              Les secrets et contenus Premium chiffrés ne sont pas copiés dans le cloud.
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-muted">
            Vous pouvez aussi continuer à utiliser Optimus localement sans connexion.{" "}
            <Link to="/" className="font-medium text-primary hover:underline">
              Retour à l'accueil
            </Link>
          </p>
        </section>
      </Page>
    </Shell>
  );
}
