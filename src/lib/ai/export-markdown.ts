import type { ChatMessage } from "@/lib/ai/useClinicalAI";
import type { AIHistoryEntry } from "@/lib/ai/ai-history";

export type ExportContext = {
  title: string;
  specialty: string;
  studyYear?: number;
  difficulty?: string;
  summary: string;
  patient?: { age?: number; sex?: string; context?: string };
  revealedSteps: Array<{ title: string; body: string }>;
};

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ratingBadge(rating?: "up" | "down" | null): string {
  if (rating === "up") return " · 👍";
  if (rating === "down") return " · 👎";
  return "";
}

export function buildConversationMarkdown(
  context: ExportContext,
  messages: ChatMessage[],
  history: AIHistoryEntry[],
): string {
  const lines: string[] = [];
  const now = fmtDate(Date.now());

  lines.push(`# ${context.title}`);
  lines.push("");
  const meta: string[] = [`**Spécialité :** ${context.specialty}`];
  if (context.studyYear) meta.push(`**Année :** ${context.studyYear}e`);
  if (context.difficulty) meta.push(`**Difficulté :** ${context.difficulty}`);
  lines.push(meta.join(" · "));
  if (context.patient) {
    const p: string[] = [];
    if (context.patient.age) p.push(`${context.patient.age} ans`);
    if (context.patient.sex) p.push(context.patient.sex);
    if (context.patient.context) p.push(context.patient.context);
    if (p.length) lines.push(`**Patient :** ${p.join(", ")}`);
  }
  lines.push(`**Exporté le :** ${now}`);
  lines.push("");

  lines.push("## Énoncé");
  lines.push("");
  lines.push(context.summary);
  lines.push("");

  if (context.revealedSteps.length > 0) {
    lines.push("## Étapes révélées");
    lines.push("");
    context.revealedSteps.forEach((step, i) => {
      lines.push(`### ${i + 1}. ${step.title}`);
      lines.push("");
      lines.push(step.body);
      lines.push("");
    });
  }

  lines.push("## Conversation IA");
  lines.push("");
  messages.forEach((m) => {
    const who = m.role === "user" ? "🧑 Étudiant" : "🤖 Optimus Clinical AI";
    lines.push(`### ${who}`);
    lines.push("");
    lines.push(m.content);
    lines.push("");
  });

  if (history.length > 0) {
    lines.push("## Historique des analyses");
    lines.push("");
    history.forEach((h) => {
      lines.push(`### ${fmtDate(h.at)}${ratingBadge(h.rating)}`);
      lines.push("");
      lines.push(h.text);
      lines.push("");
    });
  }

  lines.push("---");
  lines.push("");
  lines.push(
    "_Aide à la décision — ne remplace pas le jugement clinique. Vérifiez toujours les sources officielles (HAS, OMS, sociétés savantes)._",
  );
  lines.push("");

  return lines.join("\n");
}

export function downloadMarkdown(filename: string, content: string): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function copyToClipboard(content: string): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.clipboard) return false;
  try {
    await navigator.clipboard.writeText(content);
    return true;
  } catch {
    return false;
  }
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
