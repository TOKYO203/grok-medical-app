import type { EcgDiagnosis, EcgAlerteNiveau } from "@/lib/ecg/analyzeEcg";
import { cn } from "@/lib/utils";

const NIVEAU_STYLE: Record<EcgAlerteNiveau, { bg: string; text: string; dot: string; label: string }> = {
  critical: { bg: "bg-red-950/40",     text: "text-red-300",    dot: "bg-red-500",    label: "CRITIQUE" },
  warning:  { bg: "bg-amber-950/40",   text: "text-amber-300",  dot: "bg-amber-500",  label: "ATTENTION" },
  info:     { bg: "bg-sky-950/40",     text: "text-sky-300",    dot: "bg-sky-500",    label: "INFO" },
  normal:   { bg: "bg-emerald-950/30", text: "text-emerald-300",dot: "bg-emerald-500",label: "NORMAL" },
};

const RYTHME_LABEL: Record<string, string> = {
  "sinusal": "Sinusal",
  "sinusal-irregulier": "Sinusal irrégulier",
  "fa": "Fibrillation atriale",
  "flutter": "Flutter atrial",
  "tv": "Tachycardie ventriculaire",
  "fv": "Fibrillation ventriculaire",
  "indetermine": "Indéterminé",
};

export function EcgDiagnosisPanel({ diagnosis }: { diagnosis: EcgDiagnosis }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-border bg-card p-4 shadow-[var(--shadow-border)]">
      <div className="mb-3 flex items-center gap-2">
        <span className="h-2 w-2 animate-pulse rounded-full bg-[#A67C1E]" />
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
          Détection automatique
        </span>
      </div>

      {/* Bandeau de mesures */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-2 md:grid-cols-5">
        <Stat label="FC" value={`${diagnosis.fc}`} unit="bpm" />
        <Stat label="Rythme" value={RYTHME_LABEL[diagnosis.rythme] ?? diagnosis.rythme} />
        <Stat
          label="PR"
          value={diagnosis.pr ? `${diagnosis.pr.valueMs}` : "—"}
          unit={diagnosis.pr ? "ms" : undefined}
          badge={diagnosis.pr?.status === "progressif" ? "progressif" : undefined}
        />
        <Stat
          label="QRS"
          value={`${diagnosis.qrs.dureeMs}`}
          unit="ms"
          badge={diagnosis.qrs.status === "large" ? "large" : undefined}
        />
        <Stat
          label="Axe"
          value={`${diagnosis.axe.degres}°`}
          badge={diagnosis.axe.status !== "normal" ? diagnosis.axe.status : undefined}
        />
      </div>

      {/* Alertes */}
      {diagnosis.alertes.length > 0 && (
        <div className="mt-4 space-y-2">
          {diagnosis.alertes.map((a) => {
            const style = NIVEAU_STYLE[a.niveau];
            return (
              <div
                key={a.code}
                className={cn("flex items-start gap-3 rounded-[var(--radius-md)] border border-white/5 p-2.5", style.bg)}
              >
                <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", style.dot)} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className={cn("text-sm font-medium", style.text)}>{a.label}</span>
                    <span className={cn("font-mono text-[9px] tracking-wider", style.text, "opacity-70")}>
                      {style.label}
                    </span>
                  </div>
                  {a.description && (
                    <p className="mt-0.5 text-xs text-muted">{a.description}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {diagnosis.alertes.length === 0 && (
        <div className="mt-4 rounded-[var(--radius-md)] bg-emerald-950/30 p-3 text-sm text-emerald-300">
          Aucune anomalie détectée — ECG dans les normes.
        </div>
      )}

      <p className="mt-3 text-[10px] italic text-subtle">
        Outil pédagogique — ne remplace pas le jugement clinique.
      </p>
    </div>
  );
}

function Stat({
  label, value, unit, badge,
}: {
  label: string;
  value: string;
  unit?: string;
  badge?: string;
}) {
  return (
    <div className="flex flex-col">
      <span className="font-mono text-[9px] uppercase tracking-wider text-subtle">{label}</span>
      <div className="mt-0.5 flex items-baseline gap-1">
        <span className="font-mono text-base font-medium text-fg tabular-nums">{value}</span>
        {unit && <span className="text-[10px] text-muted">{unit}</span>}
      </div>
      {badge && (
        <span className="mt-1 inline-flex w-fit rounded-sm bg-[#A67C1E]/20 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[#E5B94E]">
          {badge}
        </span>
      )}
    </div>
  );
}
