import { Monitor, Moon, Sun } from "lucide-react";
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
];

/** Bascule de thème compacte (icône) — idéale en barre latérale / barre mobile. */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolved, setTheme } = useTheme();
  const next: ThemeMode = resolved === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={resolved === "dark" ? "Passer en thème clair" : "Passer en thème sombre"}
      title={resolved === "dark" ? "Thème clair" : "Thème sombre"}
      className={cn(
        "flex size-9 items-center justify-center rounded-[var(--radius-md)] text-muted shadow-[var(--shadow-border)] transition-[background-color,color,transform] hover:text-fg active:scale-95",
        className,
      )}
    >
      {resolved === "dark" ? (
        <Moon className="size-4" aria-hidden />
      ) : (
        <Sun className="size-4" aria-hidden />
      )}
    </button>
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
 * Vert émeraude · Violet).
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