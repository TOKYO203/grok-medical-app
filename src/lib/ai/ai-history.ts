export type AIHistoryEntry = { id: string; text: string; at: number; model?: string };
const KEY = "optimus.ai.history.v1";
const MAX_PER_CASE = 5;
type Store = Record<string, AIHistoryEntry[]>;

function readStore(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? (parsed as Store) : {};
  } catch { return {}; }
}

function writeStore(store: Store): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* quota / private mode */
  }
}

export function pushHistory(caseId: string, text: string, model?: string): AIHistoryEntry {
  const entry: AIHistoryEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text, at: Date.now(), model,
  };
  const store = readStore();
  const existing = store[caseId] ?? [];
  store[caseId] = [entry, ...existing].slice(0, MAX_PER_CASE);
  writeStore(store);
  return entry;
}

export function readHistory(caseId: string): AIHistoryEntry[] {
  return readStore()[caseId] ?? [];
}

export function clearHistory(caseId: string): void {
  const store = readStore();
  delete store[caseId];
  writeStore(store);
}

export function clearAllHistory(): void { writeStore({}); }

export function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `il y a ${d} j`;
  return new Date(ts).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}
