import { isIP } from "node:net";
import { getRequestHeader, getRequestIP, type H3Event } from "h3";

function singleIpHeader(event: H3Event, name: string): string | null {
  const value = getRequestHeader(event, name)?.trim();
  if (!value || value.includes(",") || isIP(value) === 0) return null;
  return value;
}

/**
 * Resolve the client IP without trusting generic proxy headers by default.
 *
 * Vercel and Netlify expose platform-owned single-client-IP headers, so those
 * are preferred only when their own deployment environment marker is present.
 * A generic `x-forwarded-for` chain remains opt-in via TRUST_PROXY_HEADERS=true
 * for operators that control a proxy which strips client-supplied forwarding
 * headers before adding its own trusted value.
 */
export function getClientIp(event: H3Event): string | null {
  if (process.env.VERCEL === "1") {
    return (
      singleIpHeader(event, "x-vercel-forwarded-for") ??
      getRequestIP(event, { xForwardedFor: false }) ??
      null
    );
  }

  if (process.env.NETLIFY === "true") {
    return (
      singleIpHeader(event, "x-nf-client-connection-ip") ??
      getRequestIP(event, { xForwardedFor: false }) ??
      null
    );
  }

  const trustForwarded = process.env.TRUST_PROXY_HEADERS === "true";
  return getRequestIP(event, { xForwardedFor: trustForwarded }) ?? null;
}
