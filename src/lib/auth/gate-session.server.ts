import type { BetterAuthPlugin } from "better-auth";
import { createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { parseSetCookieHeader } from "better-auth/cookies";
import { handleOAuthUserInfo } from "better-auth/oauth2";
import {
  GATE_IDENTITY_HEADER,
  gateIdentityEnabled,
  gateIdentityFromHeaders,
  sessionBoundToGateIdentity,
} from "./gate-identity.server";

export const GATE_PROVIDER_ID = "grok-gate";
const GATE_ACCOUNT_ISSUER = "https://grok.com";
const LOG = "[gate-identity]";

type GateAccount = Parameters<typeof handleOAuthUserInfo>[1]["account"];
type GateMiddlewareContext = Parameters<Parameters<typeof createAuthMiddleware>[0]>[0];

/**
 * Emit the signed Better Auth session cookie.
 *
 * This deliberately uses Better Auth's own cookie API. The Gate bootstrap is a
 * Better Auth HTTP middleware, so framework-specific TanStack cookie helpers are
 * neither required nor safe when Nitro owns the request runtime.
 */
async function emitSessionCookie(
  ctx: GateMiddlewareContext,
  sessionTokenName: string,
  sessionToken: string,
): Promise<boolean> {
  const attributes = ctx.context.authCookies.sessionToken.attributes;
  const maxAge = ctx.context.sessionConfig.expiresIn;

  try {
    const signedCookie = await ctx.setSignedCookie(
      sessionTokenName,
      sessionToken,
      ctx.context.secret,
      {
        ...attributes,
        maxAge,
      },
    );
    const sessionValue = parseSetCookieHeader(signedCookie).get(
      sessionTokenName,
    )?.value;
    if (!sessionValue) {
      console.error(`${LOG} signed Set-Cookie missing session token value`, {
        cookiePreview: signedCookie.slice(0, 120),
      });
      return false;
    }
    return true;
  } catch (err) {
    console.error(`${LOG} setSignedCookie failed`, err);
    return false;
  }
}

/** Expire the previous user's cached session payload after an identity swap. */
function expireSessionDataCookie(
  ctx: GateMiddlewareContext,
  cookie: { name: string; attributes: { path?: string; secure?: boolean } },
): void {
  const path = cookie.attributes.path ?? "/";
  const secure = cookie.attributes.secure ?? true;
  ctx.setCookie(cookie.name, "", {
    path,
    httpOnly: true,
    secure,
    sameSite: "lax",
    maxAge: 0,
  });
}

export function gateIdentitySessions() {
  return {
    id: "grok-gate-identity",

    // Middleware is intentionally used instead of a before hook. Better Auth
    // middlewares run for real API requests from a client but not when a Nitro
    // route calls auth.api.getSession() directly. That keeps session creation a
    // browser-facing action and prevents server-side authorization checks from
    // minting sessions that cannot be returned to the client.
    middlewares: [
      {
        path: "/get-session",
        middleware: createAuthMiddleware(async (ctx) => {
          if (!gateIdentityEnabled()) return;
          const inbound = ctx.request?.headers ?? ctx.headers;
          if (!inbound) {
            console.error(`${LOG} no request headers on /get-session`);
            return;
          }
          // Bearer auth (live-preview popup) already carries a session — leave it alone.
          if (inbound.get("authorization")) return;
          if (!inbound.get(GATE_IDENTITY_HEADER)) return;

          const identity = await gateIdentityFromHeaders(inbound);
          if (!identity) {
            console.error(
              `${LOG} ${GATE_IDENTITY_HEADER} present but verification failed`,
            );
            return;
          }

          const sessionCookieName = ctx.context.authCookies.sessionToken.name;
          const cookieHeader = inbound.get("cookie") ?? "";
          if (cookieHeader.includes(`${sessionCookieName}=`)) {
            const existing = await getSessionFromCtx(ctx).catch((err) => {
              console.error(`${LOG} getSessionFromCtx failed`, err);
              return null;
            });
            if (existing?.session && existing.user) {
              const accounts = await ctx.context.internalAdapter
                .findAccounts(existing.user.id)
                .catch((err) => {
                  console.error(`${LOG} findAccounts failed`, err);
                  return null;
                });
              if (!accounts) {
                console.error(
                  `${LOG} could not load accounts for existing session user`,
                  { userId: existing.user.id },
                );
                return;
              }
              if (
                sessionBoundToGateIdentity(
                  accounts,
                  identity.sub,
                  GATE_PROVIDER_ID,
                )
              ) {
                // Already signed in as this gate identity — let the normal
                // get-session endpoint return its canonical session payload.
                return;
              }
              await ctx.context.internalAdapter
                .deleteSession(existing.session.token)
                .catch((err) => {
                  console.error(
                    `${LOG} deleteSession (stale non-gate session) failed`,
                    err,
                  );
                  return null;
                });
            }
          }

          try {
            const result = await handleOAuthUserInfo(ctx, {
              userInfo: {
                id: identity.sub,
                email: (
                  identity.email ?? `${identity.sub}@viewer.grok.invalid`
                ).toLowerCase(),
                emailVerified: Boolean(identity.email),
                name: identity.name ?? "Grok user",
              },
              account: {
                providerId: GATE_PROVIDER_ID,
                issuer: GATE_ACCOUNT_ISSUER,
                accountId: identity.sub,
              } as GateAccount,
            });
            if (result.error || !result.data) {
              console.error(`${LOG} handleOAuthUserInfo failed`, {
                error: result.error,
                hasData: Boolean(result.data),
                sub: identity.sub,
              });
              return;
            }

            // handleOAuthUserInfo persists the user/account/session. Emit the
            // session token through Better Auth's HTTP response cookie channel.
            const cookieEmitted = await emitSessionCookie(
              ctx,
              sessionCookieName,
              result.data.session.token,
            );
            if (!cookieEmitted) {
              console.error(
                `${LOG} session created in DB but cookie was not emitted`,
                { userId: result.data.user.id },
              );
              return;
            }

            // A stale session_data cache may still describe the previous user.
            expireSessionDataCookie(ctx, ctx.context.authCookies.sessionData);

            // This is the first browser-facing /get-session request for this Gate
            // identity. Returning the freshly persisted session here avoids a
            // transient signed-out render and lets Better Auth include all cookie
            // headers already accumulated by ctx.setSignedCookie / ctx.setCookie.
            return ctx.json({
              session: result.data.session,
              user: result.data.user,
            });
          } catch (err) {
            console.error(`${LOG} gate identity session middleware threw`, err);
            return;
          }
        }),
      },
    ],
  } satisfies BetterAuthPlugin;
}
