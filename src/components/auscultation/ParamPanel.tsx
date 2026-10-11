const LABELS: Record<string, string> = {
  freq: "Fréquence (Hz)",
  b1Freq: "B1 — Fréq (Hz)",
  b2Freq: "B2 — Fréq (Hz)",
  s1Freq: "B1 — Fréq (Hz)",
  s2Freq: "B2 — Fréq (Hz)",
  duration: "Durée (s)",
  b1Dur: "B1 — Durée (s)",
  b2Dur: "B2 — Durée (s)",
  interval: "Intervalle S1–S2 (s)",
  gain: "Gain",
  noise: "Bruit (0-1)",
  q: "Résonance Q",
  burstCount: "Nombre de bursts",
  burstDur: "Durée burst (s)",
  jitter: "Gigue temporelle",
  intensity: "Intensité",
  systole: "Systole (s)",
  diastole: "Diastole (s)",
};

export function ParamPanel({
  params,
  preset,
}: {
  params?: Record<string, number>;
  preset: string;
}) {
  const entries = params ? Object.entries(params) : [];
  return (
    <div className="rounded-[var(--radius-md)] bg-secondary/50 p-3">
      <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
        Preset audio
      </div>
      <div className="mb-3 truncate font-mono text-xs text-muted">{preset}</div>

      {entries.length === 0 ? (
        <div className="text-xs text-subtle">
          Paramètres par défaut du moteur audio (pas de valeurs explicites).
        </div>
      ) : (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
          {entries.map(([k, v]) => (
            <div key={k} className="flex flex-col">
              <dt className="font-mono text-subtle">{LABELS[k] ?? k}</dt>
              <dd className="font-mono tabular-nums text-muted">
                {typeof v === "number" ? v : String(v)}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
