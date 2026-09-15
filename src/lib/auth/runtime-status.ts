import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { GROK_PROVIDERS } from "./providers";

export type AuthRuntimeStatus = {
  enabled: boolean;
  ready: boolean;
  mode:
    | "disabled"
    | "configured"
    | "sandbox-preview"
    | "missing-public-origin"
    | "missing-deployment-config";
  providers: readonly { providerId: string; label: string }[];
  message: string | null;
};

const env = (key: string): string | undefined => {
  const value = process.env[key]?.trim();
  return value ? value : undefined;
};

function requestHostname(): string | null {
  const request = getRequest();
  if (!request) return null;
  try {
    return new URL(request.url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Public, non-sensitive readiness probe used by the login screen.
 * It never returns client ids, secrets, database details or provider credentials.
 */
export const getAuthRuntimeStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<AuthRuntimeStatus> => {
    const enabled = env("VITE_AUTH_ENABLED") !== "false";
    if (!enabled) {
      return {
        enabled: false,
        ready: false,
        mode: "disabled",
        providers: [],
        message: "La connexion cloud est désactivée sur cet environnement.",
      };
    }

    const hostname = requestHostname();
    if (hostname?.endsWith(".grok-sandbox.com")) {
      return {
        enabled: true,
        ready: true,
        mode: "sandbox-preview",
        providers: GROK_PROVIDERS.map(({ providerId, label }) => ({ providerId, label })),
        message: null,
      };
    }

    const hasInjectedBrokerClient = Boolean(
      env("GROK_AUTH_CLIENT_ID") && env("GROK_AUTH_CLIENT_SECRET"),
    );
    const hasPublicOrigin = Boolean(
      env("BETTER_AUTH_URL") ||
        env("VERCEL_BRANCH_URL") ||
        env("VERCEL_URL") ||
        env("VERCEL_PROJECT_PRODUCTION_URL"),
    );

    if (hasInjectedBrokerClient && hasPublicOrigin) {
      return {
        enabled: true,
        ready: true,
        mode: "configured",
        providers: GROK_PROVIDERS.map(({ providerId, label }) => ({ providerId, label })),
        message: null,
      };
    }

    if (hasInjectedBrokerClient && !hasPublicOrigin) {
      return {
        enabled: true,
        ready: false,
        mode: "missing-public-origin",
        providers: [],
        message:
          "Le compte cloud est presque prêt, mais l'URL publique de connexion n'est pas configurée sur ce déploiement.",
      };
    }

    return {
      enabled: true,
      ready: false,
      mode: "missing-deployment-config",
      providers: [],
      message:
        "La connexion cloud n'est pas encore configurée sur cette version de test. Vous pouvez continuer à utiliser Optimus localement.",
    };
  },
);
