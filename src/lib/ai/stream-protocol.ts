/** Read OpenAI-compatible SSE without hiding errors or accepting truncated replies. */
export async function* readAIStream(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let received = 0;

  function parseLine(line: string): string | null | undefined {
    if (!line.startsWith("data:")) return undefined;
    const payload = line.slice(5).trim();
    if (payload === "[DONE]") return null;
    if (!payload) return undefined;
    let data;
    try {
      data = JSON.parse(payload);
    } catch {
      throw new Error("Réponse IA invalide. Réessayez.");
    }
    if (data?.error || data?.choices?.[0]?.finish_reason === "error") {
      // Provider diagnostics may contain request/account data; keep errors generic.
      throw new Error("La génération IA a échoué. Réessayez.");
    }
    const token = data?.choices?.[0]?.delta?.content;
    return typeof token === "string" ? token : undefined;
  }

  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      if (buffer.length > 128 * 1024) throw new Error("Réponse IA trop volumineuse.");
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      if (done && buffer) {
        lines.push(buffer);
        buffer = "";
      }
      for (const line of lines) {
        const token = parseLine(line.trim());
        if (token === null) return;
        if (token !== undefined) {
          received += token.length;
          if (received > 128 * 1024) throw new Error("Réponse IA trop volumineuse.");
          yield token;
        }
      }
      if (done) throw new Error("Réponse IA interrompue. Réessayez.");
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
