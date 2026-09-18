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

const ROUTES = ["/", "/parcours", "/cas", "/profil", "/pro"];

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

      // Home starts with a hydration skeleton for a few hundred milliseconds.
      // Audit the settled UI rather than failing on that intentionally transient frame.
      await page.locator("main").first().waitFor({ state: "attached", timeout: 2_000 }).catch(() => {});
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
        return {
          horizontalOverflow: root.scrollWidth > root.clientWidth + 1,
          scrollWidth: root.scrollWidth,
          clientWidth: root.clientWidth,
          bottomNavTargetsTooSmall: navTargets.filter(
            (target) => target.width < 44 || target.height < 44,
          ).length,
          mobileNavTargetSizes: navTargets,
          mainCount: document.querySelectorAll("main").length,
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
  const exitCode = Math.max(exitCodeFor(verdictInput), layoutFailures.length > 0 ? 1 : 0);

  console.log(
    JSON.stringify(
      {
        ok: exitCode === 0,
        baseUrl,
        viewports: VIEWPORTS,
        routes: ROUTES,
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
