import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Menu, X, Search,
  Volume2, VolumeX, Zap, ZapOff,
  Sparkles, Headphones, Music2,
} from "lucide-react";
import { ThemeSelector } from "@/components/theme-toggle";
import { EXPLORE_GROUPS, NAV, isActive } from "@/lib/navigation";
import { useExperiencePreferences } from "@/lib/use-experience-preferences";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import {
  emitExperienceFeedback,
  isFocusAmbienceActive,
  startFocusAmbience,
  stopFocusAmbience,
  subscribeFocusAmbience,
} from "@/lib/experience-feedback";

/*
 * Tiroir mobile (Phase 4 — UX « navigation classée ») : au-delà des réglages,
 * il expose désormais TOUTE la navigation de l'app — onglets principaux puis
 * groupes « Explorer » — pour qu'aucune surface ne soit inaccessible sur mobile.
 */
export function MobileToolsDrawer({ onOpenSearch }: { onOpenSearch: () => void }) {
  const [open, setOpen] = useState(false);
  const [focusActive, setFocusActive] = useState(false);
  const { preferences, update } = useExperiencePreferences();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { t } = useI18n();
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    setFocusActive(isFocusAmbienceActive());
    return subscribeFocusAmbience(setFocusActive);
  }, []);

  const toggleFocus = async () => {
    if (isFocusAmbienceActive()) stopFocusAmbience();
    else await startFocusAmbience();
    setFocusActive(isFocusAmbienceActive());
  };

  const rows = [
    {
      key: "sounds",
      Icon: preferences.sounds ? Volume2 : VolumeX,
      label: t("drawer.sounds"),
      pressed: preferences.sounds,
      toggle: () => {
        const next = !preferences.sounds;
        update({ sounds: next });
        if (next) emitExperienceFeedback("correct", { ...preferences, sounds: true, haptics: false });
      },
    },
    {
      key: "haptics",
      Icon: preferences.haptics ? Zap : ZapOff,
      label: t("drawer.haptics"),
      pressed: preferences.haptics,
      toggle: () => {
        const next = !preferences.haptics;
        update({ haptics: next });
        if (next) emitExperienceFeedback("correct", { ...preferences, sounds: false, haptics: true });
      },
    },
    {
      key: "motion",
      Icon: Sparkles,
      label: t("drawer.motion"),
      pressed: preferences.enhancedMotion,
      toggle: () => update({ enhancedMotion: !preferences.enhancedMotion }),
    },
    {
      key: "focus",
      Icon: focusActive ? Music2 : Headphones,
      label: t("drawer.focus"),
      pressed: focusActive,
      toggle: () => void toggleFocus(),
    },
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("drawer.openAria")}
        className="flex size-10 items-center justify-center rounded-[10px] bg-secondary text-muted shadow-[var(--shadow-border)] transition-colors active:scale-95 hover:text-fg"
      >
        <Menu className="size-4" />
      </button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[150] flex justify-end bg-black/50 backdrop-blur-sm"
            onClick={close}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label={t("drawer.title")}
              className="h-full w-[80%] max-w-xs overflow-y-auto border-l border-border bg-bg p-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
              style={{ animation: "slideIn 0.2s ease-out" }}
            >
              <header className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-base font-medium">{t("drawer.title")}</h2>
                <button
                  type="button"
                  onClick={close}
                  aria-label={t("common.close")}
                  className="flex size-8 items-center justify-center rounded-full text-muted hover:text-fg"
                >
                  <X className="size-4" />
                </button>
              </header>

              <button
                type="button"
                onClick={() => {
                  close();
                  onOpenSearch();
                }}
                className="mb-4 flex w-full items-center gap-2.5 rounded-[var(--radius-md)] border border-border bg-secondary/50 px-3 py-2.5 text-left text-sm hover:bg-secondary"
              >
                <Search className="size-3.5 text-muted" aria-hidden />
                <span className="flex-1 font-medium">{t("nav.search")}</span>
                <kbd className="rounded border border-border bg-card px-1.5 py-0.5 text-[10px]">⌘K</kbd>
              </button>

              <nav className="mb-4 flex flex-col gap-1" aria-label={t("nav.ariaPrimary")}>
                {NAV.map((item) => {
                  const active = isActive(pathname, item.to);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={close}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex h-11 items-center gap-3 rounded-[var(--radius-md)] px-3 text-sm font-medium transition-colors",
                        active
                          ? "bg-primary-soft text-primary"
                          : "text-muted hover:bg-secondary hover:text-fg",
                      )}
                    >
                      <Icon className="size-5" strokeWidth={1.75} />
                      {t(item.labelKey)}
                    </Link>
                  );
                })}
              </nav>

              <nav className="mb-5" aria-label={t("nav.ariaSecondary")}>
                {EXPLORE_GROUPS.map((group) => (
                  <div key={group.labelKey} className="mb-3 last:mb-0">
                    <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted">
                      {t(group.labelKey)}
                    </p>
                    <div className="flex flex-col gap-0.5">
                      {group.items.map((item) => {
                        const active = isActive(pathname, item.to);
                        const Icon = item.icon;
                        return (
                          <Link
                            key={item.to}
                            to={item.to}
                            onClick={close}
                            aria-current={active ? "page" : undefined}
                            className={cn(
                              "flex h-10 items-center gap-3 rounded-[var(--radius-md)] px-3 text-[13px] transition-colors",
                              active
                                ? "bg-secondary text-fg"
                                : "text-muted hover:bg-secondary/60 hover:text-fg",
                            )}
                          >
                            <Icon className="size-4" strokeWidth={1.75} />
                            {t(item.labelKey)}
                          </Link>
                         );
                     })}
                    </div>
                  </div>
                ))}
              </nav>

              <p className="optimus-kicker mb-3 px-1 text-[11px] font-semibold uppercase tracking-[0.18em]">
                {t("drawer.settings")}
              </p>
              <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-muted">
                {t("drawer.appearance")}
              </p>
              <ThemeSelector className="mb-5 w-full justify-between" />

              <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-muted">
                {t("profil.confort")}
              </p>
              <div className="space-y-1">
                {rows.map(({ key, Icon, label, pressed, toggle }) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={pressed}
                    onClick={toggle}
                    className="flex w-full items-center gap-2.5 rounded-[var(--radius-md)] px-2.5 py-2 text-left transition-colors hover:bg-secondary/60"
                  >
                    <Icon className="size-4 shrink-0 text-muted" aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-sm">{label}</span>
                    <span
                      className={`h-5 w-9 shrink-0 rounded-full p-0.5 transition-colors ${
                        pressed ? "bg-primary" : "bg-border-strong"
                      }`}
                    >
                      <span
                        className={`block size-4 rounded-full bg-white transition-transform ${
                          pressed ? "translate-x-4" : ""
                        }`}
                      />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>,
          document.body,
        )}

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
      `}</style>
    </>
  );
}
