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

  test("affiche la session du jour et la progression quotidienne", async ({ page }) => {
    const progress = page.getByRole("progressbar", { name: "Objectif quotidien" });
    await expect(progress).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("heading", { name: /bonjour/i })).toBeVisible();
    await expect(page.getByText("Session du jour")).toBeVisible();
  });

  test("affiche l'objectif du jour sur 10 questions", async ({ page }) => {
    const progress = page.getByRole("progressbar", { name: "Objectif quotidien" });
    await expect(progress).toBeVisible({ timeout: 20_000 });
    await expect(progress.getByText("2/10")).toBeVisible();
    await expect(progress.getByText("questions", { exact: true })).toBeVisible();
  });
});
