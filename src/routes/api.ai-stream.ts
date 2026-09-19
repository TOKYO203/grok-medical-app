import { createFileRoute } from "@tanstack/react-router";
import {
  streamAI,
  cacheKey,
  cacheGet,
  cachePut,
  type AIRequest,
  type ChatMessage,
} from "@/lib/ai/server-ai.server";

type IncomingBody = {
  messages?: ChatMessage[];
  prompt?: string;
  systemPrompt?: string;
  model?: string;
  temperature?: number;
};

export const Route = createFileRoute("/api/ai-stream")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let raw: IncomingBody;
        try {
          raw = (await request.json()) as IncomingBody;
        } catch {
          return new Response(JSON.stringify({ error: "JSON invalide" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

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
