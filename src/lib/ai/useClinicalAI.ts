import { useCallback, useEffect, useRef, useState } from "react";
import { pushHistory } from "@/lib/ai/ai-history";
import { streamClinicalAI } from "./client-stream";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ClinicalAIStatus = "idle" | "streaming" | "done" | "error";

export type ClinicalAIState = {
  status: ClinicalAIStatus;
  messages: ChatMessage[];
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
  const [state, setState] = useState<ClinicalAIState>({ status: "idle", messages: [] });
  const abortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);

  useEffect(() => {
    messagesRef.current = state.messages;
  }, [state.messages]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const streamConversation = useCallback(
    async (messages: ChatMessage[], systemPrompt?: string, caseId?: string) => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      const baseMessages = messages;
      messagesRef.current = messages;
      setState({ status: "streaming", messages: baseMessages });

      try {
        let acc = "";
        for await (const delta of streamClinicalAI({
          messages: baseMessages,
          systemPrompt: systemPrompt ?? SYSTEM_PROMPT,
          signal: ctrl.signal,
        })) {
          if (ctrl.signal.aborted || abortRef.current !== ctrl) return;
          acc += delta;
          setState({
            status: "streaming",
            messages: [...baseMessages, { role: "assistant", content: acc }],
          });
        }
        if (ctrl.signal.aborted || abortRef.current !== ctrl) return;
        if (!acc.trim()) throw new Error("Réponse IA vide. Réessayez.");

        const finalMessages: ChatMessage[] = [...baseMessages, { role: "assistant", content: acc }];

        // Historique : uniquement la 1ère analyse (pas les follow-ups)
        if (caseId && acc && baseMessages.length === 1) {
          pushHistory(caseId, acc);
        }

        setState({ status: "done", messages: finalMessages });
      } catch (e: unknown) {
        if (ctrl.signal.aborted || abortRef.current !== ctrl) return;
        const msg = e instanceof Error ? e.message : String(e);
        setState({ status: "error", messages: baseMessages, error: msg });
      }
    },
    [],
  );

  const run = useCallback(
    (prompt: string, systemPrompt?: string, caseId?: string) =>
      streamConversation([{ role: "user", content: prompt }], systemPrompt, caseId),
    [streamConversation],
  );

  const sendFollowUp = useCallback(
    (text: string, systemPrompt?: string, caseId?: string) =>
      streamConversation(
        [...messagesRef.current, { role: "user", content: text }],
        systemPrompt,
        caseId,
      ),
    [streamConversation],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    messagesRef.current = [];
    setState({ status: "idle", messages: [] });
  }, []);

  return { ...state, run, sendFollowUp, reset };
}
