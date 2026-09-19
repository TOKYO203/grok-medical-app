import { Download, CheckCircle2, Share, MoreVertical, Info } from "lucide-react";
import { usePwaInstall, type PwaPlatform } from "@/hooks/use-pwa-install";

const INSTRUCTIONS: Record<
  Exclude<PwaPlatform, "installed">,
  { icon: typeof Share; text: string }
> = {
  "chrome-android": {
    icon: MoreVertical,
    text: "Ouvre le menu Chrome (⋮ en haut à droite) puis choisis « Installer l'application » ou « Ajouter à l'écran d'accueil ».",
  },
  "firefox-android": {
    icon: MoreVertical,
    text: "Ouvre le menu Firefox (⋮ en haut à droite) puis choisis « Installer ».",
  },
  "ios-safari": {
    icon: Share,
    text: "Appuie sur Partager (carré ↑) en bas, puis choisis « Sur l'écran d'accueil ».",
  },
  desktop: {
    icon: Info,
    text: "Clique sur l'icône d'installation dans la barre d'adresse de ton navigateur (ou menu ⋮ → Installer).",
  },
  unknown: {
    icon: Info,
    text: "Ouvre le menu de ton navigateur et cherche « Installer l'application » ou « Ajouter à l'écran d'accueil ».",
  },
};

export default function PwaInstallCard() {
  const { canInstall, isInstalled, install, platform, isHttps } = usePwaInstall();

  if (isInstalled) {
    return (
      <div className="rounded-xl border border-primary/30 bg-primary-soft p-5">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="size-5 text-primary" />
          <div>
            <h3 className="font-semibold">Optimus est installé</h3>
            <p className="mt-1 text-sm text-muted">
              L'application est disponible depuis votre écran d'accueil.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const info = INSTRUCTIONS[platform as Exclude<PwaPlatform, "installed">] ?? INSTRUCTIONS.unknown;
  const Icon = info.icon;

  return (
    <div className="rounded-xl border p-5 space-y-3">
      <h3 className="text-lg font-bold">Installer Optimus</h3>
      <p className="text-sm text-muted">
        Accès rapide depuis l'écran d'accueil, comme une app native.
      </p>

      {canInstall ? (
        <button
          onClick={() => void install()}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 font-medium text-primary-fg"
        >
          <Download size={18} />
          Installer Optimus
        </button>
      ) : (
        <div className="rounded-lg border border-border bg-secondary/40 p-4">
          <div className="flex items-start gap-3">
            <Icon className="size-5 shrink-0 text-primary" aria-hidden />
            <p className="text-sm leading-relaxed text-muted">{info.text}</p>
          </div>
          {!isHttps && (
            <p className="mt-3 text-xs text-amber-500">
              ⚠️ Connexion non sécurisée (HTTP). L'installation nécessite HTTPS.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
