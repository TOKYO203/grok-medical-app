import { Link } from "@tanstack/react-router";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function ProfileMenuLink({
  icon: Icon,
  label,
  detail,
  to,
  last = false,
}: {
  icon: LucideIcon;
  label: string;
  detail: string;
  to:
    | "/bibliotheque"
    | "/parcours"
    | "/pro"
    | "/achats"
    | "/donnees"
    | "/classement"
    | "/import"
    | "/contact"
    | "/soutenir"
    | "/a-propos";
  last?: boolean;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-secondary",
        !last && "border-b border-border",
      )}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
        <Icon className="size-5" strokeWidth={1.7} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        <span className="mt-0.5 block truncate text-xs text-muted">{detail}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-subtle" />
    </Link>
  );
}
