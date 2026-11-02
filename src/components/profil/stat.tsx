import { cn } from "@/lib/utils";

export function ProfileStat({
  label,
  value,
  bordered = false,
}: {
  label: string;
  value: string;
  bordered?: boolean;
}) {
  return (
    <div className={cn("px-2 py-3 text-center", bordered && "border-l border-border")}>
      <p className="font-display text-lg font-medium">{value}</p>
      <p className="mt-0.5 text-[11px] uppercase tracking-wider text-muted">{label}</p>
    </div>
  );
}
