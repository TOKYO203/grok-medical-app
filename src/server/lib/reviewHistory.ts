export type ReviewEntry = {
  userId: string;
  caseId: string;
  score: number; // 0..1
  createdAt: string; // ISO
  nextReviewAt: string; // ISO
  intervalDays: number;
};

const STORE: ReviewEntry[] = [];

export function listReviews(userId?: string): ReviewEntry[] {
  if (!userId) return STORE.slice();
  return STORE.filter((r) => r.userId === userId);
}

export function addReview(entry: Omit<ReviewEntry, 'createdAt' | 'nextReviewAt' | 'intervalDays'>): ReviewEntry {
  const now = new Date();
  // simple heuristic to compute next review interval based on score
  const score = Math.max(0, Math.min(1, entry.score));
  let intervalDays = 1;
  if (score < 0.4) intervalDays = 1;
  else if (score < 0.7) intervalDays = 3;
  else if (score < 0.9) intervalDays = 7;
  else intervalDays = 14;

  const next = new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000);
  const out: ReviewEntry = {
    ...entry,
    createdAt: now.toISOString(),
    nextReviewAt: next.toISOString(),
    intervalDays,
  };
  STORE.push(out);
  return out;
}
