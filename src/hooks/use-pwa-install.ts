import { useCallback, useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
  }>;
}

export function usePwaInstall() {
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const checkInstalled = () => {
      const installed =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone === true;

      setIsInstalled(installed);
    };

    checkInstalled();

    const mediaQuery = window.matchMedia(
      "(display-mode: standalone)"
    );

    mediaQuery.addEventListener(
      "change",
      checkInstalled
    );

    const handler = (event: Event) => {
      event.preventDefault();

      setInstallPrompt(
        event as BeforeInstallPromptEvent
      );
    };

    window.addEventListener(
      "beforeinstallprompt",
      handler
    );

    const installedHandler = () => {
      setInstallPrompt(null);
      setIsInstalled(true);
    };

    window.addEventListener(
      "appinstalled",
      installedHandler
    );

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handler
      );

      window.removeEventListener(
        "appinstalled",
        installedHandler
      );

      mediaQuery.removeEventListener(
        "change",
        checkInstalled
      );
    };
  }, []);

  const install = useCallback(async () => {
    if (!installPrompt) {
      return false;
    }

    await installPrompt.prompt();

    const result =
      await installPrompt.userChoice;

    setInstallPrompt(null);

    return result.outcome === "accepted";
  }, [installPrompt]);

  return {
    canInstall: !!installPrompt,
    isInstalled,
    install,
  };
}
