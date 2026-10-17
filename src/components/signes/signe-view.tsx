import { useState } from "react";
import type { SigneItem } from "@/core/signes/types";
import { Shell } from "@/components/shell";

export function SigneView({ item }: { item: SigneItem }) {
  const [step, setStep] = useState<"case" | "deduction" | "reveal">("case");
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <div className="space-y-4">
      {step === "case" && (
        <div className="optimus-card p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Cas clinique</p>
          <p className="mt-3 text-base leading-relaxed">{item.clinicalCase}</p>
          <button
            onClick={() => setStep("deduction")}
            className="mt-6 w-full rounded-[var(--radius-md)] bg-primary px-4 py-3 font-medium text-primary-fg"
          >
            Déduire le syndrome
          </button>
        </div>
      )}

      {step === "deduction" && (
        <div className="optimus-card p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Déduction</p>
          <p className="mt-2 font-display text-lg">{item.question}</p>
          <div className="mt-4 space-y-2">
            {item.options.map((opt, i) => (
              <button
                key={i}
                onClick={() => {
                  setSelected(i);
                  setStep("reveal");
                }}
                className="w-full rounded-[var(--radius-md)] border border-border bg-card p-3 text-left text-sm hover:bg-secondary"
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}

      {step === "reveal" && (
        <div className="optimus-card p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Révélation</p>
          <p className="mt-2 font-display text-xl text-accent">{item.disease}</p>
          <div className="mt-4 rounded bg-secondary/50 p-4">
            <p className="text-[11px] font-semibold uppercase text-muted">Les signes</p>
            <ul className="mt-2 space-y-1">
              {item.signs.map((sign, i) => (
                <li key={i} className="text-sm font-medium">• {sign}</li>
              ))}
            </ul>
          </div>
          {item.explanation && (
            <p className="mt-4 text-sm leading-relaxed text-muted">{item.explanation}</p>
          )}
          <button
            onClick={() => {
              setStep("case");
              setSelected(null);
            }}
            className="mt-6 w-full rounded-[var(--radius-md)] bg-secondary px-4 py-3 font-medium"
          >
            Suivant / Recommencer
          </button>
        </div>
      )}
    </div>
  );
}
