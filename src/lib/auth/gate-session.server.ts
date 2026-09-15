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
 * Emit the signed Better Auth session cookie on the current HTTP response.
 * Better Auth's hook dispatcher preserves headers set through the context, so
 * no framework-specific TanStack cookie helper is required here.
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
      console.error(`${LOG} signed Set-Cookie missing session token value`);
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
    hooks: {
      before: [
        {
          // Better Auth runs before hooks for both HTTP router traffic and direct
          // auth.api.* calls. Direct calls have no Request object; requiring one
          // keeps Gate session minting strictly browser-facing while preserving
          // server-side auth.api.getSession() as a read-only authorization check.
          matcher: (ctx: { path?: string; request?: Request }) =>
            ctx.path === "/get-session" && Boolean(ctx.request),
          handler: createAuthMiddleware(async (ctx) => {
            if (!gateIdentityEnabled()) return;
            const inbound = ctx.request?.headers;
            if (!inbound) return;

            // Bearer auth already carries a session and must remain untouched.
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
                  // Existing session already belongs to this Gate identity. Let
                  // Better Auth's normal get-session handler return it.
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

              // Before hooks may short-circuit with a JSON response. Better Auth
              // serializes the response together with all cookies accumulated on
              // the hook context, so the first get-session round-trip is complete.
              return ctx.json({
                session: result.data.session,
                user: result.data.user,
              });
            } catch (err) {
              console.error(`${LOG} gate identity session hook threw`, err);
              return;
            }
          }),
        },
      ],
    },
  } satisfies BetterAuthPlugin;
}
