import assert from "node:assert/strict";

/** Exercise the built route with a real Better Auth cookie and a local provider stub. */
export async function checkBuiltAISecurity(fetchBuiltApp, authenticatedHeaders) {
  const request = (payload, headers = authenticatedHeaders) =>
    fetchBuiltApp(
      new Request("http://localhost/api/ai-stream", {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      }),
    );
  const originalFetch = globalThis.fetch;
  const previousKey = process.env.OPENROUTER_API_KEY;
  const previousModel = process.env.OPENROUTER_MODEL;
  const previousSalt = process.env.RATE_LIMIT_SALT;
  let providerCalls = 0;
  let upstreamSignal;
  let providerMode = "success";
  process.env.OPENROUTER_API_KEY = "local-test-key-never-sent-to-a-provider";
  process.env.OPENROUTER_MODEL = "server-approved-model";
  globalThis.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : (input.url ?? String(input));
    if (url !== "https://openrouter.ai/api/v1/chat/completions") return originalFetch(input, init);
    providerCalls += 1;
    upstreamSignal = init.signal;
    const body = JSON.parse(init.body);
    assert.equal(body.model, "server-approved-model");
    assert.equal(body.max_tokens, 1024);
    if (providerMode === "pending") {
      return new Promise((_, reject) =>
        init.signal.addEventListener("abort", () => reject(init.signal.reason), { once: true }),
      );
    }
    if (providerMode === "error")
      return new Response("private provider account data", { status: 402 });
    return new Response(
      `data: ${JSON.stringify({ choices: [{ delta: { content: `test response ${providerCalls}` } }] })}\n\ndata: [DONE]\n\n`,
    );
  };
  try {
    const anon = { "content-type": "application/json" };
    assert.equal((await request({ prompt: "Hello" }, anon)).status, 401);
    assert.equal(
      (await request({ prompt: "Hello" }, { ...anon, authorization: "Bearer forged" })).status,
      401,
    );
    assert.equal(
      (
        await request(
          { prompt: "Hello" },
          { ...anon, "x-grok-identity": authenticatedHeaders["x-grok-identity"] },
        )
      ).status,
      401,
    );
    for (const headers of [
      { ...authenticatedHeaders, origin: "https://untrusted.invalid" },
      { ...authenticatedHeaders, "sec-fetch-site": "same-site" },
      { ...authenticatedHeaders, "sec-fetch-site": "cross-site" },
    ])
      assert.equal((await request({ prompt: "Hello" }, headers)).status, 403);
    assert.equal(providerCalls, 0);

    delete process.env.RATE_LIMIT_SALT;
    assert.equal(
      (await request({ prompt: "Hello" })).status,
      503,
      "quota failure must fail closed",
    );
    process.env.RATE_LIMIT_SALT = previousSalt;
    assert.equal((await request({ prompt: "Hello", model: "attacker-model" })).status, 400);
    assert.equal((await request({ prompt: "x".repeat(128 * 1024) })).status, 413);
    assert.equal(providerCalls, 0);

    for (let i = 1; i <= 2; i++) {
      const response = await request({ prompt: "Hello" });
      assert.equal(response.status, 200);
      assert.match(response.headers.get("cache-control"), /private, no-store/);
      assert.match(await response.text(), new RegExp(`test response ${i}`));
    }
    assert.equal(providerCalls, 2, "identical conversations must not share a response cache");
    providerMode = "error";
    const failedText = await (await request({ prompt: "Error" })).text();
    assert.match(failedText, /"error"/);
    assert.doesNotMatch(failedText, /private provider|\[DONE\]/);

    providerMode = "pending";
    const pending = await request({ prompt: "Cancel" });
    await pending.body.cancel();
    assert.equal(
      upstreamSignal.aborted,
      true,
      "closing the response must abort the provider request",
    );
    providerMode = "success";

    // Invalid payloads still consume quota but never contact a paid provider.
    let limited;
    const before = providerCalls;
    for (let i = 0; i <= 20; i++) {
      limited = await request(
        { model: "not-allowed" },
        {
          ...authenticatedHeaders,
          "x-forwarded-for": `198.51.100.${i + 1}`,
          "x-real-ip": `203.0.113.${i + 1}`,
        },
      );
      if (limited.status === 429) break;
      assert.equal(limited.status, 400);
    }
    assert.equal(limited.status, 429, "changing forwarded IPs must not bypass the per-user quota");
    assert.ok(Number(limited.headers.get("retry-after")) > 0);
    assert.equal(providerCalls, before);
    console.log(
      "[smoke] AI: auth 401, cross-site 403, quota fail-closed 503, model 400, size 413, quota 429, private SSE, cancellation passed",
    );
  } finally {
    globalThis.fetch = originalFetch;
    for (const [name, value] of [
      ["OPENROUTER_API_KEY", previousKey],
      ["OPENROUTER_MODEL", previousModel],
      ["RATE_LIMIT_SALT", previousSalt],
    ]) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}
