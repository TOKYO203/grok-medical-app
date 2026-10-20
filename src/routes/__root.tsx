import { createRootRoute, HeadContent, Outlet, Scripts, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { AuthScreen } from "@/components/AuthScreen";
import { CloudSyncBridge } from "@/components/cloud-sync-bridge";
import { useAuth } from "@/hooks/useAuth";
import { resolveCloudGate } from "@/lib/cloud/gate";
import { AuthProvider } from "@/lib/auth/provider";
import { AppResumeBridge } from "@/components/app-resume-bridge";
import { ConnectivityStatus } from "@/components/connectivity-status";
import { DailyReminderBridge } from "@/components/daily-reminder-bridge";
import { ExperienceMilestoneBridge } from "@/components/experience-milestone-bridge";
import { ExperienceMotionBridge } from "@/components/experience-motion-bridge";
import { LicenseRevocationBridge } from "@/components/license-revocation-bridge";
import { OptimusSyncBridge } from "@/components/optimus-sync-bridge";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { applyDetectedLocale } from "@/i18n/detect";
import { useOptimus } from "@/state/store";
import { Toaster } from "sonner";
import { THEME_BOOT_SCRIPT } from "@/lib/theme";
import appCss from "../styles.css?url";

const APP_NAME = "Optimus";

function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (window.location.protocol !== "https:" && window.location.hostname !== "localhost") return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}

function LocaleDetectionBridge() {
  useEffect(() => {
    void applyDetectedLocale((locale) => useOptimus.getState().setLocale(locale));
  }, []);
  return null;
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      { name: "theme-color", content: "#EDE0C8" },
      { name: "application-name", content: "Optimus" },
      { name: "apple-mobile-web-app-title", content: "Optimus" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      {
        name: "description",
        content:
          "Optimus — coach de formation médicale. Apprendre. Raisonner. Progresser. Made in Madagascar.",
      },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
    ],
  }),
  component: RootDocument,
});

const selectPathname = (state: { location: { pathname: string } }) => state.location.pathname;

/**
 * Le document racine.
 *
 * ⚠️ `<Scripts />` DOIT rester un enfant DIRECT de `<body>` et ne doit JAMAIS
 * être placé dans une branche conditionnelle. C'est lui qui émet le script
 * d'entrée client : s'il manque dans le HTML rendu par le serveur, aucune
 * hydratation n'a lieu et l'application reste figée sur le rendu initial.
 *
 * C'est exactement le bug qui bloquait l'app sur « Chargement… » : `loading`
 * vaut `true` au rendu serveur, la branche « session » n'était donc jamais
 * prise, et `<Scripts />` vivait DANS cette branche → page morte.
 *
 * Corollaire : tout ce qui est un contrat de plateforme (pont de preview,
 * toaster, service worker) est monté ici, hors de toute condition de session.
 */
function RootDocument() {
  return (
    <html lang="fr" className="antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        <HeadContent />
      </head>
      <body>
        <PreviewHostBridge />
        <LocaleDetectionBridge />
        <AppResumeBridge />
        <CloudSyncBridge />
        <CloudGate />
        <ConnectivityStatus />
        <ServiceWorkerRegistrar />
        <DailyReminderBridge />
        <Toaster
          theme="system"
          position="top-center"
          toastOptions={{
            style: {
              background: "var(--app-card)",
              color: "var(--app-fg)",
              border: "1px solid var(--app-border)",
            },
          }}
        />
        <Scripts />
      </body>
    </html>
  );
}

/**
 * Décide entre écran de connexion, chargement borné et application.
 *
 * La décision est calculée par `resolveCloudGate` (module pur) à partir de
 * valeurs identiques côté serveur et côté client, ce qui évite tout mismatch
 * d'hydratation. Sans variables Supabase, le gate est transparent : le produit
 * reste utilisable localement (aucun verrou ajouté par une config manquante).
 */
function CloudGate() {
  const pathname = useRouterState({ select: selectPathname });
  const { status, configured } = useAuth();
  const mode = resolveCloudGate({ configured, status, pathname });

  if (mode === "splash") return <CloudSplash />;
  if (mode === "locked") return <AuthScreen />;
  return <AppShell />;
}

function AppShell() {
  const { status } = useAuth();
  // Un seul « cloud de référence » à la fois : dès qu'une session Supabase est
  // active, on n'empile pas par-dessus la synchronisation Better Auth (deux
  // sources de vérité qui pourraient s'écraser mutuellement).
  const legacyCloudSync = status !== "authenticated";

  return (
    <AuthProvider>
      <LicenseRevocationBridge />
      {legacyCloudSync ? <OptimusSyncBridge /> : null}
      <ExperienceMotionBridge />
      <ExperienceMilestoneBridge />
      <Outlet />
    </AuthProvider>
  );
}

/** Chargement borné à 2 s par `CLOUD_SESSION_TIMEOUT_MS` : jamais d'écran figé. */
function CloudSplash() {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg px-6 text-fg"
      role="status"
      aria-live="polite"
      data-cloud-gate="splash"
    >
      <span className="size-8 animate-spin rounded-full border-2 border-border-strong border-t-primary motion-reduce:animate-none" />
      <p className="text-sm text-muted">Connexion à Optimus…</p>
    </div>
  );
}
