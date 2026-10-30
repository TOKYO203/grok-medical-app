import { useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isSupabaseConfigured, loadSupabase } from "@/lib/supabase";
import { track } from "@/lib/analytics/client";

/**
 * Écran de connexion Supabase (email + mot de passe).
 *
 * Rendu par le gate de `__root.tsx` UNIQUEMENT quand la session est résolue et
 * absente (`loading === false`, `session === null`) — il n'a donc jamais à gérer
 * d'état de chargement de session.
 *
 * Il ne fait volontairement rien d'autre : après un `signIn` réussi,
 * `onAuthStateChange` met à jour le store de session, le gate rebascule et
 * l'application s'affiche à la même URL. Aucun `navigate()` manuel à maintenir.
 */

type AuthMode = "signin" | "signup";

function friendlyAuthError(error: unknown): string {
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : "";

  if (/invalid login credentials/i.test(message)) return "Email ou mot de passe incorrect.";
  if (/email not confirmed/i.test(message)) return "Confirme d'abord ton adresse email (lien reçu par mail).";
  if (/user already registered/i.test(message)) return "Un compte existe déjà avec cet email. Connecte-toi.";
  if (/password should be at least/i.test(message)) return "Le mot de passe doit contenir au moins 6 caractères.";
  if (/unable to validate email|invalid email/i.test(message)) return "Cette adresse email n'est pas valide.";
  if (/rate limit|too many/i.test(message)) return "Trop de tentatives. Réessaie dans quelques minutes.";
  if (/fetch|network|failed to fetch/i.test(message)) {
    return "Impossible de joindre le service. Vérifie ta connexion internet et réessaie.";
  }
  // Message générique : on n'expose jamais une erreur brute du fournisseur.
  return "La connexion a échoué. Réessaie dans quelques instants.";
}

export function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const configured = isSupabaseConfigured;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      // Le SDK arrive dans son propre chunk : on ne le charge qu'ici, au moment
      // où l'utilisateur agit réellement.
      const client = await loadSupabase();
      if (!client) {
        setError("La connexion cloud n'est pas configurée sur ce déploiement.");
        return;
      }

      if (mode === "signin") {
        const { error: signInError } = await client.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) throw signInError;
      } else {
        const { data, error: signUpError } = await client.auth.signUp({
          email: email.trim(),
          password,
        });
        if (signUpError) throw signUpError;
        // MESURE-1 : le compte est créé (session immédiate ou confirmation par
        // e-mail) — c'est l'événement d'entrée du tunnel d'activation.
        track("signup");
        if (!data.session) {
          setNotice("Compte créé. Vérifie ta boîte mail pour confirmer ton adresse, puis connecte-toi.");
          setMode("signin");
        }
      }
    } catch (submitError) {
      setError(friendlyAuthError(submitError));
    } finally {
      setBusy(false);
    }
  }

  const isSignUp = mode === "signup";

  return (
    /*
     * `<main>` et non `<div>` : pour un visiteur anonyme dans un build de
     * production, CET écran EST la page. Sans repère principal, le document
     * n'avait plus AUCUN landmark (constaté par l'audit mobile : `mainCount: 0`
     * sur les 5 écrans audités), ce qui prive la navigation au lecteur d'écran
     * de son point d'entrée.
     *
     * Volontairement SANS `id="main-content"` : cet écran peut être rendu à
     * l'intérieur du `Shell` (route `/login`), dont les pages portent déjà cet
     * identifiant — un doublon d'id serait invalide, et deux `<main>` dans le
     * même document aussi. Ici le gate remplace la page, il ne s'y ajoute pas.
     */
    <main
      className="flex min-h-screen flex-col items-center justify-center bg-bg px-5 py-10 text-fg"
      data-cloud-auth="screen"
      data-cloud-auth-mode={mode}
    >
      <div className="w-full max-w-sm">
        <header className="mb-6 text-center">
          <p className="font-display text-3xl font-medium tracking-tight text-fg">
            Optimus<span className="text-primary">.</span>
          </p>
          <p className="mt-1 text-sm text-muted">Apprendre. Raisonner. Progresser.</p>
        </header>

        <div className="optimus-card p-5 sm:p-6">
          <h1 className="font-display text-2xl font-medium tracking-tight">
            {isSignUp ? "Créer un compte" : "Connexion"}
          </h1>
          <p className="mt-1.5 text-sm leading-6 text-muted">
            {isSignUp
              ? "Ton compte synchronise ta progression sur tous tes appareils."
              : "Retrouve ta progression et tes contenus sur tous tes appareils."}
          </p>

          {!configured ? (
            <p
              className="mt-5 rounded-[var(--radius-md)] p-3 text-sm text-fg"
              style={{ backgroundColor: "var(--tone-warn-soft)" }}
              role="alert"
            >
              La connexion cloud n'est pas configurée sur ce déploiement. Ton contenu local reste
              accessible.
            </p>
          ) : (
            <form className="mt-5 flex flex-col gap-3" onSubmit={handleSubmit} noValidate>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="cloud-email" className="text-sm font-medium text-fg">
                  Email
                </label>
                <Input
                  id="cloud-email"
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="prenom@exemple.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  aria-invalid={error ? true : undefined}
                  required
                  disabled={busy}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="cloud-password" className="text-sm font-medium text-fg">
                  Mot de passe
                </label>
                <Input
                  id="cloud-password"
                  name="password"
                  type="password"
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                  placeholder="Au moins 6 caractères"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  aria-invalid={error ? true : undefined}
                  minLength={6}
                  required
                  disabled={busy}
                />
              </div>

              {error ? (
                <p className="rounded-[var(--radius-md)] px-3 py-2 text-sm text-fg" role="alert"
                  style={{ backgroundColor: "var(--tone-danger-soft)" }}>
                  {error}
                </p>
              ) : null}

              {notice ? (
                <p className="rounded-[var(--radius-md)] px-3 py-2 text-sm text-fg" role="status"
                  style={{ backgroundColor: "var(--tone-success-soft)" }}>
                  {notice}
                </p>
              ) : null}

              <Button type="submit" size="lg" className="mt-1 w-full" disabled={busy} data-cloud-auth-submit>
                {busy ? "Connexion…" : isSignUp ? "Créer mon compte" : "Se connecter"}
              </Button>
            </form>
          )}

          {configured ? (
            <button
              type="button"
              className="mt-4 w-full text-center text-sm text-muted underline decoration-border-strong underline-offset-4 hover:text-fg"
              onClick={() => {
                setMode(isSignUp ? "signin" : "signup");
                setError(null);
                setNotice(null);
              }}
              data-cloud-auth-switch
            >
              {isSignUp ? "J'ai déjà un compte" : "Pas de compte ? Créer un compte"}
            </button>
          ) : null}
        </div>

        <p className="mt-5 text-center text-xs leading-5 text-subtle">
          Ta progression locale est conservée : la connexion ne remplace rien, elle l'enregistre.
        </p>
        <p className="mt-2 text-center text-xs leading-5 text-subtle">
          <Link to="/tarifs" className="underline decoration-border-strong underline-offset-4 hover:text-fg">
            Voir les offres Optimus
          </Link>
        </p>
        <p className="mt-2 text-center text-xs leading-5 text-subtle">
          <a
            href="/decouvrir"
            className="underline decoration-border-strong underline-offset-4 hover:text-fg"
          >
            Découvrir Optimus avant de créer un compte
          </a>
        </p>
      </div>
    </main>
  );
}
