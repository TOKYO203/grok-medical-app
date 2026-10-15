import { Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";

const RATES = [
  { value: 1, label: "1×" },
  { value: 0.5, label: "0.5×" },
  { value: 0.25, label: "0.25×" },
] as const;

export function MonitorControls({
  playing,
  rate,
  onTogglePlay,
  onRateChange,
  disabled,
}: {
  playing: boolean;
  rate: number;
  onTogglePlay: () => void;
  onRateChange: (r: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onTogglePlay}
        disabled={disabled}
        aria-label={playing ? "Arrêter" : "Écouter"}
        className={cn(
          "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
          disabled
            ? "bg-secondary text-subtle"
            : "bg-primary text-primary-fg shadow-[var(--shadow-soft)]",
        )}
      >
        {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
        {playing ? "Arrêter" : "Écouter"}
      </button>

      <div className="inline-flex rounded-full bg-secondary p-0.5 shadow-[var(--shadow-border)]">
        {RATES.map((r) => (
          <button
            key={r.value}
            type="button"
            onClick={() => onRateChange(r.value)}
            className={cn(
              "rounded-full px-3 py-1.5 font-mono text-xs tabular-nums transition-colors",
              rate === r.value
                ? "bg-card text-fg shadow-[var(--shadow-soft)]"
                : "text-muted hover:text-fg",
            )}
          >
            {r.label}
          </button>
        ))}
      </div>

    </div>
  );
}
