import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BarChart3,
  ClipboardList,
  Database,
  FileWarning,
  Layers3,
  LayoutDashboard,
  Lock,
  ShoppingBag,
  Users,
} from "lucide-react";
import { Page, Shell } from "@/components/shell";
import { getAdminKey } from "@/routes/admin-login";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({ component: AdminHubPage });

type Module = {
  to: string;
  label: string;
  description: string;
  Icon: typeof LayoutDashboard;
  badge?: string;
  color?: "primary" | "amber" | "emerald";
  status?: "ready" | "soon";
};

const MODULES: Module[] = [
  {
    to: "/admin-reports",
    label: "Signalements",
    description: "Erreurs médicales remontées par les étudiants",
    Icon: FileWarning,
    color: "amber",
    status: "ready",
  },
  {
    to: "/admin-decks",
    label: "Decks",
    description: "Bibliothèque de contenus (draft / publié)",
    Icon: Layers3,
    color: "primary",
    status: "ready",
  },
  {
    to: "/admin-achats",
    label: "Achats premium",
    description: "Commandes Mobile Money à valider",
    Icon: ShoppingBag,
    color: "emerald",
    status: "ready",
  },
  {
    to: "/admin-users",
    label: "Utilisateurs",
    description: "Base utilisateurs (à venir avec l'auth)",
    Icon: Users,
    status: "soon",
  },
  {
    to: "/admin-stats",
    label: "Statistiques",
    description: "Croissance, conversions, engagement",
    Icon: BarChart3,
    status: "soon",
  },
];

function AdminHubPage() {
  const adminKey = getAdminKey();

  if (!adminKey) {
    return (
      <Shell title="Admin">
        <Page className="mx-auto max-w-md">
          <div className="mt-10 text-center">
            <Lock className="mx-auto size-8 text-amber-500" aria-hidden />
            <h1 className="mt-4 font-display text-2xl">Accès administrateur</h1>
            <p className="mt-2 text-sm text-muted">
              Connecte-toi d'abord pour accéder au back-office.
            </p>
            <Link
              to="/admin-login"
              className="mt-6 inline-flex items-center justify-center rounded-[var(--radius-md)] bg-primary px-6 py-3 text-sm font-medium text-primary-fg"
            >
              Se connecter
            </Link>
          </div>
        </Page>
      </Shell>
    );
  }

  return (
    <Shell title="Back-office">
      <Page className="mx-auto max-w-2xl">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-[var(--radius-md)] bg-primary-soft text-primary">
            <LayoutDashboard className="size-5" aria-hidden />
          </span>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
              Fondation Optimus
            </p>
            <h1 className="font-display text-2xl font-medium tracking-tight">Back-office</h1>
          </div>
        </div>

        <p className="mt-4 text-sm text-muted">
          Console d'administration — gestion du contenu, modération, paiements.
        </p>

        <div className="mt-8 space-y-2">
          {MODULES.map((m) => {
            const isSoon = m.status === "soon";
            const Icon = m.Icon;
            const inner = (
              <div
                className={cn(
                  "flex items-center gap-4 rounded-[var(--radius-lg)] bg-card p-4 shadow-[var(--shadow-border)]",
                  !isSoon && "transition-colors hover:bg-secondary",
                  isSoon && "opacity-50",
                )}
              >
                <span
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-md)]",
                    m.color === "amber" && "bg-amber-500/15 text-amber-400",
                    m.color === "emerald" && "bg-emerald-500/15 text-emerald-400",
                    (!m.color || m.color === "primary") && "bg-primary-soft text-primary",
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{m.label}</p>
                  <p className="mt-0.5 text-xs text-muted">{m.description}</p>
                </div>
                {isSoon ? (
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-subtle">
                    Bientôt
                  </span>
                ) : (
                  <span className="text-muted">→</span>
                )}
              </div>
            );

            return isSoon ? (
              <div key={m.to}>{inner}</div>
            ) : (
              <Link key={m.to} to={m.to} className="block">
                {inner}
              </Link>
            );
          })}
        </div>

        <div className="mt-10 rounded-[var(--radius-lg)] bg-card p-4 shadow-[var(--shadow-border)]">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
            Système
          </p>
          <div className="mt-3 space-y-2">
            <a
              href="https://console.neon.tech"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 text-sm text-muted transition-colors hover:text-fg"
            >
              <Database className="size-4" aria-hidden />
              Base de données Neon
            </a>
            <a
              href="https://vercel.com/justme-4fc3/grok-medical-app"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 text-sm text-muted transition-colors hover:text-fg"
            >
              <ClipboardList className="size-4" aria-hidden />
              Vercel (déploiements + logs)
            </a>
            <Link
              to="/admin-login"
              className="flex items-center gap-3 text-sm text-muted transition-colors hover:text-fg"
            >
              <Lock className="size-4" aria-hidden />
              Changer la session admin
            </Link>
          </div>
        </div>

        <p className="mt-8 text-center text-[11px] text-subtle">
          Fondation Optimus · v1.0 · Made in Madagascar 🇲🇬
        </p>
      </Page>
    </Shell>
  );
}
