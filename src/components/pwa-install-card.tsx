import { useEffect, useState } from "react";
import { CheckCircle2, Download, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";

function detectStandalone() {
  if (typeof window === "undefined") return false;
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    navigatorWithStandalone.standalone === true
  );
}

export function PwaInstallCard() {
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(display-mode: standalone)");
    const refresh = () => setInstalled(detectStandalone());
    refresh();
    media.addEventListener?.("change", refresh);
    return () => media.removeEventListener?.("change", refresh);
  }, []);

  return (
    <section
      className={cn(
        "rounded-[var(--radius-xl)] p-4 shadow-[var(--shadow-border)]",
        installed ? "bg-primary-soft" : "bg-card",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] shadow-[var(--shadow-border)]",
            installed ? "bg-primary text-primary-fg" : "bg-secondary text-primary",
          )}
        >
          {installed ? <CheckCircle2 className="size-5" /> : <Smartphone className="size-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
            Application mobile
          </p>
          <h2 className="mt-1 font-display text-xl font-medium tracking-tight">
            {installed ? "Optimus est installé" : "Installer Optimus"}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            {installed
              ? "Accès plein écran et reprise rapide depuis l’écran d’accueil de votre téléphone."
              : "Ajoutez Optimus à votre écran d’accueil pour une expérience plus proche d’une application native."}
          </p>
          {!installed ? (
            <a
              href="/?install=1"
              className="mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-primary px-4 text-sm font-medium text-primary-fg"
            >
              <Download className="size-4" />
              Voir les étapes d’installation
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}
