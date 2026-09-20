import { getBearerToken } from "@/lib/auth/client";
import { readAIStream } from "./stream-protocol";
import type { AIStreamBody } from "./schemas";

/** Browser callers use the authenticated proxy; provider secrets stay server-side. */
export async function* streamClinicalAI(input: AIStreamBody & { signal?: AbortSignal }) {
  const { signal, ...body } = input;
  const token = getBearerToken();
  const response = await fetch("/api/ai-stream", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(
      typeof data?.error === "string" ? data.error : "Le service IA est indisponible.",
    );
  }
  if (!response.body) throw new Error("Réponse IA absente. Réessayez.");
  yield* readAIStream(response.body);
}
