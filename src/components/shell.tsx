import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Activity, BookOpen, Calculator, ClipboardCheck, GraduationCap, Home, Library, RotateCcw, Search, Stethoscope, Trophy, Upload, UserRound } from "lucide-react";
import { CommandPalette, useCommandPalette } from "@/components/command-palette";
import { MobileToolsDrawer } from "@/components/mobile-tools-drawer";
import { Wordmark } from "@/components/brand/marks";
import { ExperienceControls } from "@/components/experience-controls";
import { ThemeToggle } from "@/components/theme-toggle";
import { useExperiencePreferences } from "@/lib/use-experience-preferences";
import { cn } from "@/lib/utils";
import { MedicalDisclaimer } from "@/components/legal/medical-disclaimer";

const NAV = [
  { to: "/",          label: "Accueil",     short: "Accueil", icon: Home },
  { to: "/demarche",  label: "Orientation", short: "Orient.", icon: Compass },
  { to: "/cas",       label: "Cas",         short: "Cas",     icon: Stethoscope },
  { to: "/parcours",  label: "Nosographie", short: "Noso.",   icon: BookMarked },
  { to: "/profil",    label: "Profil",      short: "Profil",  icon: UserRound },
] as const;

const EXPLORE = [
  { to: "/parcours", label: "Parcours guidés", icon: BookOpen },
  { to: "/programme", label: "Programme national", icon: GraduationCap },
  { to: "/demo-ecg", label: "ECG animé", icon: Activity },
  { to: "/examen", label: "Examen blanc", icon: ClipboardCheck },
  { to: "/calculateurs", label: "Calculateurs", icon: Calculator },
  { to: "/classement", label: "Classement", icon: Trophy },
  { to: "/import", label: "Importer un deck", icon: Upload },
] as const;

function isActive(pathname: string, to: string) {
  if (to === "/") return pathname === "/";
  return pathname === to || pathname.startsWith(`${to}/`);
}

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
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-bg/60 px-4 py-6 backdrop-blur-xl md:flex">
          <Link to="/" className="mb-5 px-1">
            <Wordmark />
          </Link>

          <button
            type="button"
            onClick={() => cmd.setOpen(true)}
            className="mb-5 flex items-center gap-2 rounded-[var(--radius-md)] border border-border bg-card/60 px-3 py-2 text-left text-sm text-muted transition-colors hover:text-fg"
          >
            <Search className="size-3.5" aria-hidden />
            <span className="flex-1">Rechercher…</span>
            <kbd className="rounded border border-border bg-secondary px-1.5 py-0.5 text-[10px]">
              ⌘K
            </kbd>
          </button>

          <nav className="flex flex-col gap-1" aria-label="Navigation principale">
            {NAV.map((item) => {
              const active = isActive(pathname, item.to);
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

          <div className="mt-6 mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-subtle">
            Explorer
          </div>
          <nav className="flex flex-col gap-0.5" aria-label="Navigation secondaire">
            {EXPLORE.map((item) => {
              const active = isActive(pathname, item.to);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-9 items-center gap-3 rounded-[var(--radius-sm)] px-3 text-[13px] transition-colors",
                    active ? "bg-secondary text-fg" : "text-muted hover:bg-secondary/60 hover:text-fg",
                  )}
                >
                  <Icon className="size-4" strokeWidth={1.75} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto flex items-center justify-between gap-2 pt-4">
            <ExperienceControls compact />
            <ThemeToggle className="bg-card" />
          </div>
          <p className="mt-3 px-3 text-[11px] uppercase tracking-[0.16em] text-subtle">
            Made in Madagascar
          </p>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col pb-24 md:pb-0">
          <header className="sticky top-0 z-20 flex h-14 min-w-0 items-center justify-between gap-2 border-b border-border bg-bg/80 px-4 backdrop-blur-xl md:hidden">
            <h1 className="min-w-0 flex-1 truncate font-display text-lg font-medium tracking-tight">
              {title ?? "Optimus"}
            </h1>
            <div className="flex shrink-0 items-center gap-2">
              <ThemeToggle className="bg-card" />
              <MobileToolsDrawer onOpenSearch={() => cmd.setOpen(true)} />
            </div>
          </header>
          {children}
        </div>
      </div>

      <nav
        aria-label="Navigation principale"
        data-mobile-navigation="true"
        className="fixed inset-x-2 bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-30 grid grid-cols-5 rounded-[22px] border border-border bg-bg/85 p-1 shadow-[0_20px_55px_-18px_rgb(0_0_0/0.5)] backdrop-blur-xl md:hidden"
      >
        {NAV.map((item) => {
          const active = isActive(pathname, item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "relative flex min-h-14 min-w-11 flex-col items-center justify-center gap-1 overflow-hidden rounded-[16px] text-[10px] font-medium transition-[background-color,color,transform] active:scale-[0.98]",
                active ? "bg-primary-soft text-primary" : "text-muted",
                preferences.enhancedMotion && active && "optimus-nav-active",
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="relative z-10 size-5" strokeWidth={active ? 2 : 1.7} />
              <span className="relative z-10 truncate px-0.5">{item.short}</span>
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
      <MedicalDisclaimer />
    </main>
  );
}

/** En-tête de page « masterclass » : kicker + titre + description courte. */
export function PageHeader({
  kicker,
  title,
  description,
  action,
}: {
  kicker?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 max-w-2xl">
        {kicker ? (
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">{kicker}</p>
        ) : null}
        <h1 className="mt-1 font-display text-3xl font-medium tracking-tight md:text-4xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 text-sm leading-relaxed text-muted">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
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
