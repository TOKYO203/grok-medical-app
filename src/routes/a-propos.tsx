import { createFileRoute, Link } from "@tanstack/react-router";
import { MadagascarMark, Wordmark } from "@/components/brand/marks";
import { Page, Shell } from "@/components/shell";

export const Route = createFileRoute("/a-propos")({ component: AboutPage });

function AboutPage() {
  return (
    <Shell title="À propos">
      <Page className="mx-auto max-w-lg">
        <Wordmark />
        <h1 className="mt-8 font-display text-4xl font-medium tracking-tight">
          Apprendre.
          <br />
          Raisonner.
          <br />
          Progresser.
        </h1>
        <div className="mt-8 flex items-center gap-4">
          <MadagascarMark className="h-20 w-12 text-primary" />
          <p className="text-sm leading-relaxed text-muted">
            Développé à Madagascar. Une silhouette, pas une carte postale — l’interface reste celle d’un outil clinique.
          </p>
        </div>
        <dl className="mt-8 space-y-3 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-[0.16em] text-muted">Développeur</dt>
            <dd className="mt-1">Fetra Mandresy</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.16em] text-muted">Version</dt>
            <dd className="mt-1 font-mono text-xs">2.0.0 · build 2026.08</dd>
          </div>
        </dl>
        <p className="mt-6 text-sm leading-relaxed text-muted">
          Optimus est un coach numérique de formation médicale : contenus versionnés, sources tracées, Mastery distincte
          de l’XP, hors-ligne d’abord. Ce n’est pas une banque de QCM.
        </p>
        <nav className="mt-8 grid gap-1 text-sm">
          <Link className="flex h-11 items-center rounded-[var(--radius-md)] px-3 hover:bg-secondary" to="/contact">
            Contact / signaler un problème
          </Link>
          <Link className="flex h-11 items-center rounded-[var(--radius-md)] px-3 hover:bg-secondary" to="/soutenir">
            Soutenir le développeur
          </Link>
          <Link className="flex h-11 items-center rounded-[var(--radius-md)] px-3 hover:bg-secondary" to="/pro">
            Optimus Pro
          </Link>
        </nav>
        <p className="mt-10 text-xs text-subtle">© 2026 Optimus — Made in Madagascar</p>
      </Page>
    </Shell>
  );
}
