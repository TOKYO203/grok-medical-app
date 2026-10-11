/**
 * Server-only AI proxy — multi-turn.
 */

import { readAIStream } from "./stream-protocol";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const DEFAULT_OPENROUTER_MODEL = "inclusionai/ling-3.0-flash-sante:free";
const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AIRequest = {
  messages: ChatMessage[];
  systemPrompt?: string;
  temperature?: number;
};

// ── Cache ──
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX = 100;
const cache = new Map<string, { text: string; at: number }>();

export function cacheKey(input: AIRequest) {
  return JSON.stringify([input.systemPrompt ?? "", input.messages]);
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
    return { provider: "groq", url: GROQ_URL, key: groqKey, model: DEFAULT_GROQ_MODEL };
  }
  // Config diagnostics stay in the server log: the thrown message is streamed
  // back to an unauthenticated caller by /api/ai-stream.
  console.error("[ai] aucune clé IA configurée (OPENROUTER_API_KEY / GROQ_API_KEY)");
  throw new Error("Le service d'IA n'est pas configuré.");
}

async function fetchWithRetry(url: string, init: RequestInit, maxAttempts = 3): Promise<Response> {
  let lastErr: unknown;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(url, init);
      if (res.status === 429 && i < maxAttempts - 1) {
        await new Promise((r) => setTimeout(r, 800 * (i + 1)));
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

  const messages: ChatMessage[] = [
    ...(req.systemPrompt ? [{ role: "system" as const, content: req.systemPrompt }] : []),
    ...req.messages,
  ];

  const body = {
    // Always the server-selected model — never one supplied by the caller.
    model,
    messages,
    temperature: req.temperature ?? 0.3,
    stream: true,
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`,
  };
  if (provider === "openrouter") {
    headers["HTTP-Referer"] = "https://grok-medical-app.vercel.app";
    headers["X-Title"] = "Optimus - Formation medicale";
  }

  const res = await fetchWithRetry(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    // The provider's diagnostics (request ids, account hints, occasionally a
    // masked credential) are readable by an attacker through the SSE stream,
    // because /api/ai-stream is unauthenticated. Log them server-side and hand
    // the caller a stable, information-free message — the same doctrine as
    // `stream-protocol.ts`.
    const detail = await res.text().catch(() => "");
    console.error(`[ai] provider ${provider} error ${res.status}: ${detail.slice(0, 500)}`);
    throw new Error(
      res.status === 429
        ? "Le service d'IA est saturé. Réessayez dans un instant."
        : "Le service d'IA est temporairement indisponible.",
    );
  }
  if (!res.body) throw new Error("Le service d'IA est temporairement indisponible.");

  yield* readAIStream(res.body);
}
