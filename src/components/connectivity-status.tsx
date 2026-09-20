import { useEffect, useRef, useState } from "react";
import { WifiOff } from "lucide-react";
import { toast } from "sonner";

export function ConnectivityStatus() {
  const [online, setOnline] = useState(true);
  const [visible, setVisible] = useState(false);
  const previousOnline = useRef<boolean | null>(null);

  useEffect(() => {
    const refresh = () => {
      const next = navigator.onLine;
      const previous = previousOnline.current;
      setOnline(next);

      if (previous === false && next) {
        toast.success("Connexion rétablie", {
          description: "La synchronisation Optimus peut reprendre.",
        });
        setVisible(false);
      } else if (previous !== null && !next) {
        // Passe hors ligne → afficher
        setVisible(true);
      } else if (previous === null && !next) {
        // Démarrage hors ligne → afficher brièvement
        setVisible(true);
      }

      previousOnline.current = next;
    };

    refresh();
    window.addEventListener("online", refresh);
    window.addEventListener("offline", refresh);
    return () => {
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", refresh);
    };
  }, []);

  // Auto-hide après 4 secondes quand hors ligne
  useEffect(() => {
    if (!visible) return;
    const t = window.setTimeout(() => setVisible(false), 4000);
    return () => window.clearTimeout(t);
  }, [visible]);

  if (online || !visible) return null;

  return (
    <div
      className="fixed inset-x-4 top-[calc(env(safe-area-inset-top)+1rem)] z-50 mx-auto flex max-w-md items-center gap-3 overflow-hidden rounded-[var(--radius-lg)] bg-bg/95 px-4 py-3 shadow-[var(--shadow-md)] backdrop-blur-xl md:top-4"
      role="status"
      aria-live="polite"
      style={{
        borderLeft: "4px solid transparent",
        borderImage: "linear-gradient(180deg, #FFFFFF 0%, #FC3D32 50%, #007E3A 100%) 1",
      }}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-warn/15 text-warn">
        <WifiOff className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">Mode hors ligne</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted">
          Continuez à réviser ; la synchronisation reprendra au retour du réseau.
        </span>
      </span>
      <span
        aria-hidden
        className="ml-1 h-8 w-1.5 shrink-0 rounded-full"
        style={{
          background: "linear-gradient(180deg, #FFFFFF 0%, #FC3D32 50%, #007E3A 100%)",
        }}
      />
    </div>
  );
}
