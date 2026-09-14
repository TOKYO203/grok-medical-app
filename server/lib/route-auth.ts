import { getRequestHeaders, type H3Event } from "h3";
import { auth, authConfigured } from "@/lib/auth/server";

export class ApiAuthError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = "ApiAuthError";
    this.statusCode = statusCode;
  }
}

export type ApiUser = {
  id: string;
  email: string | null;
};

function requestHeaders(event: H3Event): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(getRequestHeaders(event))) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(name, item);
    } else if (value != null) {
      headers.set(name, String(value));
    }
  }
  return headers;
}

/**
 * Resolve the Better Auth session for a Nitro/H3 API route.
 * Sensitive API routes fail closed when auth is not configured.
 */
export async function getApiUser(event: H3Event): Promise<ApiUser | null> {
  if (!authConfigured) return null;
  const session = await auth.api.getSession({ headers: requestHeaders(event) });
  if (!session?.user) return null;
  return {
    id: session.user.id,
    email: session.user.email ?? null,
  };
}

export async function requireApiUser(event: H3Event): Promise<ApiUser> {
  if (!authConfigured) {
    throw new ApiAuthError(503, "Authentication is not configured");
  }
  const user = await getApiUser(event);
  if (!user) throw new ApiAuthError(401, "Unauthorized");
  return user;
}

function configuredEditors(): Set<string> {
  const raw = process.env.CONTENT_EDITOR_USER_IDS?.trim();
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

/**
 * Editorial mutations are restricted to an explicit server-side allowlist.
 * An empty allowlist denies everyone rather than silently granting privileges.
 */
export async function requireContentEditor(event: H3Event): Promise<ApiUser> {
  const user = await requireApiUser(event);
  if (!configuredEditors().has(user.id)) {
    throw new ApiAuthError(403, "Forbidden");
  }
  return user;
}

export function apiAuthFailure(error: unknown): { statusCode: number; message: string } | null {
  if (!(error instanceof ApiAuthError)) return null;
  return { statusCode: error.statusCode, message: error.message };
}
