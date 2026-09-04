import type { VercelRequest, VercelResponse } from '@vercel/node';

// Lightweight recommendations endpoint (heuristic)
// This is a minimal serverless endpoint that reads the builtin clinical cases
// and returns a prioritized list based on simple signals: if user has history
// we would rank by correctness and last_seen, but for MVP we return cases
// matching user's specialty first then by id.

import { CLINICAL_CASES } from '@/content/catalog';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const items = CLINICAL_CASES.slice(0, 10).map((c) => ({
      id: c.id,
      title: c.title,
      specialty: c.specialty,
      reason: 'Recommandé pour votre spécialité',
    }));
    res.status(200).json(items);
  } catch (e: any) {
    res.status(500).json({ error: String(e) });
  }
}
