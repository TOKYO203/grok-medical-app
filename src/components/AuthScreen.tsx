import { useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { GraduationCap, LockKeyhole, ShieldCheck } from "lucide-react";
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
 *
 * ÉDITION 2026-11-07 — « la première impression compte » : composition façon
 * Stripe — photographie plein écran (cerveau-circuit IA, 4K), panneau d'identité
 * à gauche sur grand écran, formulaire COMPACT à droite dans une carte solide.
 * Toute la logique et les attributs data-* (audit QA) restent strictement
 * identiques ; seuls l'enrobage et la typographie du design system
 * (tokens.css : .type-*, --sh-*, --r-*) changent.
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

const TRUST_POINTS = [
  {
    icon: GraduationCap,
    title: "Aligné sur le programme ECN",
    detail: "Fiches, cas cliniques et decks suivent le référentiel officiel malgache.",
  },
  {
    icon: ShieldCheck,
    title: "Contenu sourcé et vérifié",
    detail: "Chaque fiche cite ses sources, contrôlées à la rédaction.",
  },
  {
    icon: LockKeyhole,
    title: "Tes données restent les tiennes",
    detail: "La connexion synchronise ta progression, jamais tes clés privées.",
  },
] as const;

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
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-bg px-5 py-10 text-fg sm:px-8"
      data-cloud-auth="screen"
      data-cloud-auth-mode={mode}
    >
      {/*
       * FOND PHOTO 4K, STYLE STRIPE : un médecin étudie une IRM cérébrale sur
       * tablette (médecine + intelligence, photo LIBRE vérifiée via l'API Unsplash) —
       * elle occupe
       * tout l'écran ; un dégradé de --app-bg garantit la lisibilité des textes
       * posés dessus, la carte formulaire est elle-même solide. Purement
       * décoratif : aria-hidden, aucun texte ne repose sur l'image elle-même.
       */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <img
          src="https://images.unsplash.com/photo-1758691462668-046fd85ceac9?q=80&w=3840&auto=format&fit=crop"
          alt=""
          decoding="async"
          fetchPriority="high"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, color-mix(in oklab, var(--app-bg) 30%, transparent), color-mix(in oklab, var(--app-bg) 55%, transparent)), linear-gradient(to right, color-mix(in oklab, var(--app-bg) 40%, transparent), transparent 65%)",
          }}
        />
      </div>
      {/*
       * Halo d'accent très discret en haut à droite, dérivé de --app-accent
       * (suit le thème et la palette d'accent choisie).
       */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(1100px 540px at 85% -8%, color-mix(in oklab, var(--app-accent) 9%, transparent), transparent 62%), radial-gradient(900px 460px at -10% 110%, color-mix(in oklab, var(--app-accent) 6%, transparent), transparent 55%)",
        }}
      />

      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-[1.15fr_minmax(360px,460px)] lg:gap-20">
        {/*
         * PANNEAU D'IDENTITÉ (grand écran uniquement) : la promesse du produit
         * posée directement sur la photo, à gauche — le formulaire reste petit
         * et latéral, jamais étalé au centre.
         */}
        <aside className="hidden flex-col justify-center lg:flex">
          <p className="type-display-lg text-fg">
            Optimus<span className="text-primary">.</span>
          </p>
          <p className="type-micro mt-2 text-muted">Apprendre · Raisonner · Progresser</p>

          <h2 className="type-display-md mt-10 max-w-md text-fg">
            La révision médicale, à la hauteur de ton métier.
          </h2>
          <p className="type-body mt-4 max-w-md text-muted">
            Fiches, cas cliniques, ECG et flashcards : un parcours structuré, pensé pour les
            étudiants et soignants de Madagascar.
          </p>

          <ul className="mt-10 grid max-w-md gap-5">
            {TRUST_POINTS.map(({ icon: Icon, title, detail }) => (
              <li key={title} className="flex items-start gap-4">
                <span
                  className="flex size-10 shrink-0 items-center justify-center rounded-[var(--r-md)] text-primary"
                  style={{ backgroundColor: "var(--tone-accent-soft)" }}
                >
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="type-subtitle text-fg">{title}</p>
                  <p className="type-body-sm mt-1 text-muted">{detail}</p>
                </div>
              </li>
            ))}
          </ul>

          <p className="type-body-sm mt-10 text-muted">
            Envie de voir d'abord ?{" "}
            <Link
              to="/decouvrir"
              className="font-medium text-primary underline decoration-border-strong underline-offset-4 hover:text-fg"
            >
              Découvrir la plateforme
            </Link>
          </p>
        </aside>

        {/*
         * PANNEAU FORMULAIRE, STYLE STRIPE : une carte compacte et solide,
         * calée à droite sur grand écran, centrée sur mobile. Toute la logique
         * ci-dessous est inchangée (champs, ids, autoComplete, data-*,
         * gestion d'erreurs).
         */}
        <section className="flex justify-center lg:justify-end">
          <div className="w-full max-w-md">
            <header className="mb-6 text-center lg:hidden">
              <p className="type-display-lg text-fg">
                Optimus<span className="text-primary">.</span>
              </p>
              <p className="type-micro mt-2 text-muted">Apprendre · Raisonner · Progresser</p>
            </header>

            <div className="optimus-card p-5 sm:p-7" style={{ boxShadow: "var(--sh-overlay)" }}>
              <h1 className="type-title-lg text-fg">
                {isSignUp ? "Créer un compte" : "Connexion"}
              </h1>
              <p className="type-body-sm mt-1.5 text-muted">
                {isSignUp
                  ? "Ton compte synchronise ta progression sur tous tes appareils."
                  : "Retrouve ta progression et tes contenus sur tous tes appareils."}
              </p>

              {!configured ? (
                <p
                  className="mt-5 rounded-[var(--r-md)] p-3 text-sm text-fg"
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
                    <p className="rounded-[var(--r-md)] px-3 py-2 text-sm text-fg" role="alert"
                      style={{ backgroundColor: "var(--tone-danger-soft)" }}>
                      {error}
                    </p>
                  ) : null}

                  {notice ? (
                    <p className="rounded-[var(--r-md)] px-3 py-2 text-sm text-fg" role="status"
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
              <span aria-hidden="true"> · </span>
              <Link
                to="/decouvrir"
                className="underline decoration-border-strong underline-offset-4 hover:text-fg"
              >
                Découvrir sans compte
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
