import { getRequestIP, type H3Event } from "h3";

/**
 * Resolve the client IP without trusting proxy headers by default.
 * Enable TRUST_PROXY_HEADERS=true only when the deployment platform strips
 * client-supplied forwarding headers and injects its own trusted values.
 */
export function getClientIp(event: H3Event): string | null {
  const trustForwarded = process.env.TRUST_PROXY_HEADERS === "true";
  return getRequestIP(event, { xForwardedFor: trustForwarded }) ?? null;
}
