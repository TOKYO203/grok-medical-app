export const MAX_AI_BODY_BYTES = 128 * 1024;

export class AIRequestBodyError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Bound streamed bytes even when Content-Length is absent or forged. */
export async function readAIRequestBody(request: Request): Promise<unknown> {
  const tooLarge = () => new AIRequestBodyError(413, "Requête IA trop volumineuse.");
  if (Number(request.headers.get("content-length")) > MAX_AI_BODY_BYTES) {
    await request.body?.cancel().catch(() => undefined);
    throw tooLarge();
  }
  if (!request.body) throw new AIRequestBodyError(400, "JSON invalide.");
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_AI_BODY_BYTES) throw tooLarge();
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new AIRequestBodyError(400, "JSON invalide.");
  }
}
