import { cn } from "@/lib/utils";

export function Progress({
  value,
  className,
  barClassName,
}: {
  value: number;
  className?: string;
  barClassName?: string;
}) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div
      className={cn(
        "relative h-1.5 w-full overflow-hidden rounded-full bg-secondary shadow-[inset_0_1px_2px_rgb(0_0_0/0.22)]",
        className,
      )}
      role="progressbar"
      aria-valuenow={Math.round(v)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn(
          "relative h-full rounded-full bg-gradient-to-r from-primary via-primary to-success transition-[width] duration-300 ease-[var(--ease-out)] shadow-[0_0_14px_-6px_var(--color-primary)]",
          barClassName,
        )}
        style={{ width: `${v}%` }}
      >
        <span
          className="absolute inset-x-0 top-0 h-px bg-white/25"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
