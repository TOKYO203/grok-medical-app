/**
 * Server-only AI proxy.
 * Utilise les clés d'env côté serveur (jamais exposées au client).
 */

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const DEFAULT_OPENROUTER_MODEL = "inclusionai/ling-3.0-flash-sante:free";
const DEFAULT_GROQ_MODEL = "qwen/qwen3.6-27b";

// ── Cache simple en mémoire ──
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX = 100;
const cache = new Map<string, { text: string; at: number }>();

export function cacheKey(input: { prompt: string; systemPrompt?: string; model?: string }) {
  return JSON.stringify([input.systemPrompt ?? "", input.prompt, input.model ?? ""]);
}

export function cacheGet(key: string): string | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.at > CACHE_TTL_MS) { cache.delete(key); return null; }
  return entry.text;
}

export function cachePut(key: string, text: string) {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { text, at: Date.now() });
}

// ── Providers ──
export type AIRequest = {
  prompt: string;
  systemPrompt?: string;
  model?: string;
  temperature?: number;
};

type Provider = "openrouter" | "groq";

function pickProvider(): { provider: Provider; url: string; key: string; model: string } {
  const orKey = process.env.OPENROUTER_API_KEY?.trim();
  const groqKey = process.env.GROQ_API_KEY?.trim();
  if (orKey) {
    return {
      provider: "openrouter",
      url: OPENROUTER_URL,
      key: orKey,
      model: process.env.OPENROUTER_MODEL?.trim() || DEFAULT_OPENROUTER_MODEL,
    };
  }
  if (groqKey) {
    return {
      provider: "groq",
      url: GROQ_URL,
      key: groqKey,
      model: DEFAULT_GROQ_MODEL,
    };
  }
  throw new Error("Aucune clé IA configurée (OPENROUTER_API_KEY ou GROQ_API_KEY)");
}

async function fetchWithRetry(url: string, init: RequestInit, maxAttempts = 3): Promise<Response> {
  let lastErr: unknown;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(url, init);
      if (res.status === 429 && i < maxAttempts - 1) {
        const wait = 800 * (i + 1);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      return res;
    } catch (e) {
      lastErr = e;
      if (i < maxAttempts - 1) await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw lastErr ?? new Error("fetch failed after retries");
}

export async function* streamAI(req: AIRequest): AsyncGenerator<string> {
  const { url, key, model, provider } = pickProvider();

  const body = {
    model: req.model ?? model,
    messages: [
      ...(req.systemPrompt ? [{ role: "system", content: req.systemPrompt }] : []),
      { role: "user", content: req.prompt },
    ],
    temperature: req.temperature ?? 0.3,
    stream: true,
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`,
  };
  if (provider === "openrouter") {
    headers["HTTP-Referer"] = "https://grok-medical.app";
    headers["X-Title"] = "Grok Medical";
  }

  const res = await fetchWithRetry(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`${provider} ${res.status} — ${detail.slice(0, 200)}`);
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
        /* ignore partial */
      }
    }
  }
}
