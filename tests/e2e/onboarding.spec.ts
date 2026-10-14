import { test, expect } from "@playwright/test";

test.describe("Onboarding", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => window.localStorage.clear());
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("affiche l'écran de bienvenue puis l'étape niveau", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: /bienvenue sur optimus/i }),
    ).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: /continuer/i }).click();
    await expect(page.getByRole("heading", { name: /où en es-tu/i })).toBeVisible();
  });

  test("propose les objectifs puis les matières suggérées", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: /bienvenue sur optimus/i }),
    ).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: /continuer/i }).click();
    await page.getByRole("button", { name: /continuer/i }).click();
    await expect(page.getByRole("heading", { name: /ton objectif/i })).toBeVisible();
    await expect(page.getByText(/suggéré pour toi/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Pédiatrie" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Psychiatrie" })).toBeVisible();
  });

  test("affiche le rythme quotidien puis termine vers le dashboard", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: /bienvenue sur optimus/i }),
    ).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: /continuer/i }).click();
    await page.getByRole("button", { name: /continuer/i }).click();
    await page.getByRole("button", { name: /continuer/i }).click();
    await expect(page.getByRole("heading", { name: /ton rythme quotidien/i })).toBeVisible();
    await expect(page.getByText("15 min / jour")).toBeVisible();
    await expect(page.getByText("30 min / jour")).toBeVisible();
    await page.getByRole("button", { name: /commencer maintenant/i }).click();
    await expect(page.getByRole("heading", { name: /bonjour/i })).toBeVisible();
  });
});
