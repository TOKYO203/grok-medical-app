#!/usr/bin/env node
import { chromium } from "playwright";
import { checkedUrl } from "./browser-guard.mjs";
import { exitCodeFor } from "./browser-smoke-verdict.mjs";

const baseUrl = checkedUrl(process.argv[2] || "http://127.0.0.1:8080/");
const appOrigin = new URL(baseUrl).origin;
const timeoutMs = Number(process.env.BROWSER_SMOKE_TIMEOUT_MS || 45_000);
const qaClientIp = process.env.QA_CLIENT_IP?.trim();
const qaHeaders =
  process.env.TRUST_PROXY_HEADERS === "true" && qaClientIp
    ? { "x-forwarded-for": qaClientIp }
    : undefined;

const VIEWPORTS = [
  { name: "mobile320", width: 320, height: 568 },
  { name: "mobile360", width: 360, height: 800 },
  { name: "mobile390", width: 390, height: 844 },
];

/*
 * Écrans « principaux » + les deux surfaces PUBLIQUES qu'un visiteur voit
 * réellement (`/tarifs`, `/login`). Depuis que l'artefact de production porte la
 * configuration cloud (AUTH-8), les routes protégées affichent la porte d'entrée
 * à un visiteur anonyme : sans ces deux routes, l'audit ne mesurerait plus que le
 * même écran de connexion, et son « OK » ne dirait rien des pages commerciales.
 * Mesuré avant ajout : `/tarifs` et `/login` sont propres à 320/360/390 px.
 */
const ROUTES = ["/", "/parcours", "/cas", "/profil", "/pro", "/tarifs", "/login"];

async function launchAuditBrowser() {
  const common = {
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  };

  // GitHub-hosted Ubuntu runners already ship Chrome. Using the system channel
  // keeps CI deterministic without downloading a second browser on every run.
  if (process.env.CI) {
    return chromium.launch({ ...common, channel: "chrome" });
  }

  try {
    return await chromium.launch(common);
  } catch (error) {
    // Local contributors may have Chrome but not the Playwright-managed binary.
    try {
      return await chromium.launch({ ...common, channel: "chrome" });
    } catch {
      throw error;
    }
  }
}

