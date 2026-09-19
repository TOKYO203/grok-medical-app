import { useState } from "react";
import { Brain, ChevronDown, Info, Sparkles, RefreshCw } from "lucide-react";
import { useClinicalAI } from "@/lib/ai/useClinicalAI";
import { readHistory, relativeTime, type AIHistoryEntry } from "@/lib/ai/ai-history";

export type CaseAIContext = {
  title: string;
  specialty: string;
  studyYear?: number;
  difficulty?: string;
  summary: string;
  patient?: {
    age?: number;
    sex?: string;
    context?: string;
  };
  revealedSteps: Array<{ title: string; body: string }>;
  correct?: number;
  asked?: number;
};

const CASE_SYSTEM_PROMPT = `Tu es Optimus Clinical AI, assistant pédagogique pour étudiants en médecine.

Règles strictes :
- Réponds en français, structuré (300 mots max).
- Format :
  🩺 **Hypothèses diagnostiques** (3 max, classées par probabilité)
  🔍 **Éléments manquants** (examens/antécédents à rechercher)
  ⚠️ **Pièges à éviter**
  📚 **Rappel clé**
- Pas de diagnostic définitif, pas de prescription posologique.
- Termine toujours par : "Aide à la décision — ne remplace pas le jugement clinique."`;

function buildCasePrompt(ctx: CaseAIContext): string {
  const revealed = ctx.revealedSteps
    .map((s, i) => `${i + 1}. [${s.title}] ${s.body}`)
    .join("\n");

  return `Cas clinique :
- Titre : ${ctx.title}
- Spécialité : ${ctx.specialty}${ctx.studyYear ? `\n- Année d'étude : ${ctx.studyYear}` : ""}${ctx.difficulty ? `\n- Difficulté : ${ctx.difficulty}` : ""}

Patient :
${ctx.patient?.age ? `- Âge : ${ctx.patient.age} ans\n` : ""}${ctx.patient?.sex ? `- Sexe : ${ctx.patient.sex}\n` : ""}${ctx.patient?.context ? `- Contexte : ${ctx.patient.context}` : "- (contexte non renseigné)"}

Résumé : ${ctx.summary}

Éléments révélés :
${revealed || "(aucun)"}
${ctx.asked ? `\nProgression : ${ctx.correct ?? 0}/${ctx.asked} réponses correctes.` : ""}

Analyse ce cas comme un senior en garde : hypothèses diagnostiques hiérarchisées, examens complémentaires, pièges.`;
}

export function OptimusAnalysisPanel({ context }: { context: CaseAIContext }) {
  const [open, setOpen] = useState(false);
  const [historyEntries, setHistoryEntries] = useState<AIHistoryEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const ai = useClinicalAI();

  const caseId = context.title;
  useEffect(() => {
    setHistoryEntries(readHistory(caseId));
  }, [caseId, ai.status]);

  const prompt = buildCasePrompt(context);
  const canAnalyze = context.revealedSteps.length > 0;

  return (
    <section
      className="w-full rounded-xl border bg-card shadow-[var(--shadow-border)]"
      aria-label="Analyse Optimus"
    >
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
                  ? "Prêt à analyser ce cas"
                  : "Révèle au moins un élément pour commencer"
                : "Aide à la décision clinique"}
            </p>
          </div>
        </div>
        <ChevronDown
          className={`size-5 text-muted transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open && (
        <div className="space-y-4 border-t border-border p-5">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => ai.run(prompt, CASE_SYSTEM_PROMPT, context.title)}
              disabled={ai.status === "streaming" || !canAnalyze}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-fg transition-opacity disabled:opacity-40"
            >
              <Sparkles className="size-4" aria-hidden />
              {ai.status === "streaming"
                ? "Analyse en cours…"
                : ai.status === "done"
                  ? "Relancer l'analyse"
                  : "Analyser ce cas"}
            </button>

            {ai.status !== "idle" && ai.status !== "streaming" && (
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

          {ai.text && (
            <div className="rounded-[var(--radius-md)] bg-secondary p-4 text-sm leading-relaxed whitespace-pre-wrap">
              {ai.text}
              {ai.status === "streaming" && (
                <span className="ml-0.5 inline-block h-4 w-1 animate-pulse bg-primary align-middle" />
              )}
            </div>
          )}

          {ai.status === "error" && (
            <div className="rounded-[var(--radius-md)] border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-500">
              ⚠️ {ai.error}
            </div>
          )}

          {historyEntries.length > 0 && (
            <div className="border-t border-border pt-4">
              <button
                type="button"
                onClick={() => setHistoryOpen((v) => !v)}
                className="flex w-full items-center justify-between gap-2 text-left"
              >
                <h3 className="text-sm font-medium">
                  📜 Analyses précédentes ({historyEntries.length})
                </h3>
                <ChevronDown
                  className={`size-4 text-muted transition-transform ${historyOpen ? "rotate-180" : ""}`}
                  aria-hidden
                />
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
            <p>
              Aide à la décision — ne remplace pas le jugement clinique.
              Vérifiez toujours les sources officielles.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
