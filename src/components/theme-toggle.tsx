import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme, type ThemeMode } from "@/lib/theme";
import { cn } from "@/lib/utils";

const MODES: { id: ThemeMode; label: string; icon: typeof Sun }[] = [
  { id: "light", label: "Clair", icon: Sun },
  { id: "dark", label: "Sombre", icon: Moon },
  { id: "system", label: "Système", icon: Monitor },
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
