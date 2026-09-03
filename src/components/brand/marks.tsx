import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("text-primary", className)} aria-hidden="true">
      <rect
        x="1.5"
        y="1.5"
        width="29"
        height="29"
        rx="8"
        fill="currentColor"
        fillOpacity="0.14"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <polyline
        points="5,17 9,17 11.5,10 14.5,22 17.5,17 22,17 24,13 26,17 27.5,17"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Wordmark({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark className={compact ? "size-7" : "size-8"} />
      <div className="min-w-0 leading-tight">
        <p className="font-display text-xl font-medium tracking-tight text-fg">Optimus</p>
        {!compact ? (
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Formation médicale</p>
        ) : null}
      </div>
    </div>
  );
}

/** Quiet Madagascar silhouette — branding only, not a tourist stamp. */
export function MadagascarMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 96" className={cn("text-primary", className)} aria-hidden="true">
      <path
        fill="currentColor"
        d="M34.2 4.2c6.4 1.8 12.6 8.4 14.8 16.6 2.4 8.8.6 16.4-1.4 24.2-1.8 7.2-3.2 14.8-6.6 21.6-3.2 6.4-8.2 13.2-14.2 16.4-4.2 2.2-8.4 1.4-10.6-1.8-2.6-3.8-2.2-10.2-1.4-16.2.8-6.6 2.4-12.8 2.2-19.4-.2-7.8-3.2-14.8-2.4-22.2.8-7.4 6.2-14.2 12.4-16.8 2.2-.9 5-.9 7.2-.4z"
      />
    </svg>
  );
}

export function BaobabMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn("text-muted", className)} aria-hidden="true">
      <path
        fill="currentColor"
        d="M30 58h4v-14c8 2 12-4 14-10 1 6 6 8 10 7-2-8-8-10-12-9 2-8-2-16-10-18 2 6 1 12-2 16-4-8-12-10-16-6 6 2 8 8 8 12-8-1-14 4-14 10 6 0 10-2 12-6 1 6 6 12 16 14z"
      />
    </svg>
  );
}
