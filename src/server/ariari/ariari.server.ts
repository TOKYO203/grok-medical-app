/**
 * Client Ariari (Mobile Money Madagascar) — server-only.
 *
 * ⚠️ NE JAMAIS importer depuis du code client : le secret fuiterait.
 *
 * Implémentation fetch direct (pas de SDK tiers) :
 *   - Contrôle total sur les payloads
 *   - Compatible Cloudflare Workers (Web fetch natif)
 *   - Facile à ajuster quand la doc API évolue
 *
 * ⚠️ L'endpoint et le format sont basés sur les conventions REST standards.
 *    À vérifier avec la doc officielle Ariari (https://ariari.mg/docs).
 */
type AriariEnv = Record<string, string | undefined>;

const ARIARI_API_BASE =
  (process.env.ARIARI_API_URL ?? "https://api.ariari.mg").replace(/\/$/, "");

function ariariSecret(env: AriariEnv = process.env as AriariEnv): string | null {
  const secret = env.ARIARI_SECRET?.trim();
  return secret || null;
}

export function isAriariConfigured(): boolean {
  return ariariSecret() !== null;
}

export type AriariPaymentStatus = "PENDING" | "INCOMPLETE" | "PAID" | "FAILED";

export type AriariPaymentInfo = {
  id: string;
  amount: number;
  rest: number;
  status: AriariPaymentStatus;
  url: string;
  name?: string;
  createdAt: string;
};

export type CreateAriariPaymentInput = {
  amount: number;
  name: string;
  hooks?: {
    redirectSuccess?: string;
    redirectFailure?: string;
    silentSuccess?: string;
    silentProgress?: string;
    silentFailure?: string;
  };
};

export type CreateAriariPaymentResult = { id: string; url: string };

function authHeaders(secret: string): HeadersInit {
  return {
    Authorization: `Bearer ${secret}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

export async function createAriariPayment(
  input: CreateAriariPaymentInput,
  env: AriariEnv = process.env as AriariEnv,
): Promise<CreateAriariPaymentResult> {
  const secret = ariariSecret(env);
  if (!secret) throw new Error("ARIARI_SECRET absent");

  const response = await fetch(`${ARIARI_API_BASE}/v1/payments`, {
    method: "POST",
    headers: authHeaders(secret),
    body: JSON.stringify({
      amount: input.amount,
      name: input.name,
      hooks: input.hooks,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Ariari create failed: ${response.status} ${text}`);
  }

  const data = (await response.json()) as { id: string; url: string };
  return { id: data.id, url: data.url };
}

export async function fetchAriariPayment(
  paymentId: string,
  env: AriariEnv = process.env as AriariEnv,
): Promise<AriariPaymentInfo> {
  const secret = ariariSecret(env);
  if (!secret) throw new Error("ARIARI_SECRET absent");

  const response = await fetch(`${ARIARI_API_BASE}/v1/payments/${paymentId}`, {
    method: "GET",
    headers: authHeaders(secret),
  });

  if (!response.ok) {
    throw new Error(`Ariari fetch failed: ${response.status}`);
  }

  return (await response.json()) as AriariPaymentInfo;
}
