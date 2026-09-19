import { useEffect, useRef, useState } from "react";
import { Brain, ChevronDown, Info, Send, Sparkles, RefreshCw } from "lucide-react";
import { useClinicalAI, type ChatMessage } from "@/lib/ai/useClinicalAI";
import { readHistory, relativeTime, type AIHistoryEntry } from "@/lib/ai/ai-history";

export type CaseAIContext = {
  title: string;
  specialty: string;
  studyYear?: number;
  difficulty?: string;
  summary: string;
  patient?: { age?: number; sex?: string; context?: string };
  revealedSteps: Array<{ title: string; body: string }>;
  correct?: number;
  asked?: number;
};

const CASE_SYSTEM_PROMPT = `Tu es Optimus Clinical AI, assistant pédagogique pour étudiants en médecine.

Règles strictes :
- Réponds en français, structuré (300 mots max).
- Format pour la première analyse :
  🩺 **Hypothèses diagnostiques** (3 max, classées par probabilité)
  🔍 **Éléments manquants** (examens/antécédents à rechercher)
  ⚠️ **Pièges à éviter**
  📚 **Rappel clé**
- Pour les questions de suivi : réponds en 2-3 phrases concises.
- Pas de diagnostic définitif, pas de prescription posologique.
- Termine toujours par : "Aide à la décision — ne remplace pas le jugement clinique."`;

function buildCasePrompt(ctx: CaseAIContext): string {
  const revealed = ctx.revealedSteps
    .map((s, i) => `${i + 1}. [${s.title}] ${s.body}`)
    .join("\n");
  return `Cas clinique :
- Titre : ${ctx.title}
- Spécialité : ${ctx.specialty}${ctx.studyYear ? `\n- Année : ${ctx.studyYear}` : ""}${ctx.difficulty ? `\n- Difficulté : ${ctx.difficulty}` : ""}

Patient :
${ctx.patient?.age ? `- Âge : ${ctx.patient.age} ans\n` : ""}${ctx.patient?.sex ? `- Sexe : ${ctx.patient.sex}\n` : ""}${ctx.patient?.context ? `- Contexte : ${ctx.patient.context}` : "- (contexte non renseigné)"}

Résumé : ${ctx.summary}

Éléments révélés :
${revealed || "(aucun)"}

Analyse ce cas : hypothèses diagnostiques hiérarchisées, examens complémentaires, pièges.`;
}

