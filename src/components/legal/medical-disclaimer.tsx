export function MedicalDisclaimer() {
  return (
    <div
      role="note"
      className="mt-6 rounded-[var(--radius-md)] border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 text-[11px] leading-relaxed text-amber-200/80"
    >
      <span className="font-medium text-amber-200/95">Aide à la décision</span> — Optimus ne remplace pas le
      jugement clinique. Vérifiez toujours les recommandations officielles (HAS, OMS, sociétés savantes).
    </div>
  );
}
