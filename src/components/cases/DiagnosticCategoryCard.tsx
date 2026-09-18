import { ChevronRight } from "lucide-react";

type Props = {
  name: string;
  count: number;
  icon?: string;
  onClick?: () => void;
};

export function DiagnosticCategoryCard({
  name,
  count,
  icon = "🩺",
  onClick,
}: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="optimus-interactive-card flex w-full items-center gap-4 rounded-[var(--radius-xl)] bg-card p-4 text-left shadow-[var(--shadow-border)]"
    >
      <span className="flex size-12 items-center justify-center rounded-[var(--radius-md)] bg-primary-soft text-xl">
        {icon}
      </span>

      <span className="flex-1">
        <span className="block font-medium">
          {name}
        </span>

        <span className="text-sm text-muted">
          {count} orientation{count > 1 ? "s" : ""}
        </span>
      </span>

      <ChevronRight className="size-5 text-muted" />
    </button>
  );
}
