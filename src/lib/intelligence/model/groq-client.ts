/**
 * Client API unifié pour OpenRouter (avec fallback sur Groq).
 * OpenRouter est compatible avec le format OpenAI.
 */

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "inclusionai/ling-3.0-flash-sante:free";

export type AIRequest = {
  prompt: string;
  systemPrompt?: string;
  model?: string;
  temperature?: number;
  signal?: AbortSignal;
};

function readKey(provider: "openrouter" | "groq"): string {
  const envKey = provider === "openrouter" ? "VITE_OPENROUTER_API_KEY" : "VITE_GROQ_API_KEY";
  const key = (import.meta as any).env?.[envKey];
  if (!key || !key.trim()) {
    throw new Error(`Clé API manquante — remplis ${envKey} dans .env.local`);
  }
  return key.trim();
}

async function* streamFromUrl(url: string, apiKey: string, body: any, signal?: AbortSignal) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://grok-medical.app",
      "X-Title": "Grok Medical",
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`${res.status} — ${detail.slice(0, 200)}`);
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
        // ignore
      }
    }
  }
}

export async function* streamAI(req: AIRequest): AsyncGenerator<string> {
  const useOpenRouter = Boolean((import.meta as any).env?.VITE_OPENROUTER_API_KEY?.trim?.());

  const body = {
    model: req.model ?? (useOpenRouter ? DEFAULT_MODEL : "openai/gpt-oss-120b"),
    messages: [
      ...(req.systemPrompt ? [{ role: "system", content: req.systemPrompt }] : []),
      { role: "user", content: req.prompt },
    ],
    temperature: req.temperature ?? 0.3,
    stream: true,
  };

  if (useOpenRouter) {
    yield* streamFromUrl(OPENROUTER_URL, readKey("openrouter"), body, req.signal);
  } else {
    yield* streamFromUrl(GROQ_URL, readKey("groq"), body, req.signal);
  }
}

export const DEFAULT_AI_MODEL = DEFAULT_MODEL;
