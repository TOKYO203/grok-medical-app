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

    const choice = page.locator("ul > li > button").first();
    await choice.waitFor({ state: "visible", timeout: timeoutMs });
    await choice.click();
    answered += 1;

    const advance = page.getByRole("button", {
      name: /Question suivante|Voir mes résultats/,
    });
    await advance.waitFor({ state: "visible", timeout: timeoutMs });
    const label = (await advance.textContent()) ?? "";
    await advance.click();

    if (/Voir mes résultats/.test(label)) {
      await finish.waitFor({ state: "visible", timeout: timeoutMs });
      break;
    }

    // QuizPlayer deliberately arms the next question after 500 ms to prevent
    // double taps from being interpreted as an answer on mobile.
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

  // 1. First-run onboarding.
  const begin = page.getByRole("button", { name: "Commencer", exact: true });
  await begin.waitFor({ state: "visible", timeout: timeoutMs });
  await begin.click();
  await page.getByRole("heading", { name: "Quel est votre niveau actuel ?" }).waitFor();
  await page.getByRole("button", { name: "Continuer", exact: true }).click();
  await page.getByRole("heading", { name: "Pourquoi Optimus ?" }).waitFor();
  await page.getByRole("button", { name: "Continuer", exact: true }).click();
  await page.getByRole("heading", { name: "Comment vous appeler ?" }).waitFor();
  await page.getByLabel("Nom affiché").fill(qaName);
  await page.getByRole("button", { name: "Entrer dans Optimus", exact: true }).click();
  await page.getByRole("heading", { name: `Bonjour, ${qaName}` }).waitFor({
    state: "visible",
    timeout: timeoutMs,
  });

  // 2. Open the recommended free Deck through the mobile navigation and card.
  await page.getByRole("link", { name: "Parcours", exact: true }).click();
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

  // 3. Complete one learning session and return to the Deck page.
  const answeredInLesson = await finishQuiz(page);
  await page.getByRole("button", { name: "Terminer", exact: true }).click();
  await page.getByText(/Progression \d+%/).first().waitFor({ state: "visible", timeout: timeoutMs });

  // 4. Start the dashboard's spaced-repetition session. The `today` mode also
  // includes unseen questions, so this remains deterministic even if every Deck
  // answer above happened to be correct and therefore is not due yet.
  await page.getByRole("link", { name: "Accueil", exact: true }).click();
  const todaySession = page.locator('a[href*="/revue"][href*="mode=today"]').first();
  await todaySession.waitFor({ state: "visible", timeout: timeoutMs });
  await todaySession.click();
  await page.getByRole("heading", { name: "Session du jour", exact: true }).waitFor();
  const reviewChoice = page.locator("ul > li > button").first();
  await reviewChoice.waitFor({ state: "visible", timeout: timeoutMs });
  await reviewChoice.click();
  await page.getByText(/Juste|Incorrect/).first().waitFor({ state: "visible", timeout: timeoutMs });

  // 5. Profile reflects the identity created during onboarding.
  await page.getByRole("link", { name: "Profil", exact: true }).click();
  await page.getByRole("heading", { name: qaName, exact: true }).waitFor({
    state: "visible",
    timeout: timeoutMs,
  });
  await page.getByText("XP", { exact: true }).first().waitFor({ state: "visible" });

  // 6. Local-first behavior: navigation remains usable while the browser is
  // offline. Reconnect, reload from the server, and verify the local profile and
  // learning state survive the round-trip.
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
