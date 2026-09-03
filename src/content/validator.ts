import { z } from "zod";
import { COMPETENCIES, type Deck, type Question } from "@/core/types";

const sourceSchema = z.object({
  title: z.string().trim().min(1, "Chaque source doit avoir un titre"),
  citation: z.string().trim().min(1, "Chaque source doit avoir une citation"),
  organization: z.string().trim().optional(),
  year: z.number().int().min(1900).max(2100).optional(),
  version: z.string().trim().optional(),
  url: z.string().trim().optional(),
  doi: z.string().trim().optional(),
  verifiedAt: z.string().trim().optional(),
});

const questionSchema = z
  .object({
    id: z.string().trim().min(1).optional(),
    prompt: z.string().trim().min(8, "L'énoncé de la question est trop court"),
    choices: z.array(z.string().trim().min(1)).min(2, "Au moins deux choix").max(6, "Six choix maximum"),
    correct: z.union([z.number().int(), z.string()]).optional(),
    answer: z.union([z.number().int(), z.string()]).optional(),
    explanation: z.string().trim().min(8, "Une explication est obligatoire"),
    sources: z.array(sourceSchema).min(1, "Au moins une source bibliographique est requise"),
    difficulty: z.enum(["base", "avance"]).optional(),
    competency: z.enum(COMPETENCIES).optional(),
  })
  .superRefine((q, ctx) => {
    const raw = q.correct ?? q.answer;
    if (raw === undefined || raw === null || raw === "") {
      ctx.addIssue({ code: "custom", message: "La réponse correcte est obligatoire", path: ["correct"] });
      return;
    }
    const index =
      typeof raw === "number" ? raw : q.choices.findIndex((c) => c.toLowerCase() === String(raw).trim().toLowerCase());
    if (index < 0 || index >= q.choices.length) {
      ctx.addIssue({ code: "custom", message: "La réponse correcte ne correspond à aucun choix", path: ["correct"] });
    }
  });

const deckSchema = z
  .object({
    schema_version: z.number().int().optional(),
    schemaVersion: z.number().int().optional(),
    deck_id: z.string().trim().min(1).optional(),
    id: z.string().trim().min(1).optional(),
    version: z.string().trim().optional(),
    title: z.string().trim().min(2).optional(),
    subtitle: z.string().trim().optional(),
    subject: z.string().trim().optional(),
    specialty: z.string().trim().optional(),
    study_year: z.number().int().optional(),
    studyYear: z.number().int().optional(),
    difficulty: z.enum(["intro", "intermediate", "advanced", "base", "avance"]).optional(),
    competencies: z.array(z.enum(COMPETENCIES)).optional(),
    questions: z.array(questionSchema).min(1, "Le deck doit contenir au moins une question"),
    sources: z.array(sourceSchema).optional(),
    metadata: z
      .object({
        title: z.string().trim().min(2).optional(),
        subject: z.string().trim().optional(),
        study_year: z.number().int().optional(),
        difficulty: z.enum(["intro", "intermediate", "advanced"]).optional(),
      })
      .optional(),
  })
  .superRefine((d, ctx) => {
    const title = d.title ?? d.metadata?.title;
    if (!title || title.trim().length < 2) {
      ctx.addIssue({
        code: "custom",
        message: "Le titre du deck est obligatoire (title ou metadata.title)",
        path: ["title"],
      });
    }
  });

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);
}

function resolveCorrect(raw: number | string | undefined, choices: string[]): number {
  if (typeof raw === "number") return raw;
  if (!raw) return -1;
  return choices.findIndex((c) => c.toLowerCase() === String(raw).trim().toLowerCase());
}

export type ImportStep =
  | { id: string; label: string; ok: boolean; detail: string };

export type ImportResult =
  | { ok: true; deck: Deck; hash: string; steps: ImportStep[]; warnings: string[] }
  | { ok: false; steps: ImportStep[]; error: string };

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(text: string): Promise<string> {
  const encoded = new TextEncoder().encode(text);
  return toHex(await crypto.subtle.digest("SHA-256", encoded));
}

