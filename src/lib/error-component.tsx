import type { ErrorComponentProps } from "@tanstack/react-router";
import { Home, RefreshCw, TriangleAlert } from "lucide-react";

export function AppErrorComponent({ error }: ErrorComponentProps) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const showDetails = import.meta.env.DEV && Boolean(message);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg px-5 py-10 text-fg">
      <section className="w-full max-w-md rounded-[var(--radius-xl)] bg-card p-6 text-center shadow-[var(--shadow-md)]">
        <span
          className="mx-auto flex size-12 items-center justify-center rounded-full bg-danger/15 text-danger"
          aria-hidden="true"
        >
          <TriangleAlert className="size-5" strokeWidth={1.8} />
        </span>
        <p className="mt-5 text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
          Optimus
        </p>
        <h1 className="mt-1 font-display text-2xl font-medium tracking-tight">
          Impossible d’afficher cet écran
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Une erreur inattendue s’est produite. Votre progression locale n’est pas supprimée par cet écran.
        </p>

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-primary px-4 text-sm font-medium text-primary-fg"
          >
            <RefreshCw className="size-4" />
            Réessayer
          </button>
          <a
            href="/"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-secondary px-4 text-sm font-medium text-fg shadow-[var(--shadow-border)]"
          >
            <Home className="size-4" />
            Accueil
          </a>
        </div>

        {showDetails ? (
          <details className="mt-5 rounded-[var(--radius-md)] bg-secondary p-3 text-left">
            <summary className="cursor-pointer text-xs font-medium text-muted">Détails développeur</summary>
            <p className="mt-2 break-words font-mono text-[11px] leading-relaxed text-subtle">
              {message}
            </p>
          </details>
        ) : null}
      </section>
    </main>
  );
}
