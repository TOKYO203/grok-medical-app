import { test, expect } from "@playwright/test";

test.describe("Onboarding", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => window.localStorage.clear());
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("affiche l'écran d'accueil puis l'étape profil", async ({ page }) => {
    await expect(page.getByRole("button", { name: /commencer/i })).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: /commencer/i }).click();
    await expect(page.getByText(/quel est votre niveau/i)).toBeVisible();
  });

  test("propose 25 matières en 3 catégories", async ({ page }) => {
    await page.getByRole("button", { name: /commencer/i }).click({ timeout: 20_000 });
    await page.getByRole("button", { name: /continuer/i }).click();
    await expect(page.getByText(/pourquoi optimus/i)).toBeVisible();
    await expect(page.getByText("Spécialités")).toBeVisible();
    await expect(page.getByText("Fondamentaux")).toBeVisible();
    await expect(page.getByText("Examens & Stages")).toBeVisible();
    await expect(page.getByRole("button", { name: "Pédiatrie" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Psychiatrie" })).toBeVisible();
  });

  test("affiche l'objectif quotidien après les matières", async ({ page }) => {
    await page.getByRole("button", { name: /commencer/i }).click({ timeout: 20_000 });
    await page.getByRole("button", { name: /continuer/i }).click();
    await page.getByRole("button", { name: /continuer/i }).click();
    await expect(page.getByText(/objectif réaliste/i)).toBeVisible();
    await expect(page.getByText("15 min / jour")).toBeVisible();
    await expect(page.getByText("30 min / jour")).toBeVisible();
  });
});
