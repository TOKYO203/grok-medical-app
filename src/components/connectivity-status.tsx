import { useEffect, useRef, useState } from "react";
import { WifiOff } from "lucide-react";
import { toast } from "sonner";

export function ConnectivityStatus() {
  const [online, setOnline] = useState(true);
  const initialized = useRef(false);

  useEffect(() => {
    const refresh = () => {
      const next = navigator.onLine;
      setOnline(next);
      if (initialized.current && next) {
        toast.success("Connexion rétablie", {
          description: "La synchronisation Optimus peut reprendre.",
        });
      }
      initialized.current = true;
    };

    refresh();
    window.addEventListener("online", refresh);
    window.addEventListener("offline", refresh);
    return () => {
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", refresh);
    };
  }, []);

  if (online) return null;

  return (
    <div
      className="fixed inset-x-4 bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+4.75rem)] z-40 mx-auto flex max-w-md items-center gap-3 rounded-[var(--radius-lg)] border border-border bg-bg/95 px-4 py-3 shadow-[var(--shadow-md)] backdrop-blur-xl md:bottom-4"
      role="status"
      aria-live="polite"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-warn/15 text-warn">
        <WifiOff className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium">Mode hors ligne</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted">
          Continuez à réviser ; la synchronisation reprendra au retour du réseau.
        </span>
      </span>
    </div>
  );
}
