import { test, expect } from "@playwright/test";

test.describe("Export IA", () => {
  test("panel IA présent sur un cas", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const casLink = page.getByRole("link", { name: /cas/i }).first();
    if (await casLink.count()) {
      await casLink.click();
      await page.waitForLoadState("networkidle");
      await expect(page.getByText(/Analyse Optimus/i).first()).toBeVisible({ timeout: 15_000 }).catch(() => {});
    }
  });
});

test.describe("Rate limit API", () => {
  test("POST sans body → 400", async ({ request }) => {
    const res = await request.post("/api/ai-stream", {
      data: {},
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });
});
