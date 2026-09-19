import { useCallback, useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type PwaPlatform =
  | "installed"
  | "ios-safari"
  | "firefox-android"
  | "chrome-android"
  | "desktop"
  | "unknown";

function detectPlatform(): PwaPlatform {
  if (typeof window === "undefined") return "unknown";
  const ua = navigator.userAgent.toLowerCase();
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true;
  if (standalone) return "installed";
  if (/iphone|ipad|ipod/.test(ua)) return "ios-safari";
  if (/firefox/.test(ua) && /android/.test(ua)) return "firefox-android";
  if (/android/.test(ua) && /chrome/.test(ua)) return "chrome-android";
  return "desktop";
}

export function usePwaInstall() {
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [platform, setPlatform] = useState<PwaPlatform>("unknown");

  useEffect(() => {
    setPlatform(detectPlatform());
    setIsInstalled(detectPlatform() === "installed");

    const handler = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    const installedHandler = () => {
      setInstallPrompt(null);
      setIsInstalled(true);
      setPlatform("installed");
    };
    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const install = useCallback(async () => {
    if (!installPrompt) return false;
    await installPrompt.prompt();
    const result = await installPrompt.userChoice;
    setInstallPrompt(null);
    return result.outcome === "accepted";
  }, [installPrompt]);

  return {
    canInstall: !!installPrompt,
    isInstalled,
    install,
    platform,
    isHttps:
      typeof window !== "undefined" &&
      (window.location.protocol === "https:" ||
        window.location.hostname === "localhost"),
  };
}
