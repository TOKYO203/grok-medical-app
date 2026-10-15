import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { useEffect } from "react";
import { AuthProvider } from "@/lib/auth/provider";
import { AppResumeBridge } from "@/components/app-resume-bridge";
import { ConnectivityStatus } from "@/components/connectivity-status";
import { DailyReminderBridge } from "@/components/daily-reminder-bridge";
import { ExperienceMilestoneBridge } from "@/components/experience-milestone-bridge";
import { ExperienceMotionBridge } from "@/components/experience-motion-bridge";
import { LicenseRevocationBridge } from "@/components/license-revocation-bridge";
import { OptimusSyncBridge } from "@/components/optimus-sync-bridge";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { Toaster } from "sonner";
import { THEME_BOOT_SCRIPT } from "@/lib/theme";
import appCss from "../styles.css?url";

const APP_NAME = "Optimus";


function ServiceWorkerRegistrar(){useEffect(()=>{if(typeof window==="undefined")return;if(!("serviceWorker" in navigator))return;if(window.location.protocol!=="https:"&&window.location.hostname!=="localhost")return;navigator.serviceWorker.register("/sw.js").catch(()=>{})},[]);return null}

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
        content: "Optimus — coach de formation médicale. Apprendre. Raisonner. Progresser. Made in Madagascar.",
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

function RootDocument() {
  return (
    <html lang="fr" className="antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        <HeadContent />
      </head>
      <body>
        <PreviewHostBridge />
        <AppResumeBridge />
        <AuthProvider>
          <LicenseRevocationBridge />
          <OptimusSyncBridge />
          <ExperienceMotionBridge />
          <ExperienceMilestoneBridge />
          <Outlet />
        </AuthProvider>
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
