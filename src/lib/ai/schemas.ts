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
    temperature: z.number().min(0).max(2).optional(),
  })
  .strict()
  .refine((d) => (d.messages && d.messages.length > 0) || d.prompt, {
    message: "messages ou prompt requis",
  })
  .refine(
    (d) =>
      (d.messages?.reduce((total, message) => total + message.content.length, 0) ?? 0) +
        (d.prompt?.length ?? 0) +
        (d.systemPrompt?.length ?? 0) <=
      32_000,
    {
      message: "Conversation trop longue. Commencez une nouvelle analyse.",
    },
  );

export type AIStreamBody = z.infer<typeof AIStreamBodySchema>;
