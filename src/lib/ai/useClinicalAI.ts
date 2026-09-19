import { useCallback, useEffect, useRef, useState } from "react";
import { pushHistory } from "@/lib/ai/ai-history";

export type ClinicalAIStatus = "idle" | "streaming" | "done" | "error";

export type ClinicalAIState = {
  status: ClinicalAIStatus;
  text: string;
  error?: string;
  cached?: boolean;
};

const SYSTEM_PROMPT = `Tu es Optimus Clinical AI, assistant pédagogique pour étudiants en médecine.

Règles strictes :
- Réponds en français, concis (150 mots max).
- Structure : 3 points numérotés, actionnables.
- Jamais de diagnostic définitif ni de prescription.
- Si le contexte est insuffisant, demande la donnée manquante.
- Termine toujours par : "Aide à la décision — ne remplace pas le jugement clinique."`;

const SS_KEY = "optimus.ai.cache.v1";

function readSessionCache(prompt: string): string | null {
  try {
    const raw = sessionStorage.getItem(SS_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, { text: string; at: number }>;
    const hit = map[prompt];
    if (!hit) return null;
    if (Date.now() - hit.at > 5 * 60 * 1000) return null;
    return hit.text;
  } catch {
    return null;
  }
}

function writeSessionCache(prompt: string, text: string) {
  try {
    const raw = sessionStorage.getItem(SS_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, any>) : {};
    map[prompt] = { text, at: Date.now() };
    sessionStorage.setItem(SS_KEY, JSON.stringify(map));
  } catch {
    /* quota / private mode → ignore */
  }
}

export function useClinicalAI() {
  const [state, setState] = useState<ClinicalAIState>({ status: "idle", text: "" });
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const run = useCallback(async (prompt: string, systemPromptOverride?: string, caseId?: string) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    // 1) Session cache → réponse instantanée
    const fromCache = readSessionCache(prompt);
    if (fromCache) {
      setState({ status: "done", text: fromCache, cached: true });
      return;
    }

    setState({ status: "streaming", text: "" });

    try {
      const res = await fetch("/api/ai-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, systemPrompt: systemPromptOverride ?? SYSTEM_PROMPT }),
        signal: ctrl.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let acc = "";

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
          if (payload === "[DONE]") continue;
          try {
            const json = JSON.parse(payload);
            if (json.error) throw new Error(String(json.error));
            const delta = json?.choices?.[0]?.delta?.content;
            if (delta) {
              acc += delta;
              setState({ status: "streaming", text: acc });
            }
          } catch (e) {
            if (e instanceof Error && /^\w+\s\d{3}/.test(e.message)) throw e;
          }
        }
      }

      writeSessionCache(prompt, acc);
      if (caseId) pushHistory(caseId, acc);
      setState({ status: "done", text: acc });
    } catch (e: unknown) {
      if (ctrl.signal.aborted) return;
      const msg = e instanceof Error ? e.message : String(e);
      setState({ status: "error", text: "", error: msg });
    }
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState({ status: "idle", text: "" });
  }, []);

  return { ...state, run, reset };
}
