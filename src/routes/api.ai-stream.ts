import { createFileRoute } from "@tanstack/react-router";
import { auth, authConfigured } from "@/lib/auth/server";
import { gateIdentityEnabled } from "@/lib/auth/gate-identity.server";
import { consumeRateLimit } from "../../server/lib/rate-limit";
import { AIStreamBodySchema } from "@/lib/ai/schemas";
import { AIRequestBodyError, readAIRequestBody } from "@/lib/ai/request-body.server";
import { streamAI, type AIRequest } from "@/lib/ai/server-ai.server";

function jsonError(status: number, error: string, headers: Record<string, string> = {}) {
  return Response.json({ error }, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

export const Route = createFileRoute("/api/ai-stream")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const origin = request.headers.get("origin");
        const site = request.headers.get("sec-fetch-site");
        if (
          (origin && origin !== new URL(request.url).origin) ||
          (site && site !== "same-origin" && site !== "none")
        ) {
          return jsonError(403, "Requête intersite refusée.");
        }
        if (!authConfigured && !gateIdentityEnabled()) {
          return jsonError(503, "La connexion au service IA est indisponible.");
        }
        // No shared preview identity: provider credentials require a real session.
        let session;
        try {
          session = await auth.api.getSession({ headers: request.headers });
        } catch {
          return jsonError(503, "La connexion au service IA est indisponible.");
        }
        if (!session?.user) return jsonError(401, "Connectez-vous pour utiliser l’assistant IA.");

        try {
          // Persistent, atomic quotas use the verified user, never an IP header.
          for (const [scope, limit, windowSeconds] of [
            ["ai-stream-minute", 20, 60],
            ["ai-stream-day", 200, 86400],
          ] as const) {
            const decision = await consumeRateLimit({
              scope,
              subject: session.user.id,
              limit,
              windowSeconds,
            });
            if (!decision.allowed) {
              return jsonError(429, "Limite de requêtes IA atteinte. Réessayez plus tard.", {
                "Retry-After": String(decision.retryAfterSeconds),
              });
            }
          }
        } catch {
          return jsonError(503, "Le service IA est temporairement indisponible.");
        }

        let json: unknown;
        try {
          json = await readAIRequestBody(request);
        } catch (error) {
          return jsonError(
            error instanceof AIRequestBodyError ? error.status : 400,
            error instanceof AIRequestBodyError ? error.message : "Requête invalide.",
          );
        }
        const parsed = AIStreamBodySchema.safeParse(json);
        if (!parsed.success) return jsonError(400, "Requête invalide ou conversation trop longue.");
        const raw = parsed.data;
        const input: AIRequest = {
          messages: raw.messages?.length ? raw.messages : [{ role: "user", content: raw.prompt! }],
          systemPrompt: raw.systemPrompt,
          temperature: raw.temperature,
        };

        const upstream = new AbortController();
        const signal = AbortSignal.any([request.signal, upstream.signal]);
        const encoder = new TextEncoder();
        let cancelled = false;
        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            try {
              for await (const token of streamAI(input, signal)) {
                if (signal.aborted) break;
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ choices: [{ delta: { content: token } }] })}\n\n`,
                  ),
                );
              }
              if (!signal.aborted) controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            } catch {
              if (!signal.aborted)
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ error: "La génération IA a échoué. Réessayez." })}\n\n`,
                  ),
                );
            } finally {
              if (!cancelled) controller.close();
            }
          },
          cancel() {
            cancelled = true;
            upstream.abort();
          },
        });
        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "private, no-store, no-transform",
            "X-Accel-Buffering": "no",
          },
        });
      },
    },
  },
});
