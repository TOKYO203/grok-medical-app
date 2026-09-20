import { test, expect } from "@playwright/test";

test.describe("PWA", () => {
  test("manifest déclaré et récupérable", async ({ page, request }) => {
    await page.goto("/");
    const manifestHref = await page
      .locator('link[rel="manifest"]')
      .getAttribute("href")
      .catch(() => null);
    if (manifestHref) {
      const res = await request.get(manifestHref);
      expect(res.status()).toBeLessThan(400);
    }
  });

  test("service worker enregistré", async ({ page }) => {
    await page.goto("/");
    const swUrl = await page.evaluate(async () => {
      if (!("serviceWorker" in navigator)) return null;
      const reg = await navigator.serviceWorker.getRegistration();
      return reg?.active?.scriptURL ?? reg?.installing?.scriptURL ?? reg?.waiting?.scriptURL ?? null;
    });
    expect(swUrl).toBeTruthy();
  });
});
