import { createFileRoute } from "@tanstack/react-router";
import { rateLimitRequest, retryAfterSeconds } from "@/lib/security/rate-limit.server";
import { readAllProtectedAssets } from "@/lib/content/protected-assets.server";
import {
  authenticate,
  contentUnavailableResponse,
  unauthorizedResponse,
} from "@/server/content-guard";

/**
 * `POST /api/quiz/answer` — CORRECTION SERVEUR des QCM premium
 * (pentest 2026-11-09, plan de remédiation P2).
 *
 * POURQUOI CE MODULE EXISTE
 * Les projections premium (`/content/decks/...`, `/content/diagnostics/...`)
 * ne transportent plus `correct` ni `explanation` : un utilisateur ne doit pas
 * pouvoir lire la réponse avant d'avoir choisi. La comparaison se fait donc
 * ICI, sous le même jeton de contenu que la lecture, et la réponse ne révèle
 * la clé et l'explication qu'APRÈS le choix.
 *
 * Contrat :
 *   • corps JSON `{ family: "decks"|"diagnostics", itemId, questionId, choice }` ;
 *   • même garde que `/content/$type/$file` (`authenticate`) : sans jeton,
 *     401 — la route ne doit jamais être un chemin contournant le garde ;
 *   • quota par IP (120/min) : la route ne fait qu'un lookup mémoire, mais un
 *     quota borne le coût d'un client automatisé ;
 *   • 404 `not_found` si l'item ou la question est introuvable — jamais le
 *     contenu d'une autre question, jamais la grille entière.
 *
 * Réponses :
 *   200 `{ correct, correctIndex, explanation, sources }`
 *   400 `bad_request` · 401 `unauthorized` · 404 `not_found`
 *   429 `rate_limited` (+ `Retry-After`) · 503 `content_protection_unavailable`
 */

const ANSWERABLE_FAMILIES = new Set<string>(["decks", "diagnostics"]);

/** 120 corrections par minute et par IP de confiance : largement au-dessus d'un usage humain. */
const RATE_LIMIT_MAX = 120;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

/** Identifiants de decks/questions/étapes : lettres, chiffres, tirets. */
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      // La correction d'une question ne doit jamais être mise en cache.
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
}

export const Route = createFileRoute("/api/quiz/answer")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Quota d'abord : aucun travail sans budget (même pattern que trial-token).
        const decision = await rateLimitRequest(
          request,
          "quiz-answer",
          RATE_LIMIT_MAX,
          RATE_LIMIT_WINDOW_MS,
        );
        if (!decision.ok) {
          return json({ error: "rate_limited" }, 429, {
            "Retry-After": String(retryAfterSeconds(decision)),
          });
        }

        // Garde : même jeton de contenu que la lecture des catalogues.
        const auth = await authenticate(request);
        if (!auth.ok) {
          return auth.reason === "unconfigured"
            ? contentUnavailableResponse()
            : unauthorizedResponse();
        }

        const body = (await request.json().catch(() => null)) as {
          family?: unknown;
          itemId?: unknown;
          questionId?: unknown;
          choice?: unknown;
        } | null;
        const family = typeof body?.family === "string" ? body.family : "";
        const itemId = typeof body?.itemId === "string" ? body.itemId : "";
        const questionId = typeof body?.questionId === "string" ? body.questionId : "";
        const choice = body?.choice;
        if (
          !ANSWERABLE_FAMILIES.has(family) ||
          !ID_PATTERN.test(itemId) ||
          !ID_PATTERN.test(questionId) ||
          typeof choice !== "number" ||
          !Number.isInteger(choice) ||
          choice < 0 ||
          choice > 15
        ) {
          return json({ error: "bad_request" }, 400);
        }

        // Lecture sous garde : les actifs sont en cache mémoire par instance.
        const assets = await readAllProtectedAssets(family as "decks" | "diagnostics");
        let item: unknown;
        for (const value of Object.values(assets)) {
          if (
            value !== null &&
            typeof value === "object" &&
            (value as { id?: unknown }).id === itemId
          ) {
            item = value;
            break;
          }
        }
        if (item === undefined || item === null || typeof item !== "object") {
          return json({ error: "not_found" }, 404);
        }

        const questions =
          family === "decks"
            ? (item as { questions?: unknown }).questions
            : (item as { steps?: unknown }).steps;
        if (!Array.isArray(questions)) return json({ error: "not_found" }, 404);

        const question = questions.find(
          (candidate) =>
            candidate !== null &&
            typeof candidate === "object" &&
            (candidate as { id?: unknown }).id === questionId,
        ) as { correct?: unknown; explanation?: unknown; sources?: unknown } | undefined;
        if (!question || typeof question.correct !== "number") {
          return json({ error: "not_found" }, 404);
        }

        return json(
          {
            correct: choice === question.correct,
            correctIndex: question.correct,
            explanation: typeof question.explanation === "string" ? question.explanation : "",
            sources: Array.isArray(question.sources) ? question.sources : [],
          },
          200,
        );
      },
    },
  },
});
