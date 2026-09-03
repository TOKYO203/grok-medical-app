import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { BookOpen, ClipboardList, Home, RotateCcw, UserRound } from "lucide-react";
import { Wordmark } from "@/components/brand/marks";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Accueil", icon: Home },
  { to: "/parcours", label: "Parcours", icon: BookOpen },
  { to: "/cas", label: "Cas", icon: ClipboardList },
  { to: "/revue", label: "Réviser", icon: RotateCcw },
  { to: "/profil", label: "Profil", icon: UserRound },
] as const;

export function Shell({ children, title }: { children: ReactNode; title?: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="min-h-dvh bg-bg text-fg">
      <div className="mx-auto flex min-h-dvh max-w-6xl">
        <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-border px-4 py-5 md:flex">
          <Link to="/" className="mb-8">
            <Wordmark />
          </Link>
          <nav className="flex flex-1 flex-col gap-1">
            {NAV.map((item) => {
              const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex h-11 items-center gap-3 rounded-[var(--radius-md)] px-3 text-sm font-medium transition-colors duration-150",
                    active ? "bg-secondary text-fg" : "text-muted hover:bg-secondary hover:text-fg",
                  )}
                >
                  <Icon className="size-4" strokeWidth={1.75} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <p className="px-3 text-[11px] uppercase tracking-[0.16em] text-subtle">Made in Madagascar</p>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col pb-20 md:pb-0">
          {title ? (
            <header className="sticky top-0 z-20 flex h-14 items-center border-b border-border bg-bg/90 px-5 backdrop-blur-sm md:hidden">
              <h1 className="font-display text-lg font-medium tracking-tight">{title}</h1>
            </header>
          ) : null}
          {children}
        </div>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-bg/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm md:hidden">
        {NAV.map((item) => {
          const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium",
                active ? "text-fg" : "text-muted",
              )}
            >
              <Icon className="size-5" strokeWidth={active ? 2 : 1.7} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <main className={cn("px-5 py-6 md:px-8 md:py-8", className)}>{children}</main>;
}

export function SectionTitle({
  kicker,
  title,
  action,
}: {
  kicker?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div>
        {kicker ? (
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">{kicker}</p>
        ) : null}
        <h2 className="font-display text-xl font-medium tracking-tight text-fg md:text-2xl">{title}</h2>
      </div>
      {action}
    </div>
  );
}
