#!/usr/bin/env node
/**
 * Préchauffage du serveur de développement avant les smokes Playwright.
 *
 * Problème mesuré en CI : au tout premier chargement, Vite découvre les
 * dépendances à pré-optimiser puis logue « optimized dependencies changed.
 * reloading » et **recharge la page en cours**. Le smoke qui tombe dans cette
 * fenêtre voit `504 (Outdated Optimize Dep)` et deux `404` — il échoue sur un
 * artefact de démarrage à froid, pas sur un défaut applicatif.
 *
 * Ce script charge donc les routes utilisées par les smokes, deux fois, en
 * IGNORANT volontairement les erreurs console : il ne juge rien, il stabilise le
 * graphe de dépendances. Les smokes eux-mêmes restent intransigeants ensuite.
 *
 *   node scripts/dev-server-warmup.mjs http://127.0.0.1:8082/
 */
import { chromium } from "playwright";
import { checkedUrl } from "./browser-guard.mjs";

const baseUrl = checkedUrl(process.argv[2] || "http://127.0.0.1:8080/");
const timeoutMs = Number(process.env.BROWSER_SMOKE_TIMEOUT_MS || 45_000);
const ROUTES = ["/", "/import", "/parcours"];
const PASSES = 2;

async function launchBrowser() {
  const common = { headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] };
  // Même logique que les smokes : Chrome du runner en CI, binaire Playwright sinon.
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

let browser;
try {
  browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  // Aucun écouteur d'erreur : ce passage ne juge pas, il échauffe.
  const visited = [];
  for (let pass = 0; pass < PASSES; pass += 1) {
    for (const route of ROUTES) {
      await page
        .goto(new URL(route, baseUrl).toString(), {
          waitUntil: "domcontentloaded",
          timeout: timeoutMs,
        })
        .catch(() => {});
      await page.locator("main").first().waitFor({ state: "attached", timeout: 15_000 }).catch(() => {});
      // Laisse le transformeur traiter les modules découverts à l'hydratation.
      await page.waitForTimeout(500);
      visited.push(`pass${pass + 1}:${route}`);
    }
  }
  console.log(
    JSON.stringify({ ok: true, baseUrl, warmed: visited, note: "console errors ignored on purpose" }, null, 2),
  );
} catch (error) {
  // Un préchauffage raté ne doit pas masquer le vrai verdict des smokes.
  console.error(JSON.stringify({ ok: false, warning: String(error?.message || error) }, null, 2));
} finally {
  await browser?.close();
}
