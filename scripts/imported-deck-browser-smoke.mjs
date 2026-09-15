#!/usr/bin/env node
import { chromium } from "playwright";
import { checkedUrl } from "./browser-guard.mjs";

const baseUrl = checkedUrl(process.argv[2] || "http://127.0.0.1:8080/");
const appOrigin = new URL(baseUrl).origin;
const timeoutMs = Number(process.env.BROWSER_SMOKE_TIMEOUT_MS || 45_000);
const qaClientIp = process.env.QA_CLIENT_IP?.trim();
const qaHeaders =
  process.env.TRUST_PROXY_HEADERS === "true" && qaClientIp
    ? { "x-forwarded-for": qaClientIp }
    : undefined;
const DECK_ID = "QA-IDB-PERSIST-001";
const DECK_TITLE = "Deck de persistance QA";

const sample = JSON.stringify({
  schema_version: 2,
  deck_id: DECK_ID,
  version: "1.0.0",
  title: DECK_TITLE,
  subject: "Cardiologie",
  specialty: "Cardiologie",
  study_year: 5,
  difficulty: "intermediate",
  questions: [
    {
      id: "qa-idb-q1",
      prompt: "Quel examen simple est prioritaire devant une douleur thoracique aiguë ?",
      choices: ["ECG", "EEG"],
      correct: 0,
      explanation: "L'ECG fait partie de l'évaluation initiale d'une douleur thoracique aiguë.",
      sources: [
        {
          title: "ESC",
          citation: "Guidelines for acute coronary syndromes.",
          year: 2023,
        },
      ],
      difficulty: "base",
      competency: "diagnosis",
    },
  ],
  sources: [{ title: "ESC", citation: "Guidelines for acute coronary syndromes.", year: 2023 }],
});

async function launchBrowser() {
  const common = { headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] };
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

async function addQaHeaders(page) {
  if (!qaHeaders) return;
  await page.route("**/*", async (interceptedRoute) => {
    const request = interceptedRoute.request();
    let origin;
    try {
      origin = new URL(request.url()).origin;
    } catch {
      await interceptedRoute.continue();
      return;
    }
    if (origin !== appOrigin) {
      await interceptedRoute.continue();
      return;
    }
    await interceptedRoute.continue({ headers: { ...request.headers(), ...qaHeaders } });
  });
}

function fail(message) {
  throw new Error(`[imported-deck-browser-smoke] ${message}`);
}

async function fillHydratedImportForm(page) {
  const textarea = page.locator("textarea");
  const validateButton = page.getByRole("button", { name: "Valider" });
  await textarea.waitFor({ state: "visible", timeout: 10_000 });
  await validateButton.waitFor({ state: "visible", timeout: 10_000 });

  // The route is server-rendered first. Filling before React has attached its
  // controlled-input handler can be overwritten by hydration, leaving the
  // button disabled. Retry until the React state itself enables the button.
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    await textarea.fill("");
    await textarea.fill(sample);
    await page.waitForTimeout(100);
    if (await validateButton.isEnabled()) return validateButton;
    await page.waitForTimeout(150);
  }
  fail("the import form never became interactive after hydration");
}

let browser;
try {
  browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await addQaHeaders(page);

  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto(new URL("/import", baseUrl).toString(), {
    waitUntil: "domcontentloaded",
    timeout: timeoutMs,
  });
  await page.locator("main").first().waitFor({ state: "attached", timeout: 5_000 });
  const validateButton = await fillHydratedImportForm(page);
  await validateButton.click();
  await page.getByText("Enregistré dans IndexedDB", { exact: false }).waitFor({
    state: "visible",
    timeout: 10_000,
  });

  const persisted = await page.evaluate(async ({ deckId }) => {
    const raw = window.localStorage.getItem("optimus-v2");
    const local = raw ? JSON.parse(raw) : null;
    const localDecks = Array.isArray(local?.state?.importedDecks) ? local.state.importedDecks : [];

    const decks = await new Promise((resolve, reject) => {
      const request = indexedDB.open("optimus-imported-decks:OM-GUEST", 1);
      request.onerror = () => reject(request.error ?? new Error("indexeddb_open_failed"));
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction("decks", "readonly");
        const getAll = transaction.objectStore("decks").getAll();
        getAll.onerror = () => reject(getAll.error ?? new Error("indexeddb_read_failed"));
        getAll.onsuccess = () => {
          resolve(getAll.result);
          db.close();
        };
      };
    });

    return {
      localDeckIds: localDecks.map((deck) => deck?.id).filter(Boolean),
      indexedDeckIds: Array.isArray(decks) ? decks.map((deck) => deck?.id).filter(Boolean) : [],
      expectedId: deckId,
    };
  }, { deckId: DECK_ID });

  if (persisted.localDeckIds.includes(DECK_ID)) {
    fail("the imported Deck leaked back into Zustand/localStorage");
  }
  if (!persisted.indexedDeckIds.includes(DECK_ID)) {
    fail("the imported Deck was not committed to IndexedDB");
  }

  await page.reload({ waitUntil: "domcontentloaded", timeout: timeoutMs });
  await page.goto(new URL("/parcours", baseUrl).toString(), {
    waitUntil: "domcontentloaded",
    timeout: timeoutMs,
  });
  await page.getByText(DECK_TITLE, { exact: false }).first().waitFor({
    state: "visible",
    timeout: 10_000,
  });

  if (consoleErrors.length > 0) {
    fail(`browser console errors: ${consoleErrors.join(" | ")}`);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        deckId: DECK_ID,
        localStorageContainsDeck: false,
        indexedDbContainsDeck: true,
        restoredAfterReload: true,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: String(error?.message || error) }, null, 2));
  process.exitCode = 1;
} finally {
  await browser?.close();
}
