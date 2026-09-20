import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "optimus.store.v1",
        JSON.stringify({
          profile: { displayName: "Test", onboarded: true, studyYear: 5, studyLevel: 5, goal: "edn", prioritySubjects: ["Cardiologie"] },
          streak: 3,
          lastActiveDay: "",
          daily: { key: new Date().toISOString().slice(0, 10), answered: 2, xp: 0 },
          xp: 0,
        }),
      );
      window.localStorage.setItem("optimus.dailyGoal", "30min");
    });
    await page.goto("/");
  });

  test("affiche la carte objectif du jour", async ({ page }) => {
    await expect(page.getByText(/objectif du jour/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("30 min / jour")).toBeVisible();
  });

  test("affiche la barre de progression", async ({ page }) => {
    await expect(page.getByText(/2 \/ 6 QCMs/)).toBeVisible({ timeout: 15_000 });
  });

  test("disclaimer médical présent", async ({ page }) => {
    await expect(page.getByText(/ne remplace pas le jugement clinique/i)).toBeVisible({ timeout: 15_000 });
  });
});