export async function importDeckJson(rawText: string, existingIds: string[]): Promise<ImportResult> {
  const steps: ImportStep[] = [];
  const warnings: string[] = [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
    steps.push({ id: "json", label: "JSON", ok: true, detail: "Document lisible" });
  } catch {
    steps.push({ id: "json", label: "JSON", ok: false, detail: "JSON invalide" });
    return { ok: false, steps, error: "Le fichier n'est pas un JSON valide." };
  }

  const schema = deckSchema.safeParse(parsed);
  if (!schema.success) {
    const msg = schema.error.issues[0]?.message ?? "Schéma invalide";
    steps.push({ id: "schema", label: "Schéma", ok: false, detail: msg });
    return { ok: false, steps, error: msg };
  }
  steps.push({ id: "schema", label: "Schéma", ok: true, detail: "Champs obligatoires présents" });

  const d = schema.data;
  const questions: Question[] = [];
  const seenPrompts = new Set<string>();
  let dupes = 0;
  for (const [i, q] of d.questions.entries()) {
    const promptKey = q.prompt.trim().toLowerCase();
    if (seenPrompts.has(promptKey)) {
      dupes += 1;
      continue;
    }
    seenPrompts.add(promptKey);
    const correct = resolveCorrect(q.correct ?? q.answer, q.choices);
    questions.push({
      id: q.id?.trim() || `q-${i + 1}`,
      prompt: q.prompt.trim(),
      choices: q.choices,
      correct,
      explanation: q.explanation.trim(),
      sources: q.sources,
      difficulty: q.difficulty ?? "base",
      competency: q.competency ?? "diagnosis",
    });
  }
  steps.push({
    id: "questions",
    label: "Questions",
    ok: questions.length > 0,
    detail: `${questions.length} question${questions.length > 1 ? "s" : ""} acceptée${questions.length > 1 ? "s" : ""}`,
  });
  steps.push({
    id: "sources",
    label: "Sources",
    ok: true,
    detail: "Chaque question porte au moins une référence",
  });
  steps.push({
    id: "doublons",
    label: "Doublons",
    ok: true,
    detail: dupes === 0 ? "Aucun doublon d'énoncé" : `${dupes} doublon(s) ignoré(s)`,
  });
  if (dupes) warnings.push(`${dupes} question(s) en double ont été ignorées.`);

  const title = (d.title ?? d.metadata?.title ?? "Deck importé").trim();
  const id = d.deck_id ?? d.id ?? slugify(title);
  if (existingIds.includes(id)) {
    warnings.push("Un deck avec le même identifiant existe déjà — il sera remplacé.");
  }

  const hash = await sha256Hex(JSON.stringify({ title, questions: questions.map((q) => q.prompt) }));
  steps.push({ id: "hash", label: "Intégrité", ok: true, detail: `SHA-256 ${hash.slice(0, 12)}…` });
  steps.push({
    id: "signature",
    label: "Signature",
    ok: true,
    detail: "Signature Ed25519 recommandée — absente, deck accepté en local (non authentifié)",
  });
  warnings.push("Sans signature serveur Ed25519, ce deck est accepté localement mais n'est pas authentifié.");

  const difficultyRaw = d.difficulty ?? d.metadata?.difficulty ?? "intermediate";
  const difficulty =
    difficultyRaw === "base" || difficultyRaw === "intro"
      ? "intro"
      : difficultyRaw === "avance" || difficultyRaw === "advanced"
        ? "advanced"
        : "intermediate";

  const deck: Deck = {
    id,
    deck_id: id,
    schema_version: d.schema_version ?? d.schemaVersion ?? 2,
    version: d.version ?? "1.0.0",
    title,
    subtitle: d.subtitle ?? "",
    subject: d.subject ?? d.specialty ?? d.metadata?.subject ?? "Importé",
    specialty: d.specialty ?? "Importé",
    studyYear: d.study_year ?? d.studyYear ?? d.metadata?.study_year ?? 5,
    difficulty,
    competencies: d.competencies ?? ["diagnosis"],
    icon: "book",
    questions,
    sources: d.sources ?? [],
    access_policy: { tier: "free", entitlement: "OPTIMUS_FREE" },
    chapters: [],
    imported: true,
  };

  steps.push({ id: "accept", label: "Acceptation", ok: true, detail: "Deck prêt à être étudié hors-ligne" });
  return { ok: true, deck, hash, steps, warnings };
}