export function OptimusAnalysisPanel({ context }: { context: CaseAIContext }) {
  const [open, setOpen] = useState(false);
  const [historyEntries, setHistoryEntries] = useState<AIHistoryEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [followUp, setFollowUp] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const ai = useClinicalAI();

  const caseId = context.title;
  const canAnalyze = context.revealedSteps.length > 0;
  const hasConversation = ai.messages.length > 0;

  useEffect(() => {
    setHistoryEntries(readHistory(caseId));
  }, [caseId, ai.status]);

  useEffect(() => {
    if (ai.status === "streaming" || ai.status === "done") {
      endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [ai.messages, ai.status]);

  const startAnalysis = () => {
    void ai.run(buildCasePrompt(context), CASE_SYSTEM_PROMPT, caseId);
  };

  const submitFollowUp = () => {
    const text = followUp.trim();
    if (!text || ai.status === "streaming") return;
    setFollowUp("");
    void ai.sendFollowUp(text, CASE_SYSTEM_PROMPT, caseId);
  };

  return (
    <section className="w-full rounded-xl border bg-card shadow-[var(--shadow-border)]" aria-label="Analyse Optimus">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 p-5 text-left"
      >
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-full bg-primary-soft text-primary">
            <Brain className="size-4" />
          </span>
          <div>
            <h2 className="font-display text-lg font-medium">Analyse Optimus</h2>
            <p className="text-xs text-muted">
              {open
                ? canAnalyze
                  ? hasConversation
                    ? `${ai.messages.length} messages · ${ai.status === "streaming" ? "en cours…" : "prêt"}`
                    : "Prêt à analyser ce cas"
                  : "Révèle au moins un élément pour commencer"
                : "Aide à la décision clinique"}
            </p>
          </div>
        </div>
        <ChevronDown className={`size-5 text-muted transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>

      {open && (
        <div className="space-y-4 border-t border-border p-5">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={startAnalysis}
              disabled={ai.status === "streaming" || !canAnalyze}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-fg transition-opacity disabled:opacity-40"
            >
              <Sparkles className="size-4" aria-hidden />
              {ai.status === "streaming" && !hasConversation
                ? "Analyse en cours…"
                : hasConversation
                  ? "Relancer l'analyse"
                  : "Analyser ce cas"}
            </button>
            {hasConversation && ai.status !== "streaming" && (
              <button
                type="button"
                onClick={ai.reset}
                className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm text-muted hover:text-foreground"
              >
                <RefreshCw className="size-3.5" aria-hidden />
                Réinitialiser
              </button>
            )}
          </div>

          {hasConversation && (
            <div className="space-y-3">
              {ai.messages.map((m, i) => (
                <MessageBubble
                  key={i}
                  message={m}
                  isInitialPrompt={i === 0 && m.role === "user"}
                  isStreaming={ai.status === "streaming" && i === ai.messages.length - 1}
                />
              ))}
              <div ref={endRef} />
            </div>
          )}

          {ai.status === "error" && (
            <div className="rounded-[var(--radius-md)] border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-500">
              ⚠️ {ai.error}
            </div>
          )}

          {hasConversation && ai.status !== "streaming" && (
            <div className="flex items-center gap-2">
              <input
                value={followUp}
                onChange={(e) => setFollowUp(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submitFollowUp();
                  }
                }}
                placeholder="Poser une question de suivi…"
                className="flex-1 rounded-full bg-secondary px-4 py-2 text-sm outline-none"
              />
              <button
                type="button"
                onClick={submitFollowUp}
                disabled={!followUp.trim()}
                aria-label="Envoyer"
                className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-fg disabled:opacity-40"
              >
                <Send className="size-4" />
              </button>
            </div>
          )}

          {historyEntries.length > 0 && (
            <div className="border-t border-border pt-4">
              <button
                type="button"
                onClick={() => setHistoryOpen((v) => !v)}
                className="flex w-full items-center justify-between gap-2 text-left"
              >
                <h3 className="text-sm font-medium">📜 Analyses précédentes ({historyEntries.length})</h3>
                <ChevronDown className={`size-4 text-muted transition-transform ${historyOpen ? "rotate-180" : ""}`} aria-hidden />
              </button>
              {historyOpen && (
                <div className="mt-3 space-y-2">
                  {historyEntries.map((entry) => (
                    <details key={entry.id} className="rounded-[var(--radius-md)] bg-secondary">
                      <summary className="cursor-pointer p-3 text-xs text-muted">
                        {relativeTime(entry.at)} · {entry.text.length} caractères
                      </summary>
                      <div className="border-t border-border p-3 text-xs leading-relaxed whitespace-pre-wrap">
                        {entry.text}
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex items-start gap-2 rounded-[var(--radius-md)] bg-secondary p-3 text-xs text-muted">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>Aide à la décision — ne remplace pas le jugement clinique. Vérifiez toujours les sources officielles.</p>
          </div>
        </div>
      )}
    </section>
  );
}


function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  lines.forEach((line, i) => {
    // Gras **...**
    const parts: React.ReactNode[] = [];
    let rest = line;
    let key = 0;
    while (rest.length > 0) {
      const m = rest.match(/\*\*(.+?)\*\*/);
      if (!m || m.index === undefined) {
        parts.push(<span key={`t${key++}`}>{rest}</span>);
        break;
      }
      if (m.index > 0) parts.push(<span key={`t${key++}`}>{rest.slice(0, m.index)}</span>);
      parts.push(<strong key={`b${key++}`}>{m[1]}</strong>);
      rest = rest.slice(m.index + m[0].length);
    }
    out.push(
      <span key={i}>
        {parts}
        {i < lines.length - 1 ? "\n" : ""}
      </span>
    );
  });
  return out;
}

function MessageBubble({
  message,
  isStreaming,
  isInitialPrompt,
}: {
  message: ChatMessage;
  isStreaming: boolean;
  isInitialPrompt?: boolean;
}) {
  const isUser = message.role === "user";

  // Le 1er message user = prompt technique complet → on l'affiche en badge discret
  if (isInitialPrompt) {
    return (
      <div className="flex justify-end">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1.5 text-[11px] font-medium text-primary">
          📋 Contexte du cas envoyé à Optimus
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[90%] overflow-y-auto rounded-[var(--radius-md)] px-4 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? "bg-primary text-primary-fg"
            : "max-h-[420px] bg-secondary text-fg"
        }`}
      >
        {renderMarkdown(message.content)}
        {isStreaming && (
          <span className="ml-0.5 inline-block h-4 w-1 animate-pulse bg-primary align-middle" />
        )}
      </div>
    </div>
  );
}
