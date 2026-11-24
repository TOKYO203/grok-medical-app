import { useEffect, useState } from "react";
import { Award } from "lucide-react";
import { loadProgression } from "@/lib/ecg/parcours/progression";

export function Certificate({
  lessonId,
  passThreshold,
}: {
  lessonId: string;
  passThreshold: number;
}) {
  const [data, setData] = useState<{ score: number; date: string } | null>(null);

  useEffect(() => {
    const p = loadProgression();
    const score = p.quizScores[lessonId];
    if (score !== undefined && score >= passThreshold) {
      const d = p.updatedAt
        ? new Date(p.updatedAt).toLocaleDateString("fr-FR", {
            day: "numeric", month: "long", year: "numeric",
          })
        : "";
      setData({ score, date: d });
    } else {
      setData(null);
    }
  }, [lessonId, passThreshold]);

  if (!data) return null;

  return (
    <div className="mt-8 rounded-2xl border-2 border-emerald-500 bg-gradient-to-br from-emerald-50 to-white p-6 text-center">
      <Award size={48} className="mx-auto text-emerald-600" />
      <h2 className="mt-3 text-2xl font-bold">Certificat de complétion</h2>
      <p className="mt-1 text-sm text-subtle">Parcours ECG — de A à Z</p>
      <div className="mt-6 grid grid-cols-2 gap-4 text-left">
        <div>
          <p className="text-xs uppercase tracking-wide text-subtle">Score final</p>
          <p className="text-lg font-semibold">{data.score}%</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-subtle">Date</p>
          <p className="text-lg font-semibold">{data.date || "—"}</p>
        </div>
      </div>
      <p className="mt-6 text-xs text-subtle">
        Ce certificat atteste de la réussite de l'examen final du parcours
        pédagogique ECG (niveaux A à D validés, examen E réussi à {passThreshold}% minimum).
      </p>
    </div>
  );
}
