import { test, expect } from "@playwright/test";

const SEED = {
  state: {
    profile: {
      displayName: "Test",
      onboarded: true,
      studyYear: 5,
      studyLevel: 5,
      goal: "edn",
      prioritySubjects: ["Cardiologie"],
    },
    streak: 3,
    lastActiveDay: "",
    daily: { key: new Date().toISOString().slice(0, 10), answered: 2, xp: 0 },
    xp: 0,
    weeklyXp: 0,
  },
  version: 2,
};

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((seed) => {
      window.localStorage.clear();
      window.localStorage.setItem("optimus-v2", JSON.stringify(seed));
      window.localStorage.setItem("optimus.dailyGoal", "30min");
    }, SEED);
    await page.goto("/");
    // Attendre que le store soit hydraté et l'onboarding bypass
    await page.waitForLoadState("networkidle");
  });

  test("affiche la carte objectif du jour", async ({ page }) => {
    await expect(page.getByText(/objectif du jour/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("30 min / jour")).toBeVisible();
  });

  test("affiche la barre de progression", async ({ page }) => {
    await expect(page.getByText(/2 \/ 6 QCMs/)).toBeVisible({ timeout: 20_000 });
  });
});
