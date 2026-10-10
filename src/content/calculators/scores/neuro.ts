import type { Calculator, CalculatorResult } from "../types";
import { num } from "../utils";

/**
 * Neurologie. Session en cours : migration du score de Glasgow.
 * ABCD², NIHSS, Rankin, Hoehn & Yahr… sont planifiés — voir TODO-CALCULATORS.md.
 */

/* ─────────────────────── Score de Glasgow (GCS) ─────────────────────── */

const glasgow: Calculator = {
  id: "glasgow",
  label: "Glasgow (GCS)",
  categorie: "neuro",
  description: "Évaluation du niveau de conscience : yeux + réponse verbale + réponse motrice.",
  reference: "Teasdale G, Jennett B. Lancet 1974.",
  itemsProgramme: ["Traumatisme crânien", "Coma"],
  fields: [
    {
      id: "yeux",
      label: "Ouverture des yeux (Y)",
      type: "number",
      min: 1,
      max: 4,
      default: 4,
      help: "4 spontanée · 3 à la demande · 2 à la douleur · 1 aucune",
    },
    {
      id: "verbale",
      label: "Réponse verbale (V)",
      type: "number",
      min: 1,
      max: 5,
      default: 5,
      help: "5 orientée · 4 confuse · 3 inappropriée · 2 incompréhensible · 1 aucune",
    },
    {
      id: "motrice",
      label: "Réponse motrice (M)",
      type: "number",
      min: 1,
      max: 6,
      default: 6,
      help: "6 obéit · 5 orientée · 4 évitement · 3 flexion · 2 extension · 1 aucune",
    },
  ],
  compute: (i): CalculatorResult => {
    const eye = Math.min(4, Math.max(1, num(i.yeux, 1)));
    const verbal = Math.min(5, Math.max(1, num(i.verbale, 1)));
    const motor = Math.min(6, Math.max(1, num(i.motrice, 1)));
    const total = eye + verbal + motor;
    const severity =
      total <= 8 ? "critical" : total <= 12 ? "high" : total <= 14 ? "medium" : "low";
    let label = "Léger";
    let interpretation = "Surveillance clinique rapprochée.";
    if (total <= 8) {
      label = "Sévère (GCS ≤ 8)";
      interpretation =
        "GCS ≤ 8 : protéger les voies aériennes — intubation à discuter, avis neurochirurgical, TDM cérébrale en urgence.";
    } else if (total <= 12) {
      label = "Modéré (GCS 9–12)";
      interpretation = "GCS 9–12 : surveillance rapprochée, imagerie cérébrale et avis spécialisé.";
    } else if (total <= 14) {
      label = "Léger (GCS 13–14)";
      interpretation =
        "GCS 13–14 : traumatisme crânien léger — réévaluation et imagerie selon les critères.";
    }
    return {
      value: `${total}/15`,
      label,
      interpretation: `Y${eye} V${verbal} M${motor} — ${interpretation}`,
      severity,
    };
  },
};

export const NEURO_CALCULATORS: Calculator[] = [glasgow];
