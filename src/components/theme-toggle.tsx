import { useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Monitor, Moon, Sun } from "lucide-react";
import { useTheme, type AccentPalette, type ThemeMode } from "@/lib/theme";
import { cn } from "@/lib/utils";

const MODES: { id: ThemeMode; label: string; icon: typeof Sun }[] = [
  { id: "light", label: "Clair", icon: Sun },
  { id: "dark", label: "Sombre", icon: Moon },
  { id: "system", label: "Système", icon: Monitor },
];

const ACCENTS: { id: AccentPalette; label: string; swatch: string }[] = [
  { id: "defaut", label: "Défaut", swatch: "var(--accent-swatch-defaut)" },
  { id: "rose", label: "Rose", swatch: "var(--accent-swatch-rose)" },
  { id: "marron", label: "Marron", swatch: "var(--accent-swatch-marron)" },
  { id: "marine", label: "Bleu marine", swatch: "var(--accent-swatch-marine)" },
  { id: "vert", label: "Vert émeraude", swatch: "var(--accent-swatch-vert)" },
  { id: "violet", label: "Violet", swatch: "var(--accent-swatch-violet)" },
  { id: "royal", label: "Royal", swatch: "var(--accent-swatch-royal)" },
];

/** Ancrage du panneau déroulant : position `fixed` calculée à l'ouverture. */
type MenuAnchor = { left: number; up: boolean; y: number };

/** Largeur du panneau (w-60) — doit rester en phase avec la classe du panneau. */
const MENU_WIDTH = 240;

/** Espace minimal requis sous le bouton pour ouvrir vers le bas (sinon vers le haut). */
const MENU_OPEN_DOWN_MIN_SPACE = 420;

/**
 * Bouton compact (icône soleil/lune) qui ouvre un menu déroulant regroupant le
 * thème (Clair · Sombre · Système) ET la couleur d'accent — les deux réglages
 * restent accessibles en un clic depuis la barre latérale et l'en-tête mobile,
 * sans passer par la page Profil.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolved } = useTheme();
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<MenuAnchor | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const rawLeft = rect.right - MENU_WIDTH;
    const left = Math.min(Math.max(8, rawLeft), window.innerWidth - MENU_WIDTH - 8);
    const up = window.innerHeight - rect.bottom < MENU_OPEN_DOWN_MIN_SPACE;
    setAnchor({ left, up, y: up ? window.innerHeight - rect.top + 8 : rect.bottom + 8 });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target;
      if (!(target instanceof Node)) return;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Thème et couleur d’accent"
        title="Thème et couleur d’accent"
        className={cn(
          "flex size-9 items-center justify-center gap-0.5 rounded-[var(--radius-md)] text-muted shadow-[var(--shadow-border)] transition-[background-color,color,transform] hover:text-fg active:scale-95",
          className,
        )}
      >
        {resolved === "dark" ? (
          <Moon className="size-4" aria-hidden />
        ) : (
          <Sun className="size-4" aria-hidden />
        )}
        <ChevronDown className="size-3" aria-hidden />
      </button>
      {open && anchor ? (
        <ThemeMenuPanel anchor={anchor} panelRef={panelRef} onClose={() => setOpen(false)} />
      ) : null}
    </div>
  );
}

/**
 * Panneau déroulant porté dans <body> via `createPortal` : il échappe au
 * cadrage `overflow` de la barre latérale comme de l'en-tête mobile. Deux
 * groupes radio — même sémantique que ThemeSelector / AccentSelector de la
 * page Profil. Le panneau se referme après chaque choix.
 */
