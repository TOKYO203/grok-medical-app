import { useEffect, useState } from "react";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { Cloud, CloudOff, LockKeyhole, ShieldCheck } from "lucide-react";
import { AuthScreen } from "@/components/AuthScreen";
import { Page, Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { authEnabled, signIn } from "@/lib/auth/client";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  getAuthRuntimeStatus,
  type AuthRuntimeStatus,
} from "@/lib/auth/runtime-status";
import { useAppUser } from "@/hooks/useAppUser";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/login")({ component: LoginPage });

function friendlySignInError(): string {
  return "La connexion n'a pas abouti. Réessayez dans quelques instants ou continuez sans compte.";
}

function LoginPage() {
  const { user, isPending } = useAppUser();
  const [runtime, setRuntime] = useState<AuthRuntimeStatus | null>(null);
  const [runtimeError, setRuntimeError] = useState(false);
  const [busyProvider, setBusyProvider] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getAuthRuntimeStatus()
      .then((status) => {
        if (!cancelled) setRuntime(status);
      })
      .catch(() => {
        if (!cancelled) setRuntimeError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * DÉJÀ CONNECTÉ ? ON N'IMPOSE PAS UNE SECONDE CONNEXION.
   *
   * `AuthScreen` ne testait pas la session : un utilisateur authentifié qui
   * suivait un lien vers `/login` (par exemple depuis la carte d'achat qui
   * l'envoyait ici) retrouvait un formulaire vide et pouvait croire sa session
   * perdue — c'est ce qui donnait l'impression de devoir « se connecter deux
   * fois ». La redirection est évaluée AVANT le rendu du formulaire, et seulement
   * une fois la session résolue (`!isPending`).
   */
  if (!isPending && user && !user.isDevFallback) return <Navigate to="/pro" replace />;

  // Supabase est la source d'authentification dès qu'il est configuré : /login
  // et le gate de `__root.tsx` affichent alors le MÊME écran (une seule UI de
  // connexion, pas deux systèmes concurrents).
  if (isSupabaseConfigured) return <AuthScreen />;
  if (!authEnabled) return <Navigate to="/pro" replace />;

  const checking = isPending || (!runtime && !runtimeError);
  const ready = Boolean(runtime?.ready);

  return (
    <Shell title="Connexion">
      <Page className="mx-auto max-w-xl pb-32 pt-8 sm:py-10">
        <section className="rounded-[var(--radius-xl)] bg-card p-5 shadow-[var(--shadow-border)] sm:p-8">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary">
            <Cloud className="size-6" />
          </div>
          <h1 className="mt-5 font-display text-3xl font-medium tracking-tight">
            Retrouver mon Optimus
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            Connectez-vous pour sauvegarder votre progression et la retrouver sur vos autres
            appareils. Les clés Premium liées à un appareil restent protégées localement.
          </p>

          {checking ? (
            <div className="mt-7 rounded-[var(--radius-lg)] bg-secondary p-4 text-sm text-muted">
              Vérification du service de connexion…
            </div>
          ) : ready ? (
            <div className="mt-7 grid gap-3">
              {runtime?.providers.map((provider) => (
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
                    }).catch(() => {
                      setBusyProvider(null);
                      setError(friendlySignInError());
                    });
                  }}
                >
                  {busyProvider === provider.providerId
                    ? "Connexion en cours…"
                    : `Continuer avec ${provider.label}`}
                </Button>
              ))}
            </div>
          ) : (
            <div className="mt-7 rounded-[var(--radius-lg)] bg-secondary p-4">
              <div className="flex items-start gap-3">
                <CloudOff className="mt-0.5 size-5 shrink-0 text-muted" />
                <div>
                  <p className="font-medium text-foreground">Connexion cloud indisponible ici</p>
                  <p className="mt-1 text-sm leading-6 text-muted">
                    {runtime?.message ??
                      "Le service de connexion n'a pas pu être vérifié sur ce déploiement."}
                  </p>
                </div>
              </div>
              <Link
                to="/"
                className={cn(buttonVariants({ variant: "outline" }), "mt-4 w-full")}
              >
                Continuer sans compte
              </Link>
            </div>
          )}

          {error ? (
            <p
              role="alert"
              className="mt-4 rounded-[var(--radius-md)] bg-danger-soft p-3 text-sm text-danger"
            >
              {error}
            </p>
          ) : null}

          <div className="mt-7 grid gap-3 text-sm text-muted sm:grid-cols-2">
            <div className="rounded-[var(--radius-lg)] bg-secondary p-4">
              <ShieldCheck className="mb-2 size-5 text-primary" />
              Votre progression cloud est liée à votre compte et isolée des autres utilisateurs.
            </div>
            <div className="rounded-[var(--radius-lg)] bg-secondary p-4">
              <LockKeyhole className="mb-2 size-5 text-primary" />
              Les clés privées et contenus Premium protégés ne sont pas copiés dans le cloud.
            </div>
          </div>

          <p className="mt-6 text-center text-xs leading-5 text-muted">
            Optimus reste utilisable localement sans connexion.{" "}
            <Link to="/" className="font-medium text-primary hover:underline">
              Retour à l'accueil
            </Link>
          </p>
        </section>
      </Page>
    </Shell>
  );
}
