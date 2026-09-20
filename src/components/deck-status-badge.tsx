import { AlertTriangle, CheckCircle2, FileEdit, XCircle } from "lucide-react";
import { DECK_STATUS_LABEL, type DeckStatus } from "@/core/types";
import { cn } from "@/lib/utils";

type Props = {
  status: DeckStatus;
  size?: "sm" | "md";
};

const STYLES: Record<DeckStatus, { bg: string; text: string; Icon: typeof CheckCircle2 }> = {
  draft: { bg: "bg-red-500/15 border-red-500/40", text: "text-red-400", Icon: FileEdit },
  in_review: { bg: "bg-amber-500/15 border-amber-500/40", text: "text-amber-400", Icon: AlertTriangle },
  published: { bg: "bg-emerald-500/15 border-emerald-500/40", text: "text-emerald-400", Icon: CheckCircle2 },
  deprecated: { bg: "bg-zinc-500/15 border-zinc-500/40", text: "text-zinc-400", Icon: XCircle },
};

export function DeckStatusBadge({ status, size = "md" }: Props) {
  const { bg, text, Icon } = STYLES[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-medium",
        bg,
        text,
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs",
      )}
    >
      <Icon className={size === "sm" ? "size-2.5" : "size-3"} aria-hidden />
      {DECK_STATUS_LABEL[status]}
    </span>
  );
}
