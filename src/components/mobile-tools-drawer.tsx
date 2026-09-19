import { useEffect, useState, type ReactNode } from "react";
import { Settings2, X, Search } from "lucide-react";
import { ExperienceControls } from "@/components/experience-controls";

export function MobileToolsDrawer({
  onOpenSearch,
}: {
  onOpenSearch: () => void;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

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

      {open && (
        <div
          className="fixed inset-0 z-[150] flex justify-end bg-black/50 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="h-full w-[85%] max-w-sm overflow-y-auto border-l border-border bg-bg p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            style={{ animation: "slideIn 0.2s ease-out" }}
          >
            <header className="mb-5 flex items-center justify-between">
              <h2 className="font-display text-lg font-medium">Outils</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fermer"
                className="flex size-9 items-center justify-center rounded-full text-muted hover:text-fg"
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
              className="mb-5 flex w-full items-center gap-3 rounded-[var(--radius-md)] border border-border bg-secondary/50 px-4 py-3 text-left text-sm hover:bg-secondary"
            >
              <Search className="size-4 text-muted" aria-hidden />
              <span className="flex-1 font-medium">Rechercher</span>
              <kbd className="rounded border border-border bg-card px-1.5 py-0.5 text-[10px]">⌘K</kbd>
            </button>

            <section>
              <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
                Confort d'étude
              </p>
              <ExperienceControls />
            </section>
          </div>
        </div>
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
