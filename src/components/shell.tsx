import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { BookOpen, ClipboardList, Home, RotateCcw, UserRound, Search } from "lucide-react";
import { CommandPalette, useCommandPalette } from "@/components/command-palette";
import { Wordmark } from "@/components/brand/marks";
import { ExperienceControls } from "@/components/experience-controls";
import { useExperiencePreferences } from "@/lib/use-experience-preferences";
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
  const { preferences } = useExperiencePreferences();
  const cmd = useCommandPalette();

  return (
    <div className="min-h-dvh text-fg">
      <a
        href="#main-content"
        className="fixed left-4 top-3 z-[100] -translate-y-20 rounded-[var(--radius-md)] bg-primary px-4 py-2 text-sm font-medium text-primary-fg shadow-[var(--shadow-md)] transition-transform focus:translate-y-0"
      >
        Aller au contenu
      </a>
      <div className="mx-auto flex min-h-dvh max-w-7xl">
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-bg/55 px-5 py-6 backdrop-blur-xl md:flex">
          <Link to="/" className="mb-4">
            <Wordmark />
          </Link>
          <button
            type="button"
            onClick={() => cmd.setOpen(true)}
            className="mb-4 flex items-center gap-2 rounded-[var(--radius-md)] border border-border bg-secondary/50 px-3 py-2 text-left text-sm text-muted hover:text-fg"
          >
            <Search className="size-3.5" aria-hidden />
            <span className="flex-1">Rechercher…</span>
            <kbd className="rounded border border-border bg-card px-1.5 py-0.5 text-[10px]">⌘K</kbd>
          </button>
          <nav className="flex flex-1 flex-col gap-1" aria-label="Navigation principale">
            {NAV.map((item) => {
              const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex h-11 items-center gap-3 overflow-hidden rounded-[var(--radius-md)] px-3 text-sm font-medium transition-[background-color,color,transform] duration-150 active:scale-[0.99]",
                    active
                      ? "bg-primary-soft text-primary shadow-[var(--shadow-border)]"
                      : "text-muted hover:bg-secondary hover:text-fg",
                    preferences.enhancedMotion && active && "optimus-nav-active",
                  )}
                >
                  <Icon className="relative z-10 size-5" strokeWidth={1.75} />
                  <span className="relative z-10">{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="mb-3">
            <ExperienceControls compact />
          </div>
          <p className="px-3 text-[11px] uppercase tracking-[0.16em] text-subtle">
            Made in Madagascar
          </p>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col pb-24 md:pb-0">
          {title ? (
            <header className="sticky top-0 z-20 flex h-14 min-w-0 items-center justify-between gap-2 border-b border-border bg-bg/75 px-4 backdrop-blur-xl md:hidden">
              <h1 className="min-w-0 flex-1 truncate font-display text-lg font-medium tracking-tight">
                {title}
              </h1>
              <div className="shrink-0">
                <ExperienceControls compact />
              </div>
            </header>
          ) : null}
          {children}
        </div>
      </div>
      <nav
        aria-label="Navigation principale"
        data-mobile-navigation="true"
        className="fixed inset-x-2 bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-30 grid grid-cols-5 rounded-[22px] border border-border bg-bg/80 p-1 shadow-[0_20px_55px_-18px_rgb(0_0_0/0.9)] backdrop-blur-xl md:hidden"
      >
        {NAV.map((item) => {
          const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "relative flex min-h-14 min-w-11 flex-col items-center justify-center gap-1 overflow-hidden rounded-[16px] text-[11px] font-medium transition-[background-color,color,transform] active:scale-[0.98]",
                active ? "bg-primary-soft text-primary" : "text-muted",
                preferences.enhancedMotion && active && "optimus-nav-active",
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="relative z-10 size-5" strokeWidth={active ? 2 : 1.7} />
              <span className="relative z-10">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <CommandPalette open={cmd.open} onClose={() => cmd.setOpen(false)} />
    </div>
  );
}

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className={cn("px-5 py-6 outline-none md:px-10 md:py-10", className)}
    >
      {children}
    </main>
  );
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
        <h2 className="font-display text-xl font-medium tracking-tight text-fg md:text-2xl">
          {title}
        </h2>
      </div>
      {action}
    </div>
  );
}
