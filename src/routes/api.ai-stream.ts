import { createFileRoute } from "@tanstack/react-router";
import {
  streamAI,
  cacheKey,
  cacheGet,
  cachePut,
  type AIRequest,
} from "@/lib/ai/server-ai.server";

export const Route = createFileRoute("/api/ai-stream")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: AIRequest;
        try {
          body = (await request.json()) as AIRequest;
        } catch {
          return new Response(JSON.stringify({ error: "JSON invalide" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const key = cacheKey(body);
        const encoder = new TextEncoder();

        // Cache hit → rejouer en SSE
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
              for await (const token of streamAI(body)) {
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
