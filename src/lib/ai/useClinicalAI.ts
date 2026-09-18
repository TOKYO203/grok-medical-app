import { useCallback, useRef, useState } from "react";
import { streamGroq } from "@/lib/intelligence/model/groq.client";

export type ClinicalAIStatus = "idle" | "streaming" | "done" | "error";

export type ClinicalAIState = {
  status: ClinicalAIStatus;
  text: string;
  error?: string;
};

const SYSTEM_PROMPT = `Tu es Optimus Clinical AI, assistant pédagogique pour étudiants en médecine.

Règles strictes :
- Réponds en français, concis (150 mots max).
- Structure : 3 points numérotés, actionnables.
- Jamais de diagnostic définitif ni de prescription.
- Si le contexte est insuffisant, demande la donnée manquante.
- Termine toujours par : "Aide à la décision — ne remplace pas le jugement clinique."`;

export function useClinicalAI() {
  const [state, setState] = useState<ClinicalAIState>({ status: "idle", text: "" });
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(async (prompt: string) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setState({ status: "streaming", text: "" });
    try {
      let acc = "";
      for await (const token of streamGroq({
        prompt,
        systemPrompt: SYSTEM_PROMPT,
        signal: ctrl.signal,
      })) {
        acc += token;
        setState({ status: "streaming", text: acc });
      }
      setState({ status: "done", text: acc });
    } catch (e: any) {
      if (ctrl.signal.aborted) return;
      setState({
        status: "error",
        text: "",
        error: String(e?.message ?? e ?? "Erreur inconnue"),
      });
    }
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState({ status: "idle", text: "" });
  }, []);

  return { ...state, run, reset };
}
