import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { readAIStream } from "./stream-protocol.ts";
import { AIRequestBodyError, MAX_AI_BODY_BYTES, readAIRequestBody } from "./request-body.server.ts";
import { AIStreamBodySchema } from "./schemas.ts";
import { streamAI } from "./server-ai.server.ts";

function setEnv(t: TestContext, name: string, value: string) {
  const previous = process.env[name];
  process.env[name] = value;
  t.after(() => {
    if (previous === undefined) delete process.env[name];
    else process.env[name] = previous;
  });
}

const frame = (text: string) =>
  `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`;
async function collect(tokens: AsyncIterable<string>) {
  let result = "";
  for await (const token of tokens) result += token;
  return result;
}
function stream(text: string) {
  return new Response(text).body!;
}

test("SSE decodes split UTF-8, comments, CRLF and a terminal line without a newline", async () => {
  const bytes = new TextEncoder().encode(
    ": heartbeat\r\n" + frame("Éducation 🧠") + "data: [DONE]",
  );
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const byte of bytes) controller.enqueue(Uint8Array.of(byte));
      controller.close();
    },
  });
  assert.equal(await collect(readAIStream(body)), "Éducation 🧠");
});

test("SSE errors are surfaced after partial output without leaking provider details", async () => {
  for (const error of ["secret-provider-diagnostic", { message: "secret-provider-diagnostic" }]) {
    const body = stream(frame("Partial") + `data: ${JSON.stringify({ error })}\n\n`);
    await assert.rejects(
      collect(readAIStream(body)),
      (error: Error) =>
        error.message.includes("échoué") && !error.message.includes("secret-provider"),
    );
  }
});

test("SSE rejects incomplete, malformed and excessive responses", async () => {
  await assert.rejects(collect(readAIStream(stream(frame("incomplete")))), /interrompue/);
  await assert.rejects(collect(readAIStream(stream("data: {bad}\n\n"))), /invalide/);
  await assert.rejects(collect(readAIStream(stream("x".repeat(128 * 1024 + 1)))), /volumineuse/);
  await assert.rejects(
    collect(readAIStream(stream('data: {"choices":[{"finish_reason":"error"}]}\n\n'))),
    /échoué/,
  );
});

test("consumer cancellation releases the upstream reader", async () => {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(frame("first")));
    },
    cancel() {
      cancelled = true;
    },
  });
  for await (const token of readAIStream(body)) {
    assert.equal(token, "first");
    break;
  }
  assert.equal(cancelled, true);
  assert.equal(body.locked, false);
});

test("request byte limit applies with missing, honest and forged Content-Length", async () => {
  for (const headers of [
    {},
    { "content-length": "1" },
    { "content-length": String(MAX_AI_BODY_BYTES + 1) },
  ] as Record<string, string>[]) {
    const request = new Request("http://localhost/api/ai-stream", {
      method: "POST",
      headers,
      body: JSON.stringify({ prompt: "x".repeat(MAX_AI_BODY_BYTES) }),
    });
    await assert.rejects(
      readAIRequestBody(request),
      (error: AIRequestBodyError) => error.status === 413,
    );
  }
});

test("request reader accepts JSON and reports malformed input as 400", async () => {
  const request = (body: string) => new Request("http://localhost", { method: "POST", body });
  assert.deepEqual(await readAIRequestBody(request('{"prompt":"Bonjour"}')), { prompt: "Bonjour" });
  await assert.rejects(
    readAIRequestBody(request("{")),
    (error: AIRequestBodyError) => error.status === 400,
  );
});

test("schema rejects client-selected models, extra fields and oversized conversation totals", () => {
  assert.equal(AIStreamBodySchema.safeParse({ prompt: "Bonjour" }).success, true);
  assert.equal(
    AIStreamBodySchema.safeParse({ prompt: "Bonjour", model: "expensive-model" }).success,
    false,
  );
  assert.equal(
    AIStreamBodySchema.safeParse({ prompt: "Bonjour", max_tokens: 999999 }).success,
    false,
  );
  assert.equal(
    AIStreamBodySchema.safeParse({
      messages: Array.from({ length: 5 }, () => ({ role: "user", content: "x".repeat(8000) })),
    }).success,
    false,
  );
});

test("provider uses the server model, a token budget and an abortable request", async (t) => {
  setEnv(t, "OPENROUTER_API_KEY", "test-key-never-used-on-network");
  setEnv(t, "OPENROUTER_MODEL", "server-approved-model");
  const ctrl = new AbortController();
  let captured: RequestInit | undefined;
  t.mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) => {
    captured = init;
    return new Response(frame("OK") + "data: [DONE]\n\n");
  });
  const input = {
    messages: [{ role: "user" as const, content: "Hello" }],
    model: "attacker-model",
  };
  assert.equal(await collect(streamAI(input, ctrl.signal)), "OK");
  const sent = JSON.parse(String(captured?.body));
  assert.equal(sent.model, "server-approved-model");
  assert.equal(sent.max_tokens, 1024);
  assert.equal(captured?.signal?.aborted, false);
  ctrl.abort();
  assert.equal(captured?.signal?.aborted, true);
});

test("provider HTTP errors do not expose diagnostic bodies", async (t) => {
  setEnv(t, "OPENROUTER_API_KEY", "test-key-never-used-on-network");
  t.mock.method(
    globalThis,
    "fetch",
    async () => new Response("sensitive account detail", { status: 402 }),
  );
  await assert.rejects(
    collect(streamAI({ messages: [{ role: "user", content: "Hi" }] })),
    (error: Error) =>
      error.message.includes("indisponible") && !error.message.includes("sensitive"),
  );
});

test("already cancelled requests do not call a provider", async (t) => {
  setEnv(t, "OPENROUTER_API_KEY", "test-key-never-used-on-network");
  const fetchMock = t.mock.method(globalThis, "fetch", async () => {
    throw new Error("Must not fetch");
  });
  await assert.rejects(
    collect(streamAI({ messages: [{ role: "user", content: "Hi" }] }, AbortSignal.abort())),
    { name: "AbortError" },
  );
  assert.equal(fetchMock.mock.callCount(), 0);
});
