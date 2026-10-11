import { z } from "zod";

export const ChatMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string().max(32_000),
});

export const AIStreamBodySchema = z
  .object({
    messages: z.array(ChatMessageSchema).max(50).optional(),
    prompt: z.string().min(1).max(32_000).optional(),
    systemPrompt: z.string().max(32_000).optional(),
    // No `model` field on purpose: the provider model is a server-side decision
    // (`server-ai.server.ts`). Accepting one let any anonymous caller select an
    // arbitrary — including the most expensive — model on the owner's API key.
    // This object is non-strict, so a client that still sends `model` is ignored.
    temperature: z.number().min(0).max(2).optional(),
  })
  .refine((d) => (d.messages && d.messages.length > 0) || d.prompt, {
    message: "messages ou prompt requis",
  });

export type AIStreamBody = z.infer<typeof AIStreamBodySchema>;
