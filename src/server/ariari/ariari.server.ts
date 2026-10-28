/**
 * Client Ariari — SDK officiel @ariary/pay v2.2.0.
 * Server-only. Base URL par défaut : https://api.ariari.mg
 * Auth : factory statique Ariari.config({ secret }).
 */
import Ariari from "@ariary/pay";

type AriariEnv = Record<string, string | undefined>;

let _client: Ariari | null = null;

function ariariSecret(env: AriariEnv = process.env as AriariEnv): string | null {
  return env.ARIARI_SECRET?.trim() || null;
}

export function getAriari(): Ariari {
  if (_client) return _client;
  const secret = ariariSecret();
  if (!secret) throw new Error("ARIARI_SECRET absent");
  _client = Ariari.config({ secret });
  return _client;
}

export function isAriariConfigured(): boolean {
  return ariariSecret() !== null;
}

export function __resetAriariForTests(): void { _client = null; }

export type AriariPaymentStatus = "pending" | "incomplete" | "paid" | "failed";

export type AriariPaymentInfo = {
  id: string;
  amount: number;
  status: AriariPaymentStatus;
  url: string;
};

export async function createAriariPayment(input: {
  amount: number;
  name: string;
  hooks?: {
    redirectSuccess?: string;
    redirectFailure?: string;
    silentSuccess?: string;
    silentProgress?: string;
    silentFailure?: string;
  };
}): Promise<{ id: string; url: string; status: AriariPaymentStatus }> {
  const ariari = getAriari();
  const payment = await ariari.create({
    amount: input.amount,
    name: input.name,
    hooks: input.hooks,
  });
  const url = payment.url;
  if (!url) throw new Error("Ariari n'a pas retourné d'URL de paiement");
  return {
    id: payment.id,
    url,
    status: "pending",
  };
}

export async function fetchAriariPayment(paymentId: string): Promise<AriariPaymentInfo> {
  const ariari = getAriari();
  const payment = ariari.getPayment(paymentId);
  const data = await payment.status();
  const total = data.parts.reduce(
    (s, p) => s + ((p as { amount?: number }).amount ?? 0),
    0,
  );
  return {
    id: data.id,
    amount: total,
    status: data.status as AriariPaymentStatus,
    url: data.url,
  };
}
