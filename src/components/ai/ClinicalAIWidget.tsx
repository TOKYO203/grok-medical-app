import { useState } from "react";
import { ChevronDown, Info, Sparkles, RefreshCw } from "lucide-react";
import { generateClinicalInsight } from "@/lib/ai/clinical-ai-engine";
import { recommendNextCase } from "@/lib/ai/recommendation-engine";
import { useClinicalAI } from "@/lib/ai/useClinicalAI";

export default function ClinicalAIWidget() {
  const [open, setOpen] = useState(false);
  const ai = useClinicalAI();

  const insight = generateClinicalInsight(750, 12);
  const recommendation = recommendNextCase(3);

  const buildPrompt = () =>
    `Contexte étudiant :
- Insight : ${insight.title} — ${insight.message}
- Cas complétés : 12
- Recommandation suivante : ${recommendation.title}

Donne-moi 3 conseils cliniques concrets pour progresser, orientés pratique.`;

  const hasKey = Boolean(
    (import.meta as any).env?.VITE_GROQ_API_KEY?.trim?.()
  );

  return (
    <section
      className="w-full rounded-xl border bg-card shadow-[var(--shadow-border)]"
      aria-label="Optimus Clinical AI"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 p-5 text-left"
      >
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-full bg-primary-soft text-primary">
            🤖
          </span>
          <div>
            <h2 className="font-display text-lg font-medium">Optimus Clinical AI</h2>
            <p className="text-xs text-muted">
              {open
                ? hasKey
                  ? "Prêt — modèle Llama 3.3 70B"
                  : "⚠️ Clé API manquante (.env.local)"
                : insight.title}
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
          <div>
            <h3 className="font-semibold">{insight.title}</h3>
            <p className="mt-1 text-sm text-muted">{insight.message}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => ai.run(buildPrompt())}
              disabled={ai.status === "streaming" || !hasKey}
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

          <div>
            <h3 className="font-semibold">🎯 Prochaine recommandation</h3>
            <p className="mt-1 text-sm">{recommendation.title}</p>
            <p className="mt-1 text-xs text-muted">Gain : +{recommendation.xp} XP</p>
          </div>

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
