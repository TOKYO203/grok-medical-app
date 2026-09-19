import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  Settings2, X, Search,
  Volume2, VolumeX, Zap, ZapOff,
  Sparkles, Headphones, Music2,
} from "lucide-react";
import { useExperiencePreferences } from "@/lib/use-experience-preferences";
import {
  emitExperienceFeedback,
  isFocusAmbienceActive,
  startFocusAmbience,
  stopFocusAmbience,
  subscribeFocusAmbience,
} from "@/lib/experience-feedback";

export function MobileToolsDrawer({ onOpenSearch }: { onOpenSearch: () => void }) {
  const [open, setOpen] = useState(false);
  const [focusActive, setFocusActive] = useState(false);
  const { preferences, update } = useExperiencePreferences();

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
      label: "Sons pédagogiques",
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
      label: "Vibrations",
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
      label: "Animations enrichies",
      pressed: preferences.enhancedMotion,
      toggle: () => update({ enhancedMotion: !preferences.enhancedMotion }),
    },
    {
      key: "focus",
      Icon: focusActive ? Music2 : Headphones,
      label: "Ambiance focus",
      pressed: focusActive,
      toggle: () => void toggleFocus(),
    },
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Outils"
        className="flex size-9 items-center justify-center rounded-[10px] bg-secondary text-muted shadow-[var(--shadow-border)] transition-colors active:scale-95 hover:text-fg"
      >
        <Settings2 className="size-4" />
      </button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[150] flex justify-end bg-black/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          >
            <div
              className="h-full w-[80%] max-w-xs overflow-y-auto border-l border-border bg-bg p-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
              style={{ animation: "slideIn 0.2s ease-out" }}
            >
              <header className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-base font-medium">Outils</h2>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Fermer"
                  className="flex size-8 items-center justify-center rounded-full text-muted hover:text-fg"
                >
                  <X className="size-4" />
                </button>
              </header>

              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onOpenSearch();
                }}
                className="mb-4 flex w-full items-center gap-2.5 rounded-[var(--radius-md)] border border-border bg-secondary/50 px-3 py-2.5 text-left text-sm hover:bg-secondary"
              >
                <Search className="size-3.5 text-muted" aria-hidden />
                <span className="flex-1 font-medium">Rechercher</span>
                <kbd className="rounded border border-border bg-card px-1.5 py-0.5 text-[10px]">⌘K</kbd>
              </button>

              <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-muted">
                Confort d'étude
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
