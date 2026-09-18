import { useState } from "react";
import { ChevronDown, Info } from "lucide-react";
import { generateClinicalInsight } from "@/lib/ai/clinical-ai-engine";
import { recommendNextCase } from "@/lib/ai/recommendation-engine";

/**
 * Optimus Clinical AI — carte d'aide à la décision.
 * ⚠️ Aperçu : les données sont actuellement locales (mock).
 * Le branchement sur le runtime IA réel est prévu.
 */
export default function ClinicalAIWidget() {
  const [open, setOpen] = useState(false);

  const insight = generateClinicalInsight(750, 12);
  const recommendation = recommendNextCase(3);

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
              {open ? "Aide à la décision" : insight.title}
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
