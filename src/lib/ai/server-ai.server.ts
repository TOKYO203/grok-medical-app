/** Server-only provider access. Models, output budgets and credentials stay here. */
import { readAIStream } from "./stream-protocol.ts";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_OPENROUTER_MODEL = "inclusionai/ling-3.0-flash-sante:free";
const DEFAULT_GROQ_MODEL = "qwen/qwen3.6-27b";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};
export type AIRequest = {
  messages: ChatMessage[];
  systemPrompt?: string;
  temperature?: number;
};

function pickProvider() {
  const openrouterKey = process.env.OPENROUTER_API_KEY?.trim();
  if (openrouterKey) {
    return {
      provider: "openrouter",
      url: OPENROUTER_URL,
      key: openrouterKey,
      model: process.env.OPENROUTER_MODEL?.trim() || DEFAULT_OPENROUTER_MODEL,
    };
  }
  const groqKey = process.env.GROQ_API_KEY?.trim();
  if (groqKey) {
    return {
      provider: "groq",
      url: GROQ_URL,
      key: groqKey,
      model: process.env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL,
    };
  }
  throw new Error("Le service IA est indisponible. Réessayez plus tard.");
}

export async function* streamAI(req: AIRequest, signal?: AbortSignal): AsyncGenerator<string> {
  const provider = pickProvider();
  const timeout = AbortSignal.timeout(45_000);
  const upstreamSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  upstreamSignal.throwIfAborted();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${provider.key}`,
  };
  if (provider.provider === "openrouter") {
    headers["HTTP-Referer"] = "https://grok-medical.app";
    headers["X-Title"] = "Grok Medical";
  }
  const response = await fetch(provider.url, {
    method: "POST",
    headers,
    signal: upstreamSignal,
    body: JSON.stringify({
      model: provider.model,
      messages: [
        ...(req.systemPrompt ? [{ role: "system", content: req.systemPrompt }] : []),
        ...req.messages,
      ],
      temperature: req.temperature ?? 0.3,
      max_tokens: 1024,
      stream: true,
    }),
  });
  if (!response.ok || !response.body) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error("Le service IA est indisponible. Réessayez plus tard.");
  }
  yield* readAIStream(response.body);
}
