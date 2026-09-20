import { createFileRoute } from "@tanstack/react-router";
import { rateLimit, getClientIp } from "@/lib/security/rate-limit.server";
import { AIStreamBodySchema } from "@/lib/ai/schemas";
import { readAIRequestBody, AIRequestBodyError } from "@/lib/ai/request-body.server";
import {
  streamAI,
  cacheKey,
  cacheGet,
  cachePut,
  type AIRequest,
  type ChatMessage,
} from "@/lib/ai/server-ai.server";

export const Route = createFileRoute("/api/ai-stream")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ip = getClientIp(request);
        const rl = rateLimit(`ai-stream:${ip}`);
        if (!rl.ok) {
          return new Response(
            JSON.stringify({ error: "Trop de requêtes. Réessayez dans une minute." }),
            {
              status: 429,
              headers: {
                "Content-Type": "application/json",
                "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
              },
            },
          );
        }

        let json: unknown;
        try {
          json = await readAIRequestBody(request);
        } catch (e: unknown) {
          if (e instanceof AIRequestBodyError) {
            return new Response(JSON.stringify({ error: e.message }), {
              status: e.status,
              headers: { "Content-Type": "application/json" },
            });
          }
          return new Response(JSON.stringify({ error: "JSON invalide" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const parsed = AIStreamBodySchema.safeParse(json);
        if (!parsed.success) {
          return new Response(
            JSON.stringify({ error: "Requête invalide", details: parsed.error.issues }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }
        const raw = parsed.data;

        // Backward compat: accepte `{prompt}` legacy OU `{messages}` multi-turn
        const messages: ChatMessage[] =
          raw.messages && Array.isArray(raw.messages) && raw.messages.length > 0
            ? raw.messages
            : raw.prompt
              ? [{ role: "user", content: raw.prompt }]
              : [];

        if (messages.length === 0) {
          return new Response(JSON.stringify({ error: "messages manquant" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const req: AIRequest = {
          messages,
          systemPrompt: raw.systemPrompt,
          model: raw.model,
          temperature: raw.temperature,
        };

        const key = cacheKey(req);
        const encoder = new TextEncoder();

        const cached = cacheGet(key);
        if (cached) {
          const sse =
            `data: ${JSON.stringify({ choices: [{ delta: { content: cached } }] })}\n\n` +
            `data: [DONE]\n\n`;
          return new Response(sse, {
            headers: { "Content-Type": "text/event-stream", "X-Cache": "HIT" },
          });
        }

        const stream = new ReadableStream({
          async start(controller) {
            let full = "";
            try {
              for await (const token of streamAI(req)) {
                full += token;
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ choices: [{ delta: { content: token } }] })}\n\n`,
                  ),
                );
              }
              cachePut(key, full);
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : String(e);
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`),
              );
            } finally {
              controller.close();
            }
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            "X-Cache": "MISS",
          },
        });
      },
    },
  },
});