let browser;
try {
  browser = await launchAuditBrowser();

  const results = {};
  for (const viewport of VIEWPORTS) {
    for (const route of ROUTES) {
      const page = await browser.newPage({
        viewport: { width: viewport.width, height: viewport.height },
      });

      // Inject the synthetic trusted-proxy client IP only into requests sent to
      // the app under test. Browser-wide extraHTTPHeaders would also attach it to
      // cross-origin assets (for example Google Fonts), triggering unnecessary
      // CORS preflights and making a clean page look broken.
      if (qaHeaders) {
        await page.route("**/*", async (interceptedRoute) => {
          const request = interceptedRoute.request();
          let requestOrigin;
          try {
            requestOrigin = new URL(request.url()).origin;
          } catch {
            await interceptedRoute.continue();
            return;
          }

          if (requestOrigin !== appOrigin) {
            await interceptedRoute.continue();
            return;
          }

          await interceptedRoute.continue({
            headers: {
              ...request.headers(),
              ...qaHeaders,
            },
          });
        });
      }

      const consoleErrors = [];
      const pageErrors = [];
      const failedResponses = [];
      page.on("console", (message) => {
        if (message.type() === "error") consoleErrors.push(message.text());
      });
      page.on("pageerror", (error) => pageErrors.push(String(error?.message || error)));
      page.on("response", (resourceResponse) => {
        if (resourceResponse.status() >= 400) {
          failedResponses.push({
            status: resourceResponse.status(),
            url: resourceResponse.url(),
            resourceType: resourceResponse.request().resourceType(),
          });
        }
      });

      const target = new URL(route, baseUrl).toString();
      const response = await page.goto(target, {
        waitUntil: "domcontentloaded",
        timeout: timeoutMs,
      });

      // Home starts with a hydration skeleton while the store rehydrates.
      // Audit the settled UI rather than failing on that intentionally transient
      // frame: CI runners can need several seconds to execute the client bundle,
      // so give the real UI a generous window before declaring a layout failure.
      await page.locator("main").first().waitFor({ state: "attached", timeout: 10_000 }).catch(() => {});
      // Le `<main>` est présent dès le HTML serveur (écran de chargement du gate).
      // On attend la FIN de cet écran pour mesurer une page stabilisée : sinon le
      // résultat dépend du moment où l'évaluation tombe (chargement ou connexion),
      // et deux exécutions du même commit ne disent pas la même chose.
      // Signature Playwright : waitForFunction(fn, arg, options) — passer les
      // options en 2e position les ferait interpréter comme `arg` et le délai
      // serait ignoré (attente jusqu'au défaut de 30 s).
      await page
        .waitForFunction(
          () => !document.querySelector('[data-cloud-gate="splash"]'),
          undefined,
          { timeout: 10_000 },
        )
        .catch(() => {});
      await page.waitForTimeout(100);

      const metrics = await page.evaluate(() => {
        const root = document.documentElement;
        const bottomNavigation = document.querySelector('nav[data-mobile-navigation="true"]');
        const navTargets = bottomNavigation
          ? [...bottomNavigation.querySelectorAll("a")].map((element) => {
              const rect = element.getBoundingClientRect();
              return { width: rect.width, height: rect.height };
            })
          : [];
        // Quel écran a RÉELLEMENT été mesuré ? Depuis que l'artefact de
        // production porte la configuration cloud (AUTH-8), un visiteur anonyme
        // voit l'écran d'entrée sur les routes protégées : la mesure porte alors
        // sur la porte d'entrée, pas sur l'application. Le champ est publié dans
        // le verdict pour que personne ne lise « l'app est propre à 320 px »
        // quand seule la porte a été auditée (cf. AUTH-14).
        const gate = document.querySelector('[data-cloud-gate="splash"]')
          ? "splash"
          : document.querySelector('[data-cloud-auth="screen"]')
            ? "locked"
            : "app";
        return {
          horizontalOverflow: root.scrollWidth > root.clientWidth + 1,
          scrollWidth: root.scrollWidth,
          clientWidth: root.clientWidth,
          bottomNavTargetsTooSmall: navTargets.filter(
            (target) => target.width < 44 || target.height < 44,
          ).length,
          mobileNavTargetSizes: navTargets,
          mainCount: document.querySelectorAll("main").length,
          gate,
        };
      });

      const key = `${viewport.name}:${route}`;
      results[key] = {
        width: viewport.width,
        height: viewport.height,
        route,
        status: response?.status() ?? 0,
        horizontalOverflow: metrics.horizontalOverflow,
        scrollWidth: metrics.scrollWidth,
        clientWidth: metrics.clientWidth,
        bottomNavTargetsTooSmall: metrics.bottomNavTargetsTooSmall,
        mobileNavTargetSizes: metrics.mobileNavTargetSizes,
        mainCount: metrics.mainCount,
        gate: metrics.gate,
        consoleErrors,
        pageErrors,
        failedResponses,
      };
      await page.close();
    }
  }

  const verdictInput = Object.fromEntries(
    Object.entries(results).map(([key, result]) => [
      key,
      {
        status: result.status,
        horizontalOverflow: result.horizontalOverflow,
        consoleErrors: result.consoleErrors,
        pageErrors: result.pageErrors,
      },
    ]),
  );

  const layoutFailures = Object.entries(results).filter(
    ([, result]) => result.bottomNavTargetsTooSmall > 0 || result.mainCount === 0,
  );

  /*
   * Résumé lisible de ce qui a été mesuré. Sur l'artefact de production, les
   * routes protégées rendent la porte d'entrée : compter les écrans par état
   * évite de confondre « l'application est propre à 320 px » et « la porte
   * d'entrée est propre à 320 px » (AUTH-14).
   */
  const gates = {};
  for (const result of Object.values(results)) {
    gates[result.gate] = (gates[result.gate] ?? 0) + 1;
  }
  const exitCode = Math.max(exitCodeFor(verdictInput), layoutFailures.length > 0 ? 1 : 0);

  console.log(
    JSON.stringify(
      {
        ok: exitCode === 0,
        baseUrl,
        viewports: VIEWPORTS,
        routes: ROUTES,
        gates,
        results,
        layoutFailures: layoutFailures.map(([key]) => key),
      },
      null,
      2,
    ),
  );
  process.exitCode = exitCode;
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: String(error?.message || error) }, null, 2));
  process.exitCode = 1;
} finally {
  await browser?.close();
}
