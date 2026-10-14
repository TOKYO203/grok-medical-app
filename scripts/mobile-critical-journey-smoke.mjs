#!/usr/bin/env node
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { checkedUrl } from "./browser-guard.mjs";

const baseUrl = checkedUrl(process.argv[2] || "http://127.0.0.1:8080/");
const timeoutMs = Number(process.env.BROWSER_SMOKE_TIMEOUT_MS || 45_000);
const qaName = "QA Mobile";

async function launchBrowser() {
  const common = {
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  };
  if (process.env.CI) return chromium.launch({ ...common, channel: "chrome" });
  try {
    return await chromium.launch(common);
  } catch (error) {
    try {
      return await chromium.launch({ ...common, channel: "chrome" });
    } catch {
      throw error;
    }
  }
}

async function visible(locator) {
  return locator.isVisible().catch(() => false);
}

async function finishQuiz(page) {
  let answered = 0;
  for (let guard = 0; guard < 30; guard += 1) {
    const finish = page.getByRole("button", { name: "Terminer", exact: true });
    if (await visible(finish)) break;

    // La page est rendue côté serveur (SSR) avant l'hydratation React : un clic
    // pré-hydratation sur un choix est ignoré. Retenter jusqu'au feedback.
    const choice = page.locator("ul > li > button").first();
    const advance = page.getByRole("button", {
      name: /Question suivante|Voir mes résultats/,
    });
    await choice.waitFor({ state: "visible", timeout: timeoutMs });
    for (let attempt = 0; attempt < 40 && !(await visible(advance)); attempt += 1) {
      await choice.click().catch(() => {});
      await page.waitForTimeout(250);
    }
    answered += 1;

    await advance.waitFor({ state: "visible", timeout: timeoutMs });
    const label = (await advance.textContent()) ?? "";
    await advance.click();

    if (/Voir mes résultats/.test(label)) {
      await finish.waitFor({ state: "visible", timeout: timeoutMs });
      break;
    }

    await page.waitForTimeout(550);
  }
  assert.ok(answered > 0, "the Deck session should contain at least one question");
  return answered;
}

const browser = await launchBrowser();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
});
const page = await context.newPage();
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(String(error?.message || error)));

try {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });

  // Onboarding v2 — quatre écrans : Bienvenue → Niveau → Objectif → Rythme.
  const continueButton = page.getByRole("button", { name: "Continuer", exact: true });
  await continueButton.waitFor({ state: "visible", timeout: timeoutMs });
  await page.getByLabel("Comment on t'appelle ?").fill(qaName);
  await continueButton.click();
  await page.getByRole("heading", { name: "Où en es-tu ?" }).waitFor();
  await page.getByRole("button", { name: "Continuer", exact: true }).click();
  await page.getByRole("heading", { name: "Ton objectif ?" }).waitFor();
  await page.getByRole("button", { name: "Continuer", exact: true }).click();
  await page.getByRole("heading", { name: "Ton rythme quotidien ?" }).waitFor();
  await page.getByRole("button", { name: "Commencer maintenant", exact: true }).click();
  await page.getByRole("heading", { name: `Bonjour, ${qaName}` }).waitFor({
    state: "visible",
    timeout: timeoutMs,
  });

  // La barre de navigation v2 ne référence plus /parcours directement (couvert par
  // « Nosographie » dans la nav et « Mes parcours » depuis le profil) : lien profond.
  await page.goto(new URL("/parcours", baseUrl).toString(), {
    waitUntil: "domcontentloaded",
    timeout: timeoutMs,
  });
  const main = page.locator("#main-content");
  await main.getByRole("heading", { name: "Parcours", exact: true }).waitFor({
    state: "visible",
    timeout: timeoutMs,
  });
  const deckCard = main.getByRole("link", { name: /Commencer ce Deck/ }).first();
  await deckCard.waitFor({ state: "visible", timeout: timeoutMs });
  await deckCard.click();

  const startDeck = page.getByRole("link", { name: "Commencer ce Deck", exact: true });
  await startDeck.waitFor({ state: "visible", timeout: timeoutMs });
  await startDeck.click();

  const answeredInLesson = await finishQuiz(page);
  await page.getByRole("button", { name: "Terminer", exact: true }).click();
  const traversedMetric = page.getByText("Parcouru", { exact: true }).locator("..");
  await traversedMetric.getByText(/^\d+%$/).waitFor({ state: "visible", timeout: timeoutMs });
  await page.getByRole("link", { name: /Reprendre · Étape|Réviser ce Deck/ }).waitFor({
    state: "visible",
    timeout: timeoutMs,
  });

  await page.getByRole("link", { name: "Accueil", exact: true }).click();
  const todaySession = page.locator('a[href*="/revue"][href*="mode=today"]').first();
  await todaySession.waitFor({ state: "visible", timeout: timeoutMs });
  await todaySession.click();
  await page.getByRole("heading", { name: "Session du jour", exact: true }).waitFor();
  // Même précaution SSR/hydratation que pour la session de deck.
  const reviewFeedback = page.getByText(/Juste|Incorrect/).first();
  const reviewChoice = page.locator("ul > li > button").first();
  await reviewChoice.waitFor({ state: "visible", timeout: timeoutMs });
  for (let attempt = 0; attempt < 40 && !(await visible(reviewFeedback)); attempt += 1) {
    await reviewChoice.click().catch(() => {});
    await page.waitForTimeout(250);
  }
  await reviewFeedback.waitFor({ state: "visible", timeout: timeoutMs });

  await page.getByRole("link", { name: "Profil", exact: true }).click();
  await page.getByRole("heading", { name: qaName, exact: true }).waitFor({
    state: "visible",
    timeout: timeoutMs,
  });
  await page.getByText("XP", { exact: true }).first().waitFor({ state: "visible" });

  await context.setOffline(true);
  await page.getByRole("link", { name: "Accueil", exact: true }).click();
  await page.getByRole("heading", { name: `Bonjour, ${qaName}` }).waitFor({
    state: "visible",
    timeout: timeoutMs,
  });
  await context.setOffline(false);
  await page.reload({ waitUntil: "domcontentloaded", timeout: timeoutMs });
  await page.getByRole("heading", { name: `Bonjour, ${qaName}` }).waitFor({
    state: "visible",
    timeout: timeoutMs,
  });

  assert.deepEqual(pageErrors, [], `uncaught browser errors: ${pageErrors.join(" | ")}`);
  console.log(
    JSON.stringify(
      {
        ok: true,
        viewport: "390x844",
        onboarding: true,
        deckSessionQuestions: answeredInLesson,
        reviewAnswered: true,
        profileRestoredAfterReconnect: true,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        url: page.url(),
        error: String(error?.message || error),
        pageErrors,
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
} finally {
  await context.close();
  await browser.close();
}
