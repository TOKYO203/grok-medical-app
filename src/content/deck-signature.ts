function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const record = value as Record<string, unknown>;
  const entries = Object.keys(record)
    .sort()
    .filter((key) => record[key] !== undefined)
    .map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`);
  return `{${entries.join(",")}}`;
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function unsignedDeckPayload(deck: Record<string, unknown>): string {
  const { signature: _signature, ...unsigned } = deck;
  return canonicalize(unsigned);
}

export async function verifyDeckSignature(
  deck: Record<string, unknown>,
  signature: string,
  publicKey: string,
): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey("raw", fromBase64Url(publicKey), { name: "Ed25519" }, false, [
      "verify",
    ]);
    return await crypto.subtle.verify(
      { name: "Ed25519" },
      key,
      fromBase64Url(signature),
      new TextEncoder().encode(unsignedDeckPayload(deck)),
    );
  } catch {
    return false;
  }
}
