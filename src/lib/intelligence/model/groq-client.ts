/**
 * Groq API client — OpenAI-compatible.
 * Doc : https://console.groq.com/docs/api-reference
 */

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-oss-120b";

export type GroqRequest = {
  prompt: string;
  systemPrompt?: string;
  model?: string;
  temperature?: number;
  signal?: AbortSignal;
};

function readKey(): string {
  const key = (import.meta as any).env?.VITE_GROQ_API_KEY as string | undefined;
  if (!key || !key.trim()) {
    throw new Error("Clé Groq manquante — remplis VITE_GROQ_API_KEY dans .env.local");
  }
  return key.trim();
}

function buildBody(req: GroqRequest, stream: boolean) {
  return {
    model: req.model ?? DEFAULT_MODEL,
    messages: [
      ...(req.systemPrompt ? [{ role: "system", content: req.systemPrompt }] : []),
      { role: "user", content: req.prompt },
    ],
    temperature: req.temperature ?? 0.3,
    stream,
  };
}

export async function generateGroq(req: GroqRequest): Promise<string> {
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${readKey()}`,
    },
    body: JSON.stringify(buildBody(req, false)),
    signal: req.signal,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Groq ${res.status} — ${detail.slice(0, 200)}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
}

export async function* streamGroq(req: GroqRequest): AsyncGenerator<string> {
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${readKey()}`,
    },
    body: JSON.stringify(buildBody(req, true)),
    signal: req.signal,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Groq ${res.status} — ${detail.slice(0, 200)}`);
  }
  if (!res.body) throw new Error("Pas de flux SSE dans la réponse");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const raw of lines) {
      const line = raw.trim();
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (payload === "[DONE]") return;
      try {
        const json = JSON.parse(payload);
        const delta = json?.choices?.[0]?.delta?.content;
        if (delta) yield delta as string;
      } catch {
        // chunk partiel, on ignore
      }
    }
  }
}

export const GROQ_DEFAULT_MODEL = DEFAULT_MODEL;
