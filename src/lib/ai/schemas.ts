import { z } from "zod";

export const ChatMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string().min(1).max(8000),
});

export const AIStreamBodySchema = z
  .object({
    messages: z.array(ChatMessageSchema).max(30).optional(),
    prompt: z.string().min(1).max(8000).optional(),
    systemPrompt: z.string().max(4000).optional(),
    model: z.string().max(120).optional(),
    temperature: z.number().min(0).max(2).optional(),
  })
  .refine((d) => (d.messages && d.messages.length > 0) || d.prompt, {
    message: "messages ou prompt requis",
  });

export type AIStreamBody = z.infer<typeof AIStreamBodySchema>;