function ThemeMenuPanel({
  anchor,
  panelRef,
  onClose,
}: {
  anchor: MenuAnchor;
  panelRef: RefObject<HTMLDivElement | null>;
  onClose: () => void;
}) {
  const { mode, setTheme, accent, setAccent } = useTheme();
  const style = anchor.up
    ? { left: anchor.left, bottom: anchor.y }
    : { left: anchor.left, top: anchor.y };

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Thème et couleur d’accent"
      className="fixed z-[120] w-60 rounded-[var(--radius-md)] border border-border bg-card p-1.5 shadow-[var(--shadow-md)]"
      style={style}
    >
      <p className="optimus-kicker px-2 pb-1 pt-1 text-[10px] uppercase tracking-[0.16em]">
        Thème
      </p>
      <div role="radiogroup" aria-label="Thème" className="flex flex-col gap-0.5">
        {MODES.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={mode === id}
            onClick={() => {
              setTheme(id);
              onClose();
            }}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] px-2 py-2 text-left text-sm transition-colors",
              mode === id ? "text-fg" : "text-muted hover:bg-secondary hover:text-fg",
            )}
          >
            <Icon className="size-4" aria-hidden />
            <span className="flex-1">{label}</span>
            {mode === id ? <Check className="size-3.5" aria-hidden /> : null}
          </button>
        ))}
      </div>
      <p className="optimus-kicker mt-1.5 px-2 pb-1 pt-1 text-[10px] uppercase tracking-[0.16em]">
        Couleur d’accent
      </p>
      <div
        role="radiogroup"
        aria-label="Couleur d’accent"
        className="flex flex-col gap-0.5"
      >
        {ACCENTS.map(({ id, label, swatch }) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={accent === id}
            onClick={() => {
              setAccent(id);
              onClose();
            }}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] px-2 py-2 text-left text-sm transition-colors",
              accent === id ? "text-fg" : "text-muted hover:bg-secondary hover:text-fg",
            )}
          >
            <span
              aria-hidden
              className="inline-block size-3.5 shrink-0 rounded-full shadow-[inset_0_0_0_1px_rgb(0_0_0/0.15)]"
              style={{ backgroundColor: swatch }}
            />
            <span className="flex-1">{label}</span>
            {accent === id ? <Check className="size-3.5" aria-hidden /> : null}
          </button>
        ))}
      </div>
    </div>,
    document.body,
  );
}

/** Sélecteur segmenté complet (Clair / Sombre / Système) — pages de réglages. */
export function ThemeSelector({ className }: { className?: string }) {
  const { mode, setTheme } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Thème de l’interface"
      className={cn(
        "inline-flex items-center gap-1 rounded-[var(--radius-md)] bg-secondary p-1 shadow-[var(--shadow-border)]",
        className,
      )}
    >
      {MODES.map(({ id, label, icon: Icon }) => {
        const active = mode === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(id)}
            className={cn(
              "flex min-h-8 items-center gap-2 rounded-[var(--radius-sm)] px-3 text-xs font-medium transition-colors",
              active ? "bg-card text-fg shadow-[var(--shadow-border)]" : "text-muted hover:text-fg",
            )}
          >
            <Icon className="size-3.5" aria-hidden />
            {label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Sélecteur de palette d'accent (Défaut · Rose · Marron · Bleu marine ·
 * Vert émeraude · Violet · Royal).
 * Réglage orthogonal au thème : la palette colore la signature dorée dans
 * les modes clair, sombre ET système. Les pastilles consomment
 * `--accent-swatch-*` (définies dans styles.css) — aucun hex dans le composant.
 */
export function AccentSelector({ className }: { className?: string }) {
  const { accent, setAccent } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Couleur d’accent"
      className={cn(
        "inline-flex items-center gap-1 rounded-[var(--radius-md)] bg-secondary p-1 shadow-[var(--shadow-border)]",
        className,
      )}
    >
      {ACCENTS.map(({ id, label, swatch }) => {
        const active = accent === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setAccent(id)}
            title={label}
            className={cn(
              "flex min-h-8 items-center gap-2 rounded-[var(--radius-sm)] px-2.5 text-xs font-medium transition-colors",
              active ? "bg-card text-fg shadow-[var(--shadow-border)]" : "text-muted hover:text-fg",
            )}
          >
            <span
              aria-hidden
              className="inline-block size-3.5 shrink-0 rounded-full shadow-[inset_0_0_0_1px_rgb(0_0_0/0.15)]"
              style={{ backgroundColor: swatch }}
            />
            {label}
          </button>
        );
      })}
    </div>
  );
}
