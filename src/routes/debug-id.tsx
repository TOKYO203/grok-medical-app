import { createFileRoute } from "@tanstack/react-router";
import { Page, Shell } from "@/components/shell";
import { useOptimus } from "@/state/store";

export const Route = createFileRoute("/debug-id")({ component: DebugIdPage });

function DebugIdPage() {
  const profile = useOptimus((s) => s.profile);
  const raw = typeof window !== "undefined"
    ? JSON.parse(localStorage.getItem("optimus-v2") ?? "{}")
    : {};

  return (
    <Shell title="Debug ID">
      <Page className="mx-auto max-w-2xl">
        <h1 className="font-display text-2xl">Debug — Identifiants</h1>

        <div className="mt-6 rounded-[var(--radius-lg)] bg-card p-4 shadow-[var(--shadow-border)]">
          <p className="text-[11px] uppercase tracking-wider text-muted">
            Optimus ID (à copier dans Vercel)
          </p>
          <p className="mt-2 break-all font-mono text-lg font-medium text-primary">
            {profile.optimusId}
          </p>
        </div>

        <div className="mt-4 rounded-[var(--radius-lg)] bg-card p-4 shadow-[var(--shadow-border)]">
          <p className="text-[11px] uppercase tracking-wider text-muted">
            Device ID
          </p>
          <p className="mt-2 break-all font-mono text-xs">{profile.deviceId}</p>
        </div>

        <div className="mt-4 rounded-[var(--radius-lg)] bg-card p-4 shadow-[var(--shadow-border)]">
          <p className="text-[11px] uppercase tracking-wider text-muted">
            Tier
          </p>
          <p className="mt-2 font-mono text-sm">{profile.tier}</p>
        </div>

        <div className="mt-4 rounded-[var(--radius-lg)] bg-card p-4 shadow-[var(--shadow-border)]">
          <p className="text-[11px] uppercase tracking-wider text-muted">
            Contenu localStorage (brut)
          </p>
          <pre className="mt-2 overflow-x-auto text-[10px]">
            {JSON.stringify(raw, null, 2)}
          </pre>
        </div>
      </Page>
    </Shell>
  );
}
