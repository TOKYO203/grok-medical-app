interface SecurityHeaderEvent {
  url: URL;
}

const BASE_SECURITY_HEADERS: Readonly<Record<string, string>> = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
  "x-permitted-cross-domain-policies": "none",
};

function hardenResponse(response: Response, event: SecurityHeaderEvent): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(BASE_SECURITY_HEADERS)) {
    if (!headers.has(name)) headers.set(name, value);
  }

  // HSTS is meaningful only on HTTPS. Do not emit it for localhost/dev HTTP,
  // because browsers ignore it there and it would make local behavior confusing.
  if (event.url.protocol === "https:" && !headers.has("strict-transport-security")) {
    headers.set("strict-transport-security", "max-age=31536000");
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Baseline response hardening for all Nitro responses.
 *
 * Deliberately does not set X-Frame-Options/frame-ancestors yet: Optimus can be
 * rendered inside platform chrome, so framing policy needs a deployment-specific
 * decision. A strict CSP is likewise deferred until the current PWA/head injection
 * and OAuth origins have been inventoried, rather than shipping a policy that
 * silently breaks login or installed-app behavior.
 */
export default async function securityHeadersMiddleware(
  event: SecurityHeaderEvent,
  next: () => unknown | Promise<unknown>,
): Promise<unknown> {
  const result = await next();
  return result instanceof Response ? hardenResponse(result, event) : result;
}
