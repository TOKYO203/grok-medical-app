import { Download, CheckCircle2 } from "lucide-react";
import { usePwaInstall } from "@/hooks/use-pwa-install";

export default function PwaInstallCard() {
  const { canInstall, isInstalled, install } = usePwaInstall();

  const handleInstall = async () => {
    const success = await install();

    if (success) {
      console.log("OptimUS installé avec succès");
    }
  };

  if (isInstalled) {
    return (
      <div className="rounded-xl border p-4 bg-green-50">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="text-green-600" />

          <div>
            <h3 className="font-semibold">
              Optimus installé
            </h3>

            <p className="text-sm text-muted-foreground">
              L'application est disponible depuis votre écran d'accueil.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border p-5 space-y-3">
      <h3 className="text-lg font-bold">
        Installer Optimus
      </h3>

      <p className="text-sm text-muted-foreground">
        Installez l'application Optimus sur votre appareil
        pour un accès rapide comme une application native.
      </p>

      <button
        onClick={handleInstall}
        disabled={!canInstall}
        className="
          w-full
          flex
          items-center
          justify-center
          gap-2
          rounded-lg
          bg-primary
          px-4
          py-3
          text-primary-foreground
          disabled:opacity-50
        "
      >
        <Download size={18} />

        {canInstall
          ? "Installer Optimus"
          : "Installation disponible après chargement"}
      </button>
    </div>
  );
}
